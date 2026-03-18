#!/usr/bin/env node

/**
 * This script updates existing Stripe customer records with data from Recurly.
 *
 * It can be deleted once the Recurly to Stripe migration is complete.
 *
 * PREREQUISITE: Customers must already exist in the target Stripe account (created via PAN import
 * or other process). This script updates them with additional data from Recurly.
 *
 * RESUMABLE EXECUTION:
 *   This script is designed to be re-runnable. If it fails partway through, you can fix
 *   the issue and re-run with the same arguments. It will:
 *   1. Load already-processed records from the success output file
 *   2. Skip any records that were already successfully processed
 *   3. Re-attempt any records not in the success file (including previous failures)
 *
 *   To force a fresh start, use --restart flag or delete the success output file.
 *
 * Input CSV format:
 *   recurly_account_code,target_stripe_account,stripe_customer_id
 *
 * Where:
 *   - recurly_account_code: The Recurly account code (also the Overleaf user ID)
 *   - target_stripe_account: The target Stripe service name ('stripe-us' or 'stripe-uk')
 *   - stripe_customer_id: The Stripe customer ID (required - customers must already exist)
 *
 * Output files:
 *   --output (success file): Records that were successfully updated
 *     Format: recurly_account_code,target_stripe_account,stripe_customer_id
 *
 *   <output>_errors.csv: Records that failed (overwritten each run)
 *     Format: recurly_account_code,target_stripe_account,stripe_customer_id,error
 *
 *   <output>_stripe.json (dry-run only): Stripe customer update params
 *     Format: Array of { recurly_account_code, target_stripe_account, stripe_customer_id, updateParams }
 *
 *   <output>_stripe_existing_fields.json: Stripe customers that already had name/address/business_name set
 *     (written in both dry-run and commit modes)
 *     Format: Array of { recurly_account_code, stripe_account, stripe_customer_id, recurly: {...}, stripe: {...} }
 *
 * Resume behavior:
 *   - Records in the success file are SKIPPED (already done)
 *   - Records in the errors file are RE-PROCESSED (will be retried)
 *   - After each run, the errors file contains ONLY the failures from that run
 *   - Successfully retried records are moved from errors to success file
 *
 * Usage:
 *   # Dry run (no changes made, outputs _stripe.json with what would be updated)
 *   node scripts/recurly/migrate_recurly_customers_to_stripe.mjs --input customers.csv --output results.csv
 *
 *   # Commit changes
 *   node scripts/recurly/migrate_recurly_customers_to_stripe.mjs --input customers.csv --output results.csv --commit
 *
 *   # Resume after failure (just run the same command again)
 *   node scripts/recurly/migrate_recurly_customers_to_stripe.mjs --input customers.csv --output results.csv --commit
 *
 * Options:
 *   --input, -i <file>     Path to input CSV file
 *   --output, -o <file>    Path to success output CSV file
 *   --limit, -l <n>        Limit number of records processed (default: no limit)
 *   --concurrency, -c <n>  Number of customers to process concurrently (default: 10)
 *   --recurly-rate-limit <n>     Requests per second for Recurly (default: 10)
 *   --recurly-api-retries <n>    Number of retries on Recurly 429s (default: 5)
 *   --recurly-retry-delay-ms <n> Delay between Recurly retries in ms (default: 1000)
 *   --stripe-rate-limit <n>      Requests per second for Stripe (default: 50)
 *   --stripe-api-retries <n>     Number of retries on Stripe 429s (default: 5)
 *   --stripe-retry-delay-ms <n>  Delay between Stripe retries in ms (default: 1000)
 *   --force-invalid-tax     Allow VAT numbers that cannot be mapped to a tax ID type (default: false)
 *   --commit               Actually update customers in Stripe (default: dry-run mode)
 *   --verbose, -v          Enable debug logging
 *   --restart              Ignore existing output files and start fresh
 *
 *
 * Note, prior to running this script, environment variables must have been loaded from config/local.env
 *
 * ```
 * set -a
 * source ../../config/local.env
 * set +a
 * ```
 */

import Settings from '@overleaf/settings'
import Stripe from 'stripe'
import recurly from 'recurly'
import minimist from 'minimist'
import PQueue from 'p-queue'
import fs from 'node:fs'
import * as csv from 'csv'
import { scriptRunner } from '../lib/ScriptRunner.mjs'

import {
  areStripeAndRecurlyCardDetailsEqual,
  coalesceOrThrowPaymentMethod,
  extractNameFromAccount,
  extractNameFromBillingInfo,
  getTaxIdType,
  normalisedGBVATNumber,
  normalizeRecurlyAddressToStripe,
  normalizeName,
  sanitizeAccount,
} from '../helpers/migrate_recurly_customers_to_stripe.helpers.mjs'
import {
  createRateLimitedApiWrappers,
  DEFAULT_RECURLY_RATE_LIMIT,
  DEFAULT_STRIPE_RATE_LIMIT,
  DEFAULT_RECURLY_API_RETRIES,
  DEFAULT_RECURLY_RETRY_DELAY_MS,
  DEFAULT_STRIPE_API_RETRIES,
  DEFAULT_STRIPE_RETRY_DELAY_MS,
} from '../stripe/RateLimiter.mjs'

// =============================================================================
// STRIPE CLIENT SETUP
// =============================================================================

const stripeClients = {}

/**
 * Get a Stripe client by region ("us" or "uk").
 *
 * This intentionally mirrors the Stripe SDK construction used by subscriptions
 * (fetch http client + telemetry disabled), but without importing the full
 * subscriptions Stripe client module (which pulls in unrelated app code).
 */
function getRegionClient(region) {
  const regionLower = String(region || '')
    .trim()
    .toLowerCase()

  if (regionLower !== 'us' && regionLower !== 'uk') {
    throw new Error(
      `Unknown Stripe region: ${region}. Expected stripe-us or stripe-uk.`
    )
  }

  if (stripeClients[regionLower]) return stripeClients[regionLower]

  const secretKey =
    regionLower === 'us'
      ? Settings.apis?.stripeUS?.secretKey ||
        process.env.STRIPE_OL_SECRET_KEY ||
        process.env.STRIPE_OL_US_SECRET_KEY
      : Settings.apis?.stripeUK?.secretKey ||
        process.env.STRIPE_OL_UK_SECRET_KEY

  if (!secretKey || !String(secretKey).trim()) {
    throw new Error(
      `No Stripe secret key configured for region ${regionLower}. ` +
        `Configure Settings.apis.stripeUS/stripeUK.secretKey or set ` +
        `${
          regionLower === 'us'
            ? 'STRIPE_OL_SECRET_KEY (or legacy STRIPE_OL_US_SECRET_KEY)'
            : 'STRIPE_OL_UK_SECRET_KEY'
        }.`
    )
  }

  const client = new Stripe(secretKey, {
    httpClient: Stripe.createFetchHttpClient(),
    telemetry: false,
  })

  // Add serviceName for rate limiter identification (stripe-us or stripe-uk)
  client.serviceName = `stripe-${regionLower}`

  stripeClients[regionLower] = client
  return client
}

// =============================================================================
// RECURLY CLIENT SETUP
// =============================================================================

const recurlyApiKey =
  process.env.RECURLY_API_KEY || Settings.apis?.recurly?.apiKey
if (!recurlyApiKey) {
  throw new Error(
    'Recurly API key is not set. Set RECURLY_API_KEY env var or configure Settings.apis.recurly.apiKey'
  )
}
const recurlyClient = new recurly.Client(recurlyApiKey)

// =============================================================================
// CUSTOM FIELDS
// =============================================================================

const RECURLY_CUSTOM_FIELD_NAMES = [
  'channel',
  'Industry',
  'ol_sales_person',
  'MigratedfromFreeAgent',
]

function getRecurlyCustomFields(account) {
  const customFields = account?.customFields
  if (customFields == null) {
    throw new Error(
      'Recurly account is missing customFields (empty array is acceptable)'
    )
  }
  if (!Array.isArray(customFields)) {
    throw new Error('Recurly account customFields is not an array')
  }
  return customFields
}

function extractRecurlyCustomFieldMetadata(account) {
  const customFields = getRecurlyCustomFields(account)

  /** @type {Record<string, string>} */
  const metadata = {}

  const counts = {
    channel: 0,
    Industry: 0,
    ol_sales_person: 0,
    MigratedfromFreeAgent: 0,
    noCustomFields: 0,
  }

  if (customFields.length === 0) {
    counts.noCustomFields = 1
    return { metadata, counts }
  }

  for (const field of customFields) {
    const name = field?.name?.trim()
    if (!RECURLY_CUSTOM_FIELD_NAMES.includes(name)) continue

    const rawValue = field?.value
    if (rawValue == null) continue

    const value = String(rawValue).trim()
    if (!value) continue

    metadata[name] = value
    counts[name] = 1
  }

  return { metadata, counts }
}

// =============================================================================
// LOGGING UTILITIES
// =============================================================================

/**
 * Get ISO timestamp for logging
 */
function timestamp() {
  return new Date().toISOString()
}

/**
 * Log a warning message with timestamp
 */
function logWarn(message, context = {}) {
  const contextStr =
    Object.keys(context).length > 0 ? ` ${JSON.stringify(context)}` : ''
  console.warn(`[${timestamp()}] WARN: ${message}${contextStr}`)
}

/**
 * Log an error message with timestamp and optional stack trace
 */
function logError(message, error = null, context = {}) {
  const contextStr =
    Object.keys(context).length > 0 ? ` ${JSON.stringify(context)}` : ''
  console.error(`[${timestamp()}] ERROR: ${message}${contextStr}`)
  if (error?.stack) {
    console.error(`[${timestamp()}] STACK: ${error.stack}`)
  }
}

/**
 * Debug mode flag - controlled by --verbose/-v CLI arg.
 * (Intentionally not controlled via env var to avoid accidental noisy logs.)
 */
let DEBUG_MODE = false

/**
 * Log a message with timestamp.
 *
 * By default, logs at INFO level.
 * When { verboseOnly: true }, only logs when DEBUG_MODE is enabled.
 */
function logDebug(message, context = {}, { verboseOnly = false } = {}) {
  if (verboseOnly && !DEBUG_MODE) return
  const contextStr =
    Object.keys(context).length > 0 ? ` ${JSON.stringify(context)}` : ''
  const level = verboseOnly ? 'DEBUG' : 'INFO'
  console.log(`[${timestamp()}] ${level}: ${message}${contextStr}`)
}

// =============================================================================
// RESUME FUNCTIONALITY
// =============================================================================

/**
 * Load previously successfully processed records from the success output file.
 * Returns a Set of recurly_account_codes that have been successfully processed.
 *
 * Only records in the SUCCESS file are skipped. Records in the errors file
 * (or not in any file) will be processed/re-attempted.
 *
 * @param {string} successOutputPath - Path to the success output CSV file
 * @returns {Promise<Set<string>>}
 */
async function loadSuccessfullyProcessed(successOutputPath) {
  const processed = new Set()

  if (!fs.existsSync(successOutputPath)) {
    logDebug('No existing success file found, starting fresh', {
      successOutputPath,
    })
    return processed
  }

  logDebug('Loading previously successful records from success file', {
    successOutputPath,
  })

  return new Promise((resolve, reject) => {
    fs.createReadStream(successOutputPath)
      .pipe(
        csv.parse({
          columns: true,
          trim: true,
          skip_empty_lines: true,
          relax_column_count: true,
          relax_column_count_less: true,
        })
      )
      .on('data', row => {
        if (row.recurly_account_code) {
          processed.add(row.recurly_account_code)
        }
      })
      .on('end', () => {
        logDebug('Loaded previously successful records', {
          count: processed.size,
        })
        resolve(processed)
      })
      .on('error', err => {
        logError('Failed to read success file', err, { successOutputPath })
        reject(err)
      })
  })
}

/**
 * Helper to write a CSV row with proper escaping
 */
// TODO: consider using a CSV library
function formatCsvRow(columns, row) {
  const values = columns.map(col => {
    const val = row[col] ?? ''
    // Escape CSV values that contain commas, quotes, or newlines
    if (
      typeof val === 'string' &&
      (val.includes(',') || val.includes('"') || val.includes('\n'))
    ) {
      return `"${val.replace(/"/g, '""')}"`
    }
    return val
  })
  return values.join(',') + '\n'
}

/**
 * Create output writers for success and error files.
 *
 * Success file: Append-only, contains all successfully updated records
 * Errors file: Overwritten each run, contains only failures from this run
 *
 * @param {string} successPath - Path to the success output CSV file
 * @param {string} errorsPath - Path to the errors output CSV file
 * @param {boolean} restart - If true, truncate existing files
 * @returns {{ writeSuccess: (row: object) => void, writeError: (row: object) => void, close: () => Promise<void> }}
 */
function createOutputWriters(
  successPath,
  errorsPath,
  restart = false,
  { enableSuccessFile = true } = {}
) {
  // Success file columns
  const successColumns = [
    'recurly_account_code',
    'target_stripe_account',
    'stripe_customer_id',
  ]

  // Errors file columns (includes error message)
  const errorsColumns = [
    'recurly_account_code',
    'target_stripe_account',
    'stripe_customer_id',
    'error',
  ]

  // Success file: append mode (unless restart)
  // NOTE: In dry-run mode, we intentionally do NOT create or write to the success file,
  // because commit mode uses it for resume/skip behavior.
  const successStream = enableSuccessFile
    ? (() => {
        const successExists = fs.existsSync(successPath)
        const successFlags = restart ? 'w' : 'a'
        const stream = fs.createWriteStream(successPath, {
          flags: successFlags,
        })
        if (restart || !successExists) {
          stream.write(successColumns.join(',') + '\n')
        }
        return stream
      })()
    : null

  // Errors file: always overwrite (contains only this run's errors)
  const errorsStream = fs.createWriteStream(errorsPath, { flags: 'w' })
  errorsStream.write(errorsColumns.join(',') + '\n')

  function writeSuccess(row) {
    if (!successStream) return
    successStream.write(formatCsvRow(successColumns, row))
  }

  function writeError(row) {
    errorsStream.write(formatCsvRow(errorsColumns, row))
  }

  async function close() {
    if (successStream) successStream.end()
    errorsStream.end()

    const closers = [
      new Promise((resolve, reject) => {
        errorsStream.on('finish', resolve)
        errorsStream.on('error', reject)
      }),
    ]

    if (successStream) {
      closers.unshift(
        new Promise((resolve, reject) => {
          successStream.on('finish', resolve)
          successStream.on('error', reject)
        })
      )
    }

    await Promise.all(closers)
  }

  return { writeSuccess, writeError, close }
}

/**
 * Get the errors file path from the success file path
 */
function getErrorsPath(successPath) {
  return successPath.replace(/\.csv$/, '_errors.csv')
}

/**
 * Get the stripe.json file path from the success file path (for dry-run mode)
 */
function getStripeJsonPath(successPath) {
  return successPath.replace(/\.csv$/, '_stripe.json')
}

/**
 * Get the stripe_existing_fields.json file path from the success file path.
 */
function getStripeExistingFieldsJsonPath(successPath) {
  return successPath.replace(/\.csv$/, '_stripe_existing_fields.json')
}

/**
 * Stream a JSON array to disk without holding it all in memory.
 */
function createJsonArrayWriter(jsonPath) {
  const stream = fs.createWriteStream(jsonPath, { flags: 'w' })
  stream.write('[\n')
  let wroteAny = false

  function write(value) {
    const serialized = JSON.stringify(value, null, 2)
    if (wroteAny) stream.write(',\n')
    stream.write(serialized)
    wroteAny = true
  }

  async function close() {
    stream.write('\n]\n')
    stream.end()
    await new Promise((resolve, reject) => {
      stream.on('finish', resolve)
      stream.on('error', reject)
    })
  }

  return { write, close }
}

// =============================================================================
// RATE LIMITING
// =============================================================================

// rate limiters - initialized in main()
let rateLimiters

// =============================================================================
// DATA TRANSFORMATION
// =============================================================================

/**
 * Fetch Recurly account data for a given account code.
 *
 * @param {string} accountCode - The Recurly account code (Overleaf user ID)
 * @returns {Promise<Account>}
 */
async function fetchRecurlyData(accountCode, context) {
  return await rateLimiters.requestWithRetries(
    'recurly',
    () => recurlyClient.getAccount(`code-${accountCode}`),
    context
  )
}

/**
 * Fetch live Recurly subscriptions for an account and ensure there is at most one.
 *
 * Returns the subscription object, or null if no live subscription exists.
 * Throws if more than one live subscription exists.
 *
 * @param {string} accountCode - Recurly account code
 * @param {object} context - Logging context
 * @returns {Promise<object|null>}
 */
async function fetchRecurlyActiveSubscription(accountCode, context) {
  const subscriptions = await rateLimiters.requestWithRetries(
    'recurly',
    async () => {
      const pager = recurlyClient.listAccountSubscriptions(
        `code-${accountCode}`,
        {
          params: { state: 'live' },
        }
      )

      // we don't strictly need to fetch all subscriptions since we only
      // care if there is one or more than one, but this is an unlikely
      // edge case and knowing the actual number may be helpful for debugging, so we fetch them all
      const results = []
      for await (const subscription of pager.each()) {
        results.push(subscription)
      }
      return results
    },
    context
  )

  if (subscriptions.length > 1) {
    const subscriptionIds = subscriptions
      .map(subscription => subscription?.id)
      .filter(Boolean)

    throw new Error(
      `Expected at most one live Recurly subscription for account ${accountCode}, found ${subscriptions.length}${
        subscriptionIds.length > 0 ? ` (${subscriptionIds.join(', ')})` : ''
      }`
    )
  }

  return subscriptions[0] ?? null
}

/**
 * Fetch existing customer from the target Stripe account by ID.
 *
 * @param {Stripe} stripeClient - The Stripe client for the target account
 * @param {string} stripeCustomerId - The Stripe customer ID
 * @returns {Promise<Stripe.Customer>}
 * @throws {Error} If customer is not found or is deleted
 */
async function fetchTargetStripeCustomer(
  stripeClient,
  stripeCustomerId,
  context
) {
  const customer = await rateLimiters.requestWithRetries(
    stripeClient.serviceName,
    () =>
      stripeClient.customers.retrieve(stripeCustomerId, {
        expand: ['subscriptions'],
      }),
    { ...context, stripeApi: 'customers.retrieve' }
  )

  if (customer.deleted) {
    throw new Error(`Stripe customer ${stripeCustomerId} has been deleted`)
  }

  return customer
}

/**
 * Query for other matching customers from the target Stripe account by ID.
 *
 * @param {Stripe} stripeClient - The Stripe client for the target account
 * @param {string} userId - The user id to query
 * @param {string} stripeCustomerId - The Stripe customer ID to exclude from results (if any)
 * @param {object} context - Context for logging and rate limiter identification
 * @returns {Promise<Stripe.Customer | null>}
 */
async function fetchOtherStripeCustomerByUserId(
  stripeClient,
  userId,
  stripeCustomerId,
  context
) {
  const results = await rateLimiters.requestWithRetries(
    stripeClient.serviceName,
    () =>
      stripeClient.customers.search({
        query: `metadata['userId']:"${userId}"`,
        limit: 100,
        expand: ['data.subscriptions'],
      }),
    { ...context, stripeApi: 'customers.search' }
  )

  const matchingCustomers = results.data?.filter(
    customer => customer.id !== stripeCustomerId
  )

  if (matchingCustomers.length > 1) {
    throw new Error(
      `Multiple Stripe customers found with userId metadata "${userId}": ${matchingCustomers.map(c => c.id).join(', ')}`
    )
  }

  return matchingCustomers[0] || null
}

/**
 * Mark a Stripe customer as a duplicate of another customer.
 *
 * @param {Stripe} stripeClient
 * @param {string} stripeCustomerId
 * @param {string} recurlyAccountCode
 * @param {object} context
 * @returns {Promise<void>}
 */
async function markCustomerAsDuplicate(
  stripeClient,
  stripeCustomerId,
  recurlyAccountCode,
  context
) {
  const email =
    Settings.duplicateStripeCustomerAccountEmail?.replace(
      '@',
      `+${stripeCustomerId}@`
    ) || ''
  await rateLimiters.requestWithRetries(
    stripeClient.serviceName,
    () =>
      stripeClient.customers.update(stripeCustomerId, {
        email,
        metadata: {
          userId: '',
          duplicateUserId: recurlyAccountCode,
        },
      }),
    { ...context, stripeApi: 'customers.update' }
  )
}

/**
 * Fetch existing customer's payment method from the target Stripe account by ID.
 *
 * @param {Stripe} stripeClient - The Stripe client for the target account
 * @param {string} stripeCustomerId - The Stripe customer ID
 * @returns {Promise<Stripe.PaymentMethod[]>}
 */
async function fetchTargetStripeCustomerPaymentMethods(
  stripeClient,
  stripeCustomerId,
  context
) {
  const paymentMethods = await rateLimiters.requestWithRetries(
    stripeClient.serviceName,
    () => stripeClient.customers.listPaymentMethods(stripeCustomerId),
    { ...context, stripeApi: 'customers.listPaymentMethods' }
  )
  return paymentMethods.data
}

/**
 * Creates a Stripe Setup Intent to import a PayPal billing agreement.
 *
 * @param {Stripe} stripeClient - The Stripe client for the target account
 * @param {string} stripeCustomerId - The Stripe customer ID
 * @param {string} billingAgreementId - The PayPal billing agreement ID
 * @param {object} context - Logging context
 * @returns {Promise<Stripe.PaymentMethod>}
 * @throws {Error} If the setup intent fails or does not produce a payment method
 */
async function createPayPalPaymentMethod(
  stripeClient,
  stripeCustomerId,
  billingAgreementId,
  context
) {
  logDebug(
    'Creating PayPal setup intent',
    {
      ...context,
      step: 'create_paypal_setup_intent',
    },
    { verboseOnly: true }
  )

  const setupIntent = await rateLimiters.requestWithRetries(
    stripeClient.serviceName,
    () =>
      stripeClient.setupIntents.create({
        customer: stripeCustomerId,
        payment_method_types: ['paypal'],
        payment_method_data: {
          type: 'paypal',
        },
        payment_method_options: {
          paypal: {
            billing_agreement_id: billingAgreementId,
          },
        },
        confirm: true,
        usage: 'off_session',
        mandate_data: {
          customer_acceptance: {
            type: 'offline',
          },
        },
        return_url: `${Settings.siteUrl}/user/subscription`, // required for PayPal setup intents, but not actually used since we're confirming immediately
        expand: ['payment_method'],
      }),
    { ...context, stripeApi: 'setupIntents.create' }
  )

  if (setupIntent.status !== 'succeeded') {
    throw new Error(
      `PayPal setup intent ${setupIntent.id} has unexpected status: ${setupIntent.status}`
    )
  }

  if (!setupIntent.payment_method) {
    throw new Error(
      `PayPal setup intent ${setupIntent.id} succeeded but has no payment_method`
    )
  }

  logDebug(
    'Successfully created PayPal setup intent',
    {
      ...context,
      setupIntentId: setupIntent.id,
      paymentMethodId: setupIntent.payment_method.id,
    },
    { verboseOnly: true }
  )

  // The setup intent returns the full payment method object, but we only need the ID
  // to set it as the default on the customer.
  return setupIntent.payment_method
}

/**
 * Determines the payment method to set on the Stripe customer.
 *
 * This handles both migrating a PayPal billing agreement and matching an existing
 * credit card payment method.
 *
 * @param {Stripe} stripeClient - The Stripe client for the target account
 * @param {string} stripeCustomerId - The Stripe customer ID
 * @param {object} billingInfo - Recurly billing info object
 * @param {object} address - The customer's address (used for PayPal country check)
 * @param {boolean} commit - Whether this is a dry-run or a commit
 * @param {object} context - Logging context
 * @returns {Promise<Stripe.PaymentMethod>}
 * @throws {Error} If the payment method cannot be determined or created
 */
async function getPaymentMethod(
  stripeClient,
  stripeCustomerId,
  billingInfo,
  address,
  commit,
  context
) {
  if (billingInfo?.paymentMethod?.object === 'paypal_billing_agreement') {
    const addressCountry = address?.country
    if (
      addressCountry === 'CA' ||
      addressCountry === 'US' ||
      stripeClient.serviceName === 'stripe-us'
    ) {
      throw new Error(
        `PayPal billing agreement migration is not supported for ${addressCountry} customers`
      )
    }

    if (commit) {
      return await createPayPalPaymentMethod(
        stripeClient,
        stripeCustomerId,
        billingInfo.paymentMethod.billingAgreementId,
        context
      )
    } else {
      logDebug('DRY RUN: Would create PayPal setup intent', context, {
        verboseOnly: true,
      })
      // Return a placeholder for dry-run output
      return { id: 'pm_placeholder_paypal_dry_run', type: 'paypal' }
    }
  }

  const paymentMethods = await fetchTargetStripeCustomerPaymentMethods(
    stripeClient,
    stripeCustomerId,
    context
  )
  return coalesceOrThrowPaymentMethod(
    paymentMethods,
    stripeCustomerId,
    billingInfo
  )
}

/**
 * Replace a customer's tax IDs (delete any existing, then create the desired one).
 *
 * This makes re-runs more predictable for customers where a tax ID was created
 * before a later step failed.
 */
async function replaceCustomerTaxIds(
  stripeClient,
  stripeCustomerId,
  { taxIdType, vatNumber },
  context
) {
  // Stripe customers can have multiple tax IDs. For this migration, we want a single
  // authoritative tax ID derived from Recurly, so we remove any existing ones first.
  const existingTaxIds = []

  let startingAfter
  while (true) {
    const page = await rateLimiters.requestWithRetries(
      stripeClient.serviceName,
      () =>
        stripeClient.customers.listTaxIds(stripeCustomerId, {
          limit: 100,
          ...(startingAfter ? { starting_after: startingAfter } : {}),
        }),
      { ...context, stripeApi: 'customers.listTaxIds' }
    )

    existingTaxIds.push(...page.data)

    if (!page.has_more || page.data.length === 0) break
    startingAfter = page.data[page.data.length - 1].id
  }

  if (existingTaxIds.length > 0) {
    logDebug(
      'Deleting existing Stripe tax IDs before creating new one',
      {
        ...context,
        existingTaxIdCount: existingTaxIds.length,
      },
      { verboseOnly: true }
    )

    for (const taxId of existingTaxIds) {
      await rateLimiters.requestWithRetries(
        stripeClient.serviceName,
        () => stripeClient.customers.deleteTaxId(stripeCustomerId, taxId.id),
        { ...context, stripeApi: 'customers.deleteTaxId' }
      )
    }
  }

  try {
    return await rateLimiters.requestWithRetries(
      stripeClient.serviceName,
      () =>
        stripeClient.customers.createTaxId(stripeCustomerId, {
          type: taxIdType,
          value: vatNumber,
        }),
      { ...context, stripeApi: 'customers.createTaxId' }
    )
  } catch (error) {
    const parts = [
      `Failed to create Stripe tax ID (type=${taxIdType}, value=${vatNumber})`,
    ]
    if (error.code) parts.push(`code=${error.code}`)
    if (error.message) parts.push(error.message)
    const wrappedError = new Error(parts.join(': '))
    wrappedError.code = error.code
    wrappedError.type = error.type
    wrappedError.statusCode = error.statusCode
    throw wrappedError
  }
}

function isStripeTaxIdInvalidError(error) {
  if (!error) return false

  return error.code === 'tax_id_invalid'
}

function normalizeComparableString(value) {
  if (value == null) return ''
  return String(value).trim()
}

const STRIPE_METADATA_MAX_ALT_EMAILS = 5

function ccEmailsToArray(ccEmails) {
  if (ccEmails == null || ccEmails === undefined) {
    return []
  }

  // regex splits on commas, semicolons or whitespace and trims each email
  // empty values are filtered out
  const normalisedEmails = String(ccEmails)
    .split(/[\s,;]+/)
    .filter(Boolean)

  const deDupedEmails = [...new Set(normalisedEmails)]

  return deDupedEmails
}

function hasAnyAddressValue(address) {
  if (!address || typeof address !== 'object') return false
  return Object.values(address).some(v => normalizeComparableString(v) !== '')
}

function normalizeComparableAddress(address) {
  if (!address || typeof address !== 'object') return null

  const norm = {
    line1: normalizeComparableString(address.line1),
    line2: normalizeComparableString(address.line2),
    city: normalizeComparableString(address.city),
    state: normalizeComparableString(address.state),
    postal_code: normalizeComparableString(address.postal_code),
    country: normalizeComparableString(address.country).toUpperCase(),
  }

  return hasAnyAddressValue(norm) ? norm : null
}

function addressesEqual(a, b) {
  const na = normalizeComparableAddress(a)
  const nb = normalizeComparableAddress(b)
  if (!na && !nb) return true
  if (!na || !nb) return false

  return (
    na.line1 === nb.line1 &&
    na.line2 === nb.line2 &&
    na.city === nb.city &&
    na.state === nb.state &&
    na.postal_code === nb.postal_code &&
    na.country === nb.country
  )
}

// =============================================================================
// MAIN PROCESSING
// =============================================================================

/**
 * Resolve the Stripe customer for a given Recurly account.
 *
 * Handles three cases:
 * 1. Another customer with matching userId metadata exists when no stripeCustomerId is provided → reuse it
 * 2. No stripeCustomerId provided → create a new customer (or placeholder in dry-run)
 * 3. stripeCustomerId provided → fetch the existing customer
 *
 * @param {object} params
 * @param {Stripe} params.stripeClient - Stripe SDK client for the target account
 * @param {string|null} params.stripeCustomerId - Stripe customer ID from the input CSV (may be empty)
 * @param {string} params.recurlyAccountCode - Recurly account code / Overleaf user ID
 * @param {object} params.account - Recurly account object (used for email on create)
 * @param {boolean} params.commit - Whether to actually create/fetch in Stripe
 * @param {object} params.context - Logging context
 * @param {object} params.stripeContext - Stripe-specific logging context
 * @returns {Promise<Stripe.Customer|object>} - The resolved Stripe customer object (or placeholder in dry-run)
 * @throws {Error} if there are multiple matching customers found
 */
async function resolveStripeCustomer({
  stripeClient,
  stripeCustomerId,
  recurlyAccountCode,
  account,
  commit,
  context,
  stripeContext,
}) {
  const otherMatchingCustomer = await fetchOtherStripeCustomerByUserId(
    stripeClient,
    recurlyAccountCode,
    stripeCustomerId,
    stripeContext
  )

  if (otherMatchingCustomer) {
    if (stripeCustomerId) {
      const otherCustomerPaymentMethods =
        await fetchTargetStripeCustomerPaymentMethods(
          stripeClient,
          otherMatchingCustomer.id,
          stripeContext
        )
      const isRecurlyPaymentMethodPaypal =
        account?.billingInfo?.paymentMethod?.object ===
        'paypal_billing_agreement'
      const isRecurlyPaymentMethodManual = !account?.billingInfo?.paymentMethod // billing info may be missing for manually billed customers
      const hasMatchingPaymentMethod = otherCustomerPaymentMethods.some(
        method =>
          areStripeAndRecurlyCardDetailsEqual(
            method,
            account?.billingInfo?.paymentMethod
          )
      )
      if (
        isRecurlyPaymentMethodPaypal ||
        isRecurlyPaymentMethodManual ||
        hasMatchingPaymentMethod
      ) {
        logDebug(
          'Found another Stripe customer with matching userId metadata, reusing',
          {
            ...context,
            nextStripeCustomerId: otherMatchingCustomer.id,
          },
          { verboseOnly: true }
        )
        if (commit) {
          await markCustomerAsDuplicate(
            stripeClient,
            stripeCustomerId,
            recurlyAccountCode,
            stripeContext
          )
          logDebug(
            'Marked CSV customer as a duplicate of the existing Stripe customer',
            {
              ...context,
              nextStripeCustomerId: otherMatchingCustomer.id,
            },
            { verboseOnly: true }
          )
        } else {
          logDebug(
            'DRY RUN: Would mark CSV customer as a duplicate of the existing Stripe customer',
            {
              ...context,
              nextStripeCustomerId: otherMatchingCustomer.id,
              step: 'mark_duplicate',
            },
            { verboseOnly: true }
          )
        }
        return otherMatchingCustomer
      } else {
        throw new Error(
          `Found another Stripe customer with matching userId metadata but no matching payment method: ${otherMatchingCustomer.id}`
        )
      }
    }

    logDebug(
      'Found Stripe customer with matching userId metadata, reusing',
      { ...context, otherStripeCustomerId: otherMatchingCustomer.id },
      { verboseOnly: true }
    )
    return otherMatchingCustomer
  }

  if (!stripeCustomerId) {
    if (commit) {
      const newCustomer = await rateLimiters.requestWithRetries(
        stripeClient.serviceName,
        () =>
          stripeClient.customers.create({
            email: account.email,
            metadata: { userId: recurlyAccountCode },
          }),
        { ...stripeContext, stripeApi: 'customers.create' }
      )
      logDebug(
        'Created new Stripe customer',
        { ...context, newStripeCustomerId: newCustomer.id },
        { verboseOnly: true }
      )
      return newCustomer
    }

    logDebug(
      'DRY RUN: Would create new Stripe customer',
      { ...context, step: 'create_stripe_customer' },
      { verboseOnly: true }
    )
    return {
      id: 'cus_dry_run_new_customer_placeholder',
      metadata: { userId: recurlyAccountCode },
    }
  }

  logDebug(
    'Fetching existing Stripe customer',
    { ...context, step: 'fetch_stripe_customer' },
    { verboseOnly: true }
  )
  const customer = await fetchTargetStripeCustomer(
    stripeClient,
    stripeCustomerId,
    stripeContext
  )
  logDebug(
    'Resolved existing Stripe customer',
    { ...context, stripeEmail: customer.email, stripeName: customer.name },
    { verboseOnly: true }
  )
  return customer
}

/**
 * Compute the billing_details params for a Stripe payment method from Recurly billing info.
 *
 * @param {object} billingInfo - Recurly billing info object
 * @returns {object|null} - billing_details params, or null if there is nothing to set
 */
function computePaymentMethodBillingDetails(billingInfo) {
  const name = normalizeName(billingInfo?.firstName, billingInfo?.lastName)
  const address = normalizeRecurlyAddressToStripe(billingInfo?.address)

  const details = {}
  if (name) details.name = name
  if (address) details.address = address

  return Object.keys(details).length > 0 ? details : null
}

/**
 * Update billing_details on a Stripe payment method with data from Recurly billing info.
 *
 * Used for manual-collection customers when billing info and account info differ:
 * the account info is written to the Stripe customer record, and the billing info
 * is copied to the payment method's billing_details.
 *
 * @param {Stripe} stripeClient
 * @param {string} paymentMethodId
 * @param {object} billingInfo - Recurly billing info object
 * @param {object} context
 * @returns {Promise<void>}
 */
async function updatePaymentMethodBillingDetails(
  stripeClient,
  paymentMethodId,
  billingInfo,
  context
) {
  const billingDetails = computePaymentMethodBillingDetails(billingInfo)
  if (!billingDetails) {
    logDebug(
      'No billing info details to copy to payment method billing_details',
      context,
      { verboseOnly: true }
    )
    return
  }

  logDebug(
    'Updating payment method billing_details with Recurly billing info',
    {
      ...context,
      paymentMethodId,
      step: 'update_payment_method_billing_details',
    },
    { verboseOnly: true }
  )
  await rateLimiters.requestWithRetries(
    stripeClient.serviceName,
    () =>
      stripeClient.paymentMethods.update(paymentMethodId, {
        billing_details: billingDetails,
      }),
    { ...context, stripeApi: 'paymentMethods.update' }
  )
  logDebug(
    'Successfully updated payment method billing_details',
    { ...context, paymentMethodId },
    { verboseOnly: true }
  )
}

/**
 * Resolve customer name, address, company, and VAT number from Recurly account data.
 *
 * For most customers, billing info and account info agree (or only one source is set),
 * and the standard coalesce logic applies (billing info preferred, account as fallback).
 *
 * When any field has conflicting values across both sources, the subscription's
 * collection_method is fetched to determine which source wins:
 *
 * - automatic (web sales): billing info is used for the Stripe customer record.
 * - manual (manual billing): account info is used for the Stripe customer record,
 *   and billing info is returned separately to be copied to the payment method's
 *   billing_details.
 *
 * @param {object} account - Recurly account object
 * @param {string} recurlyAccountCode - Account code (used for subscription lookup on conflict)
 * @param {object} context - Logging context
 * @returns {Promise<{
 *   name: string|null,
 *   address: import('stripe').Stripe.AddressParam|null,
 *   companyName: string|null,
 *   vatNumber: string|null,
 *   collectionMethod: string|null,
 *   billingInfoForPaymentMethod: object|null
 * }>}
 */
async function resolveCustomerIdentity(account, recurlyAccountCode, context) {
  // Detect conflicts between billing info and account fields
  const billingName = extractNameFromBillingInfo(account)
  const accountName = extractNameFromAccount(account)
  const nameConflict =
    billingName !== null && accountName !== null && billingName !== accountName

  const billingAddress = normalizeRecurlyAddressToStripe(
    account.billingInfo?.address
  )
  const accountAddress = normalizeRecurlyAddressToStripe(account?.address)
  const addressConflict =
    billingAddress !== null &&
    accountAddress !== null &&
    !addressesEqual(billingAddress, accountAddress)

  const billingCompany = account.billingInfo?.company?.trim() || null
  const accountCompany = account.company?.trim() || null
  const companyConflict =
    billingCompany !== null &&
    accountCompany !== null &&
    billingCompany !== accountCompany

  const billingVat = account.billingInfo?.vatNumber?.trim() || null
  const accountVat = account?.vatNumber?.trim() || null
  const vatConflict =
    billingVat !== null && accountVat !== null && billingVat !== accountVat

  const hasConflict =
    nameConflict || addressConflict || companyConflict || vatConflict

  let name,
    address,
    companyName,
    vatNumber,
    collectionMethod,
    billingInfoForPaymentMethod

  if (!hasConflict) {
    // No conflict: use the standard coalesce logic (billing info preferred)
    name = billingName ?? accountName
    address = billingAddress ?? accountAddress
    companyName = billingCompany ?? accountCompany
    vatNumber = billingVat ?? accountVat
    collectionMethod = null
    billingInfoForPaymentMethod = null
  } else {
    // Conflict detected: fetch the subscription to determine which source wins
    logWarn(
      'Conflict between billing info and account fields; fetching subscription collection method to resolve',
      {
        ...context,
        nameConflict,
        addressConflict,
        companyConflict,
        vatConflict,
      }
    )

    const subscription = await fetchRecurlyActiveSubscription(
      recurlyAccountCode,
      context
    )
    collectionMethod = subscription?.collectionMethod || null

    if (!collectionMethod) {
      throw new Error(
        'Conflict between billing info and account fields, but no live subscription found to determine collection method'
      )
    }

    logDebug(
      'Resolving billing info / account conflict using subscription collection method',
      {
        ...context,
        collectionMethod,
        nameConflict,
        addressConflict,
        companyConflict,
        vatConflict,
      },
      { verboseOnly: true }
    )

    if (collectionMethod === 'automatic') {
      // Web sales: use billing info for the Stripe customer record
      name = billingName ?? accountName
      address = billingAddress ?? accountAddress
      companyName = billingCompany ?? accountCompany
      vatNumber = billingVat ?? accountVat
      billingInfoForPaymentMethod = null
    } else if (collectionMethod === 'manual') {
      // Manual billing: use account info for the Stripe customer record,
      // and return billing info to be copied to the payment method's billing_details
      name = accountName ?? billingName
      address = accountAddress ?? billingAddress
      companyName = accountCompany ?? billingCompany
      vatNumber = accountVat ?? billingVat
      billingInfoForPaymentMethod = account.billingInfo
    } else {
      throw new Error(
        `Unknown collection method "${collectionMethod}" encountered while resolving billing info / account conflict`
      )
    }
  }

  // Normalise GB VAT numbers using the resolved address country
  if (vatNumber && address?.country === 'GB') {
    vatNumber = normalisedGBVATNumber(vatNumber)
  }

  return {
    name,
    address,
    companyName,
    vatNumber,
    collectionMethod,
    billingInfoForPaymentMethod,
  }
}

/**
 * Process a single customer row from the input CSV.
 *
 * Customers are expected to already exist in the target Stripe account
 * (created via PAN import). This function updates them with additional
 * data from Recurly.
 *
 * @param {object} row - CSV row with recurly_account_code, target_stripe_account, stripe_customer_id
 * @param {number} rowNumber - The row number in the input file (for logging)
 * @param {boolean} commit - Whether to actually update the customer
 * @returns {Promise<object>} - Result row for output CSV
 */
async function processCustomer(
  row,
  rowNumber,
  commit,
  { writeStripeExistingFields, forceInvalidTax = false } = {}
) {
  const {
    recurly_account_code: recurlyAccountCode,
    target_stripe_account: targetStripeAccount,
  } = row
  let stripeCustomerId = row.stripe_customer_id

  const context = {
    rowNumber,
    recurlyAccountCode,
    targetStripeAccount,
    stripeCustomerId,
  }

  const stripeContext = {
    rowNumber,
    stripeCustomerId,
    stripeAccount: targetStripeAccount,
  }

  const result = {
    recurly_account_code: recurlyAccountCode,
    target_stripe_account: targetStripeAccount,
    stripe_customer_id: stripeCustomerId || '',
    outcome: '', // 'updated', 'dry_run', or 'error'
    error: '',
    customerParams: null, // Stripe customer params (for dry-run output)
    taxInfoPending: null, // Recurly VAT number if tax ID type couldn't be determined
  }

  try {
    // Validate required fields
    if (!recurlyAccountCode) {
      throw new Error('Missing required field: recurly_account_code')
    }
    if (!targetStripeAccount) {
      throw new Error('Missing required field: target_stripe_account')
    }

    // Get Stripe client for target account
    logDebug(
      'Getting Stripe client',
      { ...context, step: 'get_stripe_client' },
      { verboseOnly: true }
    )
    // get Stripe client for the target account (strip 'stripe-' prefix if present)
    const region = String(targetStripeAccount || '')
      .trim()
      .toLowerCase()
      .replace(/^stripe-/, '')
    const stripeClient = getRegionClient(region)

    // Fetch Recurly data
    logDebug(
      'Fetching Recurly data',
      { ...context, step: 'fetch_recurly' },
      { verboseOnly: true }
    )
    const account = await fetchRecurlyData(recurlyAccountCode, context)

    logDebug(
      'Fetched Recurly account',
      {
        ...context,
        email: account.email,
        hasBillingInfo: !!account.billingInfo,
        paymentMethod:
          account.billingInfo?.paymentMethod?.object ===
          'paypal_billing_agreement'
            ? 'paypal'
            : account.billingInfo?.cardType || 'none',
        account: sanitizeAccount(account),
      },
      { verboseOnly: true }
    )

    const existingCustomer = await resolveStripeCustomer({
      stripeClient,
      stripeCustomerId,
      recurlyAccountCode,
      account,
      commit,
      context,
      stripeContext,
    })
    stripeCustomerId = existingCustomer.id
    result.stripe_customer_id = stripeCustomerId || ''
    stripeContext.stripeCustomerId = stripeCustomerId
    context.stripeCustomerId = stripeCustomerId

    if (existingCustomer.subscriptions?.data.length > 0) {
      throw new Error(
        `Stripe customer ${stripeCustomerId} already has ${existingCustomer.subscriptions?.data?.length} active subscription(s).`
      )
    }

    // Resolve customer identity (name, address, company, VAT number), handling
    // conflicts between billing info and account fields via the subscription's
    // collection_method.
    const {
      name,
      address,
      companyName,
      vatNumber,
      billingInfoForPaymentMethod,
    } = await resolveCustomerIdentity(account, recurlyAccountCode, context)

    if (name === null && companyName === null) {
      // This should not happen since we're handling all the known cases in resolveCustomerIdentity but just in case
      throw new Error(
        'Unable to resolve customer name: both billing info and account fields are missing'
      )
    }

    let taxIdType = null
    let createdTaxId = null
    let taxInfoPendingValue = null

    // Determine VAT number tax ID type (if possible)
    if (vatNumber) {
      const preValidateFormat = !commit
      const taxIdTypeResult = getTaxIdType(
        address?.country,
        vatNumber,
        address?.postal_code,
        preValidateFormat
      )
      taxIdType = taxIdTypeResult.type
      const taxIdTypeFailureReason = taxIdTypeResult.reason

      if (!address?.country) {
        if (!forceInvalidTax) {
          throw new Error(
            `Unprocessable VAT number ${vatNumber} (no country): ${taxIdTypeFailureReason}`
          )
        }
        logWarn('VAT number present but no country in address', {
          ...context,
          vatNumber,
          reason: taxIdTypeFailureReason,
        })
        taxInfoPendingValue = vatNumber
      } else if (!taxIdType) {
        if (!forceInvalidTax) {
          throw new Error(
            `Unprocessable VAT number ${vatNumber} (failed getTaxIdType): ${taxIdTypeFailureReason}`
          )
        }
        logWarn('Unable to determine tax id type for VAT number', {
          ...context,
          vatNumber,
          country: address?.country,
          postalCode: address?.postal_code,
          reason: taxIdTypeFailureReason,
        })
        taxInfoPendingValue = vatNumber
      } else {
        logDebug(
          'Will create tax ID',
          {
            ...context,
            vatNumber,
            country: address?.country,
            taxIdType,
          },
          { verboseOnly: true }
        )
      }
    }

    const shouldCreateTaxId = !!(vatNumber && taxIdType && !taxInfoPendingValue)

    if (commit) {
      // Create tax ID first (validate it works before updating customer)
      if (shouldCreateTaxId) {
        logDebug(
          'Creating tax ID',
          {
            ...context,
            step: 'create_tax_id',
            taxIdType,
            vatNumber,
          },
          { verboseOnly: true }
        )

        // Note: if re-running for a customer where the vatNumber was previously present in Recurly
        // but removed since the last run, this code will not erase that vatNumber from Stripe.
        // unlikely to ever occur but worth noting
        try {
          createdTaxId = await replaceCustomerTaxIds(
            stripeClient,
            stripeCustomerId,
            { taxIdType, vatNumber },
            context
          )
          logDebug(
            'Successfully created tax ID',
            {
              ...context,
              taxId: createdTaxId.id,
              taxIdType: createdTaxId.type,
              taxIdValue: createdTaxId.value,
            },
            { verboseOnly: true }
          )
        } catch (error) {
          if (forceInvalidTax && isStripeTaxIdInvalidError(error)) {
            logWarn(
              'Stripe rejected tax ID as invalid; continuing because --force-invalid-tax is enabled',
              {
                ...context,
                vatNumber,
                country: address?.country,
                taxIdType,
                error: error.message,
              }
            )
            taxInfoPendingValue = vatNumber
          } else {
            throw error
          }
        }
      }
    }

    // Transform Recurly data to Stripe customer update params
    logDebug(
      'Transforming Recurly data to Stripe params',
      {
        ...context,
        step: 'transform',
      },
      { verboseOnly: true }
    )

    const paymentMethod = await getPaymentMethod(
      stripeClient,
      stripeCustomerId,
      account.billingInfo,
      address,
      commit,
      stripeContext
    )

    /** @type {Record<string, string>} */
    const metadata = {}
    if (account.createdAt) {
      metadata.recurlyCreatedAt = account.createdAt.toISOString()
    }
    if (taxInfoPendingValue) {
      metadata.taxInfoPending = taxInfoPendingValue
    } else {
      metadata.taxInfoPending = ''
    }

    if (
      existingCustomer.metadata?.recurlyAccountCode &&
      existingCustomer.metadata?.recurlyAccountCode !== recurlyAccountCode
    ) {
      throw new Error(
        `Existing Stripe customer has unexpected recurlyAccountCode: (expected) ${recurlyAccountCode} (actual) ${existingCustomer.metadata?.recurlyAccountCode}`
      )
    }
    if (
      existingCustomer.metadata?.userId &&
      existingCustomer.metadata?.userId !== recurlyAccountCode
    ) {
      throw new Error(
        `Existing Stripe customer has unexpected userId: (expected) ${recurlyAccountCode} (actual) ${existingCustomer.metadata?.userId}`
      )
    }
    metadata.recurlyAccountCode = ''
    metadata.userId = recurlyAccountCode

    const { metadata: customFieldMetadata, counts: customFieldCounts } =
      extractRecurlyCustomFieldMetadata(account)

    if (Object.keys(customFieldMetadata).length > 0) {
      Object.assign(metadata, customFieldMetadata)
    }

    const ccEmailList = ccEmailsToArray(account.ccEmails)
    if (ccEmailList.length > STRIPE_METADATA_MAX_ALT_EMAILS) {
      // this limit is arbitrary just to catch any extreme outliers
      throw new Error(
        `Customer has ${ccEmailList.length} ccEmails; max supported is ${STRIPE_METADATA_MAX_ALT_EMAILS}`
      )
    }
    ccEmailList.forEach(email => {
      if (email.length > 500) {
        // The limit for account.email is 512 characters.
        // assuming similar for additional_emails.cc but 500 is plenty
        // as the longest ccEmails in Recurly is 179
        throw new Error(
          `Recurly ${recurlyAccountCode}: ccEmail ${email} exceeds the maximum length of 500 characters`
        )
      }
    })

    // if there are any ccEmails in Recurly or Stripe,
    // then overwrite additional_emails.cc below with the Recurly value preserving any other fields
    // that might exist in additional_emails in Stripe
    const updateCCEmails =
      ccEmailList.length > 0 ||
      existingCustomer.additional_emails?.cc?.length > 0

    result.customFieldCounts = customFieldCounts

    /** @type {Stripe.CustomerUpdateParams} */
    const customerParams = {
      email: account.email,
      name,
      metadata,
      ...(address ? { address } : {}),
      ...(companyName ? { business_name: companyName } : {}),
      ...(paymentMethod
        ? { invoice_settings: { default_payment_method: paymentMethod.id } }
        : {}),
      ...(updateCCEmails
        ? {
            additional_emails: {
              ...existingCustomer.additional_emails,
              cc: ccEmailList,
            },
          }
        : {}),
      // Recurly docs say the field is tax_exempt but in the actual response is taxExempt
      tax_exempt: account.taxExempt ? 'exempt' : 'none',
    }

    // If Stripe already has any of the fields we're about to set, and the value is
    // different from what we'd set, warn and capture both desired and existing.
    const differingFields = []

    if (
      customerParams?.name != null &&
      normalizeComparableString(existingCustomer?.name) !== '' &&
      normalizeComparableString(existingCustomer?.name) !==
        normalizeComparableString(customerParams.name)
    ) {
      differingFields.push('name')
    }

    if (
      customerParams?.business_name != null &&
      normalizeComparableString(existingCustomer?.business_name) !== '' &&
      normalizeComparableString(existingCustomer?.business_name) !==
        normalizeComparableString(customerParams.business_name)
    ) {
      differingFields.push('business_name')
    }

    if (
      customerParams?.address &&
      hasAnyAddressValue(existingCustomer?.address) &&
      !addressesEqual(existingCustomer.address, customerParams.address)
    ) {
      differingFields.push('address')
    }

    if (differingFields.length > 0) {
      logWarn('Stripe customer already has differing fields set', {
        ...context,
        fields: differingFields,
      })

      if (writeStripeExistingFields) {
        writeStripeExistingFields({
          recurly_account_code: recurlyAccountCode,
          stripe_account: targetStripeAccount,
          stripe_customer_id: stripeCustomerId,
          recurly: {
            ...(differingFields.includes('name')
              ? { name: customerParams.name }
              : {}),
            ...(differingFields.includes('business_name')
              ? { business_name: customerParams.business_name }
              : {}),
            ...(differingFields.includes('address')
              ? { address: customerParams.address }
              : {}),
          },
          stripe: {
            ...(differingFields.includes('name')
              ? { name: existingCustomer.name }
              : {}),
            ...(differingFields.includes('business_name')
              ? { business_name: existingCustomer.business_name }
              : {}),
            ...(differingFields.includes('address')
              ? { address: existingCustomer.address }
              : {}),
          },
        })
      }
    }

    logDebug(
      'Transformed customer params',
      {
        ...context,
        params: customerParams,
      },
      { verboseOnly: true }
    )

    if (commit) {
      // Update customer in Stripe
      logDebug(
        'Updating Stripe customer',
        {
          ...context,
          step: 'update_customer',
        },
        { verboseOnly: true }
      )
      await rateLimiters.requestWithRetries(
        stripeClient.serviceName,
        () => stripeClient.customers.update(stripeCustomerId, customerParams),
        { ...stripeContext, stripeApi: 'customers.update' }
      )

      // For manual-collection customers where billing info and account info differ,
      // copy the billing info to the payment method's billing_details.
      //
      // Note: If re-running this script for a given customer,
      // then if by some chance the payment collection method has changed from automatic to manual since the last run,
      // then we would potentially leave billing details in an inconsistent state
      // I think this is vanishingly unlikely to be an issue in practice and a tricky problem to solve
      // Highlighting here just in case.
      if (billingInfoForPaymentMethod && paymentMethod) {
        await updatePaymentMethodBillingDetails(
          stripeClient,
          paymentMethod.id,
          billingInfoForPaymentMethod,
          { ...context, step: 'update_payment_method_billing_details' }
        )
      }

      result.outcome = 'updated'
      logDebug(
        'Successfully updated Stripe customer',
        {
          ...context,
        },
        { verboseOnly: true }
      )
    } else {
      result.outcome = 'dry_run'
      result.customerParams = {
        ...customerParams,
        // Include tax ID info in dry-run output for review
        _taxId: shouldCreateTaxId
          ? {
              type: taxIdType,
              value: vatNumber,
              country: address?.country,
              createdTaxId,
            }
          : null,
        _isPaypal: paymentMethod?.type === 'paypal',
        _targetStripeCustomerId: stripeCustomerId,
        // Include payment method billing_details update for dry-run review
        _paymentMethodBillingDetailsUpdate:
          billingInfoForPaymentMethod && paymentMethod
            ? {
                paymentMethodId: paymentMethod.id,
                billingDetails: computePaymentMethodBillingDetails(
                  billingInfoForPaymentMethod
                ),
              }
            : null,
      }
      logDebug(
        'DRY RUN: Would update Stripe customer',
        {
          ...context,
          email: account.email,
          taxId: vatNumber ? { type: taxIdType, value: vatNumber } : null,
        },
        { verboseOnly: true }
      )
    }

    if (taxInfoPendingValue) {
      result.taxInfoPending = taxInfoPendingValue
    }
  } catch (error) {
    result.outcome = 'error'
    // Include more error details
    const errorDetails = []
    errorDetails.push(error.message)
    if (error.code) errorDetails.push(`code=${error.code}`)
    if (error.type) errorDetails.push(`type=${error.type}`)
    if (error.statusCode) errorDetails.push(`statusCode=${error.statusCode}`)
    result.error = errorDetails.join('; ')

    logError('Failed to process customer', error, context)
  }

  return result
}

function usage() {
  console.error('Script to migrate Recurly customers to Stripe')
  console.error('')
  console.error('RESUMABLE: This script can be re-run after failures.')
  console.error(
    '           It will skip successfully processed records and retry failures.'
  )
  console.error('')
  console.error('Usage:')
  console.error(
    '  node scripts/recurly/migrate_recurly_customers_to_stripe.mjs [options]'
  )
  console.error('')
  console.error('Options:')
  console.error('  --input, -i <file>   Path to input CSV file (required)')
  console.error(
    '  --output, -o <file>  Path to SUCCESS output CSV file (required)'
  )
  console.error(
    '  --limit, -l <n>      Limit number of records processed (default: no limit)'
  )
  console.error(
    '  --concurrency, -c <n> Number of customers to process concurrently (default: 10)'
  )
  console.error(
    '  --recurly-rate-limit <n> Requests per second for Recurly (default: 10)'
  )
  console.error(
    '  --recurly-api-retries <n> Number of retries on Recurly 429s (default: 5)'
  )
  console.error(
    '  --recurly-retry-delay-ms <n> Delay between Recurly retries in ms (default: 1000)'
  )
  console.error(
    '  --stripe-rate-limit <n>  Requests per second for Stripe (default: 50)'
  )
  console.error(
    '  --stripe-api-retries <n> Number of retries on Stripe 429s (default: 5)'
  )
  console.error(
    '  --stripe-retry-delay-ms <n> Delay between Stripe retries in ms (default: 1000)'
  )
  console.error(
    '  --force-invalid-tax   Allow VAT numbers that cannot be mapped to a tax ID type (default: false)'
  )
  console.error(
    '  --commit             Actually update customers in Stripe (default: dry-run)'
  )
  console.error('  --verbose, -v         Enable debug logging')
  console.error(
    '  --restart            Ignore existing output files and start fresh'
  )
  console.error('')
  console.error('Input CSV format:')
  console.error(
    '  recurly_account_code,target_stripe_account,stripe_customer_id'
  )
  console.error('')
  console.error('Output files:')
  console.error('  SUCCESS file (--output): Successfully updated customers')
  console.error(
    '    Format: recurly_account_code,target_stripe_account,stripe_customer_id'
  )
  console.error('')
  console.error(
    '  ERRORS file (<output>_errors.csv): Records that failed THIS run'
  )
  console.error(
    '    Format: recurly_account_code,target_stripe_account,stripe_customer_id,error'
  )
  console.error('')
  console.error(
    '  STRIPE JSON (<output>_stripe.json): Dry-run only - customer params that would be used for update'
  )
  console.error('')
  console.error(
    '  STRIPE EXISTING FIELDS (<output>_stripe_existing_fields.json): Customers where Stripe already had name/address/business_name set'
  )
  console.error(
    '    Written in both dry-run and commit modes (for auditing before overwriting fields)'
  )
  console.error('')
  console.error('Resume behavior:')
  console.error('  - Records in SUCCESS file are SKIPPED (already done)')
  console.error(
    '  - Records in ERRORS file are RE-PROCESSED (retried each run)'
  )
  console.error(
    '  - After each run, ERRORS file contains ONLY failures from that run'
  )
  console.error(
    '  - Use --restart to force processing all records from scratch'
  )
}

function parseConcurrency(value, { defaultValue = 10 } = {}) {
  if (value === undefined || value === null || value === '') {
    return defaultValue
  }

  const parsed = Number(value)
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 1) {
    throw new Error(
      `Invalid --concurrency value: ${value}. Expected a positive integer.`
    )
  }

  return parsed
}

function parseRateLimit(value, { defaultValue, name }) {
  if (value === undefined || value === null || value === '') {
    return defaultValue
  }

  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(
      `Invalid --${name} value: ${value}. Expected a positive number.`
    )
  }

  return parsed
}

function parseNonNegativeInt(value, { defaultValue, name }) {
  if (value === undefined || value === null || value === '') {
    return defaultValue
  }

  const parsed = Number(value)
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 0) {
    throw new Error(
      `Invalid --${name} value: ${value}. Expected a non-negative integer.`
    )
  }

  return parsed
}

function parseArgs() {
  return minimist(process.argv.slice(2), {
    alias: {
      i: 'input',
      o: 'output',
      h: 'help',
      v: 'verbose',
      c: 'concurrency',
      l: 'limit',
    },
    string: [
      'input',
      'output',
      'limit',
      'recurly-rate-limit',
      'recurly-api-retries',
      'recurly-retry-delay-ms',
      'stripe-rate-limit',
      'stripe-api-retries',
      'stripe-retry-delay-ms',
    ],
    boolean: ['commit', 'verbose', 'help', 'restart', 'force-invalid-tax'],
    default: {
      commit: false,
      verbose: false,
      restart: false,
      'force-invalid-tax': false,
      concurrency: 10,
      'recurly-rate-limit': DEFAULT_RECURLY_RATE_LIMIT,
      'recurly-api-retries': DEFAULT_RECURLY_API_RETRIES,
      'recurly-retry-delay-ms': DEFAULT_RECURLY_RETRY_DELAY_MS,
      'stripe-rate-limit': DEFAULT_STRIPE_RATE_LIMIT,
      'stripe-api-retries': DEFAULT_STRIPE_API_RETRIES,
      'stripe-retry-delay-ms': DEFAULT_STRIPE_RETRY_DELAY_MS,
    },
  })
}

async function main(trackProgress) {
  const startTime = new Date()
  const args = parseArgs()
  const {
    input: inputPath,
    output: successOutputPath,
    commit,
    verbose,
    help,
    restart,
    'force-invalid-tax': forceInvalidTax,
    concurrency: concurrencyRaw,
    limit: limitRaw,
    'recurly-rate-limit': recurlyRateLimitRaw,
    'recurly-api-retries': recurlyApiRetriesRaw,
    'recurly-retry-delay-ms': recurlyRetryDelayMsRaw,
    'stripe-rate-limit': stripeRateLimitRaw,
    'stripe-api-retries': stripeApiRetriesRaw,
    'stripe-retry-delay-ms': stripeRetryDelayMsRaw,
  } = args

  let concurrency
  let recurlyRateLimit
  let recurlyApiRetriesValue
  let recurlyRetryDelayMsValue
  let stripeRateLimitPerSecond
  let stripeApiRetriesValue
  let stripeRetryDelayMsValue
  let limit
  try {
    concurrency = parseConcurrency(concurrencyRaw, { defaultValue: 10 })
    limit = parseNonNegativeInt(limitRaw, {
      defaultValue: null,
      name: 'limit',
    })
    recurlyRateLimit = parseRateLimit(recurlyRateLimitRaw, {
      defaultValue: DEFAULT_RECURLY_RATE_LIMIT,
      name: 'recurly-rate-limit',
    })
    recurlyApiRetriesValue = parseNonNegativeInt(recurlyApiRetriesRaw, {
      defaultValue: DEFAULT_RECURLY_API_RETRIES,
      name: 'recurly-api-retries',
    })
    recurlyRetryDelayMsValue = parseNonNegativeInt(recurlyRetryDelayMsRaw, {
      defaultValue: DEFAULT_RECURLY_RETRY_DELAY_MS,
      name: 'recurly-retry-delay-ms',
    })
    stripeRateLimitPerSecond = parseRateLimit(stripeRateLimitRaw, {
      defaultValue: DEFAULT_STRIPE_RATE_LIMIT,
      name: 'stripe-rate-limit',
    })
    stripeApiRetriesValue = parseNonNegativeInt(stripeApiRetriesRaw, {
      defaultValue: DEFAULT_STRIPE_API_RETRIES,
      name: 'stripe-api-retries',
    })
    stripeRetryDelayMsValue = parseNonNegativeInt(stripeRetryDelayMsRaw, {
      defaultValue: DEFAULT_STRIPE_RETRY_DELAY_MS,
      name: 'stripe-retry-delay-ms',
    })
  } catch (error) {
    logError(error.message)
    usage()
    process.exit(1)
  }

  // initialize rate limiters
  rateLimiters = createRateLimitedApiWrappers({
    recurlyRateLimit,
    recurlyApiRetries: recurlyApiRetriesValue,
    recurlyRetryDelayMs: recurlyRetryDelayMsValue,
    stripeRateLimit: stripeRateLimitPerSecond,
    stripeApiRetries: stripeApiRetriesValue,
    stripeRetryDelayMs: stripeRetryDelayMsValue,
    logDebug,
    logWarn,
  })

  // Set DEBUG_MODE only from CLI arg (--verbose/-v)
  DEBUG_MODE = !!verbose

  if (help || !inputPath || !successOutputPath) {
    usage()
    process.exit(help ? 0 : 1)
  }

  const errorsOutputPath = getErrorsPath(successOutputPath)
  const stripeJsonPath = getStripeJsonPath(successOutputPath)
  const stripeExistingFieldsJsonPath =
    getStripeExistingFieldsJsonPath(successOutputPath)

  const mode = commit ? 'COMMIT MODE' : 'DRY RUN MODE'
  logDebug(`Starting migration in ${mode}`, {
    inputPath,
    successOutputPath,
    errorsOutputPath,
    ...(commit ? {} : { stripeJsonPath }),
    stripeExistingFieldsJsonPath,
    concurrency,
    recurlyRateLimit,
    recurlyApiRetries: recurlyApiRetriesValue,
    recurlyRetryDelayMs: recurlyRetryDelayMsValue,
    stripeRateLimit: stripeRateLimitPerSecond,
    stripeApiRetries: stripeApiRetriesValue,
    stripeRetryDelayMs: stripeRetryDelayMsValue,
    forceInvalidTax,
    ...(limit != null ? { limit } : {}),
  })
  await trackProgress(`Starting migration in ${mode}`)

  // Load previously successfully processed records (for resume functionality).
  // IMPORTANT: commit mode uses the success file for resume/skip behavior.
  // Dry-run mode does NOT read the success file.
  let previouslyProcessed = new Set()
  if (commit && !restart) {
    try {
      previouslyProcessed = await loadSuccessfullyProcessed(successOutputPath)
      if (previouslyProcessed.size > 0) {
        logDebug(
          `Will skip ${previouslyProcessed.size} previously successful records`
        )
        await trackProgress(
          `Resuming: will skip ${previouslyProcessed.size} previously successful records`
        )
      }
    } catch (err) {
      logWarn('Could not load previous success file, starting fresh', {
        error: err.message,
      })
    }
  } else if (restart) {
    logDebug('Restart flag set, ignoring existing output files')
    await trackProgress('Restart mode: processing all records from scratch')
  }

  // Create output writers.
  // In dry-run mode, we intentionally do NOT write to the success file, because
  // commit mode uses it for resume/skip behavior.
  const {
    writeSuccess,
    writeError,
    close: closeOutputs,
  } = commit
    ? createOutputWriters(successOutputPath, errorsOutputPath, restart, {
        enableSuccessFile: true,
      })
    : createOutputWriters(successOutputPath, errorsOutputPath, true, {
        enableSuccessFile: false,
      })

  // For dry-run mode, collect Stripe customer params to write to JSON
  const stripeCustomerParams = []

  // Records where Stripe already had name/address/business_name set
  const stripeExistingFieldsWriter = createJsonArrayWriter(
    stripeExistingFieldsJsonPath
  )

  try {
    // Statistics
    let totalInInput = 0
    let processedThisRun = 0
    let queuedThisRun = 0
    let skippedPreviouslyProcessed = 0
    let updatedCount = 0
    let errorCount = 0
    let dryRunCount = 0
    let taxInfoPendingCount = 0

    const customFieldStats = {
      channel: 0,
      Industry: 0,
      ol_sales_person: 0,
      MigratedfromFreeAgent: 0,
      noCustomFields: 0,
    }

    // Track errors for final summary (just the account codes, not full results - memory efficient)
    const errorAccountCodes = []

    logDebug('Beginning to process input file', { inputPath })

    // Process input CSV - true streaming (no collecting results in memory)
    const inputStream = fs.createReadStream(inputPath)
    const parser = csv.parse({
      columns: true,
      trim: true,
      bom: true,
      skip_empty_lines: true,
      relax_column_count: true,
      relax_column_count_less: true,
    })

    inputStream.pipe(parser)

    const queue = new PQueue({ concurrency })
    const maxQueueSize = concurrency
    let lastCompletedRowNumber = 0
    let limitReached = false

    let rowNumber = 0
    try {
      for await (const row of parser) {
        rowNumber++
        totalInInput++

        const thisRowNumber = rowNumber
        const accountCode = row.recurly_account_code

        // Check if already successfully processed in a previous run
        if (previouslyProcessed.has(accountCode)) {
          skippedPreviouslyProcessed++
          logDebug(
            'Skipping previously successful record',
            {
              rowNumber: thisRowNumber,
              accountCode,
            },
            { verboseOnly: true }
          )
          continue
        }

        if (limit != null && queuedThisRun >= limit) {
          limitReached = true
          logDebug('Record limit reached, stopping input processing', {
            limit,
            queuedThisRun,
            rowNumber: thisRowNumber,
          })
          break
        }

        if (queue.size >= maxQueueSize) {
          await queue.onSizeLessThan(maxQueueSize)
        }

        queuedThisRun++
        queue.add(async () => {
          let result
          try {
            result = await processCustomer(row, thisRowNumber, commit, {
              writeStripeExistingFields: stripeExistingFieldsWriter.write,
              forceInvalidTax,
            })
          } catch (error) {
            result = {
              ...row,
              outcome: 'error',
              error: error?.message || String(error),
            }
            logError('Unhandled error while processing customer', error, {
              rowNumber: thisRowNumber,
              accountCode,
            })
          }

          processedThisRun++
          lastCompletedRowNumber = thisRowNumber

          if (result.customFieldCounts) {
            for (const [field, count] of Object.entries(
              result.customFieldCounts
            )) {
              if (customFieldStats[field] != null) {
                customFieldStats[field] += count
              }
            }
          }

          if (result.taxInfoPending != null) {
            taxInfoPendingCount++
          }

          // Write to appropriate output file based on outcome
          if (result.outcome === 'error') {
            writeError(result)
            errorCount++
            errorAccountCodes.push(accountCode)
          } else {
            writeSuccess(result)
            // Update statistics and collect dry-run data
            if (result.outcome === 'updated') {
              updatedCount++
            } else if (result.outcome === 'dry_run') {
              dryRunCount++
              // Collect customer params for stripe.json output
              if (result.customerParams) {
                stripeCustomerParams.push({
                  recurly_account_code: result.recurly_account_code,
                  target_stripe_account: result.target_stripe_account,
                  customerParams: result.customerParams,
                })
              }
            }
          }

          // Progress update every 1000 customers (or 100 in debug mode)
          const progressInterval = DEBUG_MODE ? 100 : 1000
          if (processedThisRun % progressInterval === 0) {
            const rateLimiterStats = rateLimiters.getRateLimiterStats()
            const progress = {
              rowNumber: lastCompletedRowNumber,
              processedThisRun,
              updated: updatedCount,
              dryRun: dryRunCount,
              taxInfoPending: taxInfoPendingCount,
              errors: errorCount,
              skippedPrevious: skippedPreviouslyProcessed,
              recurlyRate: rateLimiterStats.recurly.currentRate,
              stripeRate: rateLimiterStats.stripe.currentRate,
            }
            logDebug('Progress update', progress)
            await trackProgress(
              `Progress: row ${lastCompletedRowNumber}, ${processedThisRun} processed this run, ${errorCount} errors`
            )
          }
        })
      }
    } finally {
      await queue.onIdle()
    }

    if (limitReached) {
      await trackProgress(
        `Limit reached (${limit}). Stopped reading input; waiting for in-flight records to finish.`
      )
    }

    // Write stripe.json file in dry-run mode
    if (!commit && stripeCustomerParams.length > 0) {
      await fs.promises.writeFile(
        stripeJsonPath,
        JSON.stringify(stripeCustomerParams, null, 2)
      )
      logDebug(
        `Wrote ${stripeCustomerParams.length} customer params to ${stripeJsonPath}`
      )
    }

    // Final summary
    const endTime = new Date()
    const durationMs = endTime.getTime() - startTime.getTime()
    const durationTotalSeconds = Math.floor(durationMs / 1000)
    const durationHours = Math.floor(durationTotalSeconds / 3600)
    const durationMinutes = Math.floor((durationTotalSeconds % 3600) / 60)
    const durationSeconds = durationTotalSeconds % 60
    const durationHms =
      String(durationHours).padStart(2, '0') +
      ':' +
      String(durationMinutes).padStart(2, '0') +
      ':' +
      String(durationSeconds).padStart(2, '0')

    const totalSuccessful = commit
      ? previouslyProcessed.size + updatedCount
      : previouslyProcessed.size
    const finalRateLimiterStats = rateLimiters.getRateLimiterStats()

    await trackProgress('=== FINAL SUMMARY ===')
    await trackProgress(`Start time: ${startTime.toISOString()}`)
    await trackProgress(`End time: ${endTime.toISOString()}`)
    await trackProgress(`Total runtime: ${durationHms}`)
    await trackProgress('CLI parameters:')
    await trackProgress(`  - input: ${inputPath}`)
    await trackProgress(`  - output: ${successOutputPath}`)
    await trackProgress(`  - commit: ${commit}`)
    await trackProgress(`  - verbose: ${verbose}`)
    await trackProgress(`  - restart: ${restart}`)
    await trackProgress(`  - limit: ${limit != null ? limit : 'none'}`)
    await trackProgress(`  - concurrency: ${concurrency}`)
    await trackProgress(`  - recurly-rate-limit: ${recurlyRateLimit}`)
    await trackProgress(`  - recurly-api-retries: ${recurlyApiRetriesValue}`)
    await trackProgress(
      `  - recurly-retry-delay-ms: ${recurlyRetryDelayMsValue}`
    )
    await trackProgress(`  - stripe-rate-limit: ${stripeRateLimitPerSecond}`)
    await trackProgress(`  - stripe-api-retries: ${stripeApiRetriesValue}`)
    await trackProgress(`  - stripe-retry-delay-ms: ${stripeRetryDelayMsValue}`)
    await trackProgress(`  - force-invalid-tax: ${forceInvalidTax}`)
    await trackProgress(`Input file total rows: ${totalInInput}`)
    await trackProgress(
      `Previously successful (skipped): ${skippedPreviouslyProcessed}`
    )
    await trackProgress(`Processed this run: ${processedThisRun}`)
    await trackProgress(
      `  - ${commit ? 'Updated' : 'Would update'}: ${commit ? updatedCount : dryRunCount}`
    )
    await trackProgress(`  - Tax info pending: ${taxInfoPendingCount}`)
    await trackProgress(`  - Errors: ${errorCount}`)
    await trackProgress('')
    await trackProgress('Custom fields summary (Recurly -> Stripe metadata):')
    for (const fieldName of RECURLY_CUSTOM_FIELD_NAMES) {
      await trackProgress(
        `  - ${fieldName}: ${customFieldStats[fieldName] || 0}`
      )
    }
    await trackProgress(
      `  - No custom fields: ${customFieldStats.noCustomFields}`
    )
    await trackProgress('')
    if (commit) {
      await trackProgress(
        `Success file: ${successOutputPath} (${totalSuccessful} records)`
      )
    } else {
      await trackProgress(
        `Success file: ${successOutputPath} (not modified in dry-run mode)`
      )
    }
    await trackProgress(
      `Errors file: ${errorsOutputPath} (${errorCount} records)`
    )
    await trackProgress(
      `API calls - Recurly: ${finalRateLimiterStats.recurly.totalRequests}, Stripe: ${finalRateLimiterStats.stripe.totalRequests}`
    )

    if (!commit && dryRunCount > 0) {
      await trackProgress('')
      await trackProgress(
        `Stripe params file: ${stripeJsonPath} (${stripeCustomerParams.length} records)`
      )
      await trackProgress(
        'To actually update customers, run the script with --commit flag'
      )

      logDebug('Dry-run params file written', {
        stripeJsonPath,
        records: stripeCustomerParams.length,
      })
    }

    await trackProgress(
      `Stripe existing fields file: ${stripeExistingFieldsJsonPath}`
    )

    // Log error account codes for easy reference
    if (errorCount > 0) {
      logWarn(`${errorCount} records failed and are in the errors file.`)
      logWarn('Failed account codes:', {
        first20: errorAccountCodes.slice(0, 20),
        totalErrors: errorAccountCodes.length,
      })
      await trackProgress('')
      await trackProgress(
        `${errorCount} records failed. Re-run the script to retry them.`
      )
      await trackProgress(
        `Failed accounts (first 20): ${errorAccountCodes.slice(0, 20).join(', ')}`
      )
    }

    // Success/warning based on errors
    if (errorCount === 0) {
      logDebug('Migration completed successfully', { mode })
      await trackProgress(`Migration completed successfully in ${mode}`)

      // If no errors and errors file exists but is empty (just header), note that
      if (fs.existsSync(errorsOutputPath)) {
        await trackProgress(
          `Errors file is empty (header only) - all records processed successfully!`
        )
      }
    } else {
      logWarn('Migration completed with errors', { mode, errorCount })
      await trackProgress(
        `Migration completed with ${errorCount} errors in ${mode}`
      )
    }

    // Return exit code based on whether there were errors
    return errorCount === 0 ? 0 : 1
  } finally {
    const results = await Promise.allSettled([
      closeOutputs(),
      stripeExistingFieldsWriter.close(),
    ])

    for (const result of results) {
      if (result.status === 'rejected') {
        logWarn('Failed to close output stream', {
          error: result.reason?.message || String(result.reason),
        })
      }
    }
  }
}

// Execute the script using the runner
try {
  const exitCode = await scriptRunner(main)
  process.exit(exitCode ?? 0)
} catch (error) {
  logError('Script failed with unhandled error', error)
  process.exit(1)
}
