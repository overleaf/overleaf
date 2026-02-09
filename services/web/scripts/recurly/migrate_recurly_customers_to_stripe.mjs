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
 *   <output>_skipped_no_stripe_id.csv: Records skipped because stripe_customer_id was missing
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
  coalesceOrEqualOrThrowAddress,
  coalesceOrEqualOrThrowName,
  coalesceOrThrowPaymentMethod,
  coalesceOrThrowVATNumber,
  getTaxIdType,
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
 * Create output writers for success, error, and skipped files.
 *
 * Success file: Append-only, contains all successfully updated records
 * Errors file: Overwritten each run, contains only failures from this run
 * Skipped file: Overwritten each run, contains records skipped because they have no stripe_customer_id
 *
 * @param {string} successPath - Path to the success output CSV file
 * @param {string} errorsPath - Path to the errors output CSV file
 * @param {string} skippedPath - Path to the skipped_no_stripe_id output CSV file
 * @param {boolean} restart - If true, truncate existing files
 * @returns {{ writeSuccess: (row: object) => void, writeError: (row: object) => void, writeSkipped: (row: object) => void, close: () => Promise<void> }}
 */
function createOutputWriters(
  successPath,
  errorsPath,
  skippedPath,
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

  // Skipped file columns (same as success, stripe_customer_id is the existing one)
  const skippedColumns = [
    'recurly_account_code',
    'target_stripe_account',
    'stripe_customer_id',
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

  // Skipped file: always overwrite (contains only this run's skipped)
  const skippedStream = fs.createWriteStream(skippedPath, { flags: 'w' })
  skippedStream.write(skippedColumns.join(',') + '\n')

  function writeSuccess(row) {
    if (!successStream) return
    successStream.write(formatCsvRow(successColumns, row))
  }

  function writeError(row) {
    errorsStream.write(formatCsvRow(errorsColumns, row))
  }

  function writeSkipped(row) {
    skippedStream.write(formatCsvRow(skippedColumns, row))
  }

  async function close() {
    if (successStream) successStream.end()
    errorsStream.end()
    skippedStream.end()

    const closers = [
      new Promise((resolve, reject) => {
        errorsStream.on('finish', resolve)
        errorsStream.on('error', reject)
      }),
      new Promise((resolve, reject) => {
        skippedStream.on('finish', resolve)
        skippedStream.on('error', reject)
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

  return { writeSuccess, writeError, writeSkipped, close }
}

/**
 * Get the errors file path from the success file path
 */
function getErrorsPath(successPath) {
  return successPath.replace(/\.csv$/, '_errors.csv')
}

/**
 * Get the skipped_no_stripe_id file path from the success file path
 */
function getSkippedPath(successPath) {
  return successPath.replace(/\.csv$/, '_skipped_no_stripe_id.csv')
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
 * @returns {Promise<{account: object, billingInfo: object|null}>}
 */
async function fetchRecurlyData(accountCode, context) {
  const account = await rateLimiters.requestWithRetries(
    'recurly',
    () => recurlyClient.getAccount(`code-${accountCode}`),
    context
  )

  let billingInfo = null
  try {
    billingInfo = await rateLimiters.requestWithRetries(
      'recurly',
      () => recurlyClient.getBillingInfo(`code-${accountCode}`),
      context
    )
  } catch (error) {
    // Billing info may not exist for manually billed customers
    if (error instanceof recurly.errors.NotFoundError) {
      // This is expected for some customers
    } else {
      throw error
    }
  }

  return { account, billingInfo }
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
    () => stripeClient.customers.retrieve(stripeCustomerId),
    { ...context, stripeApi: 'customers.retrieve' }
  )

  if (customer.deleted) {
    throw new Error(`Stripe customer ${stripeCustomerId} has been deleted`)
  }

  return customer
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

  return await rateLimiters.requestWithRetries(
    stripeClient.serviceName,
    () =>
      stripeClient.customers.createTaxId(stripeCustomerId, {
        type: taxIdType,
        value: vatNumber,
      }),
    { ...context, stripeApi: 'customers.createTaxId' }
  )
}

/**
 * Extract company name from Recurly data.
 *
 * Prefers billingInfo company as this is what the customer entered during checkout.
 * Falls back to account company for manually-created accounts or legacy data.
 *
 * @param {object} account - Recurly account object
 * @param {object|null} billingInfo - Recurly billing info object
 * @returns {string|null}
 */
function extractCompanyName(account, billingInfo) {
  // Prefer billing info company (entered during checkout)
  if (billingInfo?.company) {
    return billingInfo.company
  }
  // Fall back to account-level company (legacy or manually set)
  if (account.company) {
    return account.company
  }
  return null
}

function normalizeComparableString(value) {
  if (value == null) return ''
  return String(value).trim()
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
    stripe_customer_id: stripeCustomerId,
  } = row

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
    outcome: '', // 'updated', 'dry_run', 'skipped_no_stripe_id', or 'error'
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

    // TODO: In a later phase, records without stripe_customer_id will be
    // handled differently (e.g., PayPal customers who need re-authorization).
    // For now, skip them since we're only processing card customers that
    // were imported via PAN import and have a stripe_customer_id.
    if (!stripeCustomerId) {
      result.outcome = 'skipped_no_stripe_id'
      logDebug(
        'Skipping - no stripe_customer_id (not imported via PAN)',
        {
          ...context,
        },
        { verboseOnly: true }
      )
      return result
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
    const { account, billingInfo } = await fetchRecurlyData(
      recurlyAccountCode,
      context
    )

    logDebug(
      'Fetched Recurly account',
      {
        ...context,
        email: account.email,
        hasBillingInfo: !!billingInfo,
        paymentMethod: billingInfo?.paypalBillingAgreementId
          ? 'paypal'
          : billingInfo?.cardType || 'none',
        account,
        billingInfo,
      },
      { verboseOnly: true }
    )

    // TODO: Handle tax exemption + CC emails in later phases of the migration.
    const hasCcEmails =
      typeof account.ccEmails === 'string'
        ? !!account.ccEmails.trim()
        : !!account.ccEmails
    if (hasCcEmails) {
      logDebug(
        'Found CC emails on Recurly account - aborting',
        {
          ...context,
          ccEmails: account.ccEmails,
        },
        { verboseOnly: true }
      )
      throw new Error(
        'Customer has ccEmails set in Recurly, but this migration does not yet handle CC invoice emails'
      )
    }
    if (account.exemptionCertificate) {
      logDebug(
        'Found tax exemption certificate on Recurly account - aborting',
        {
          ...context,
          exemptionCertificate: account.exemptionCertificate,
        },
        { verboseOnly: true }
      )
      throw new Error(
        'Customer appears to be tax exempt in Recurly, but this migration does not yet handle tax exemption status'
      )
    }

    // Fetch existing customer from target Stripe account
    logDebug(
      'Fetching existing Stripe customer',
      {
        ...context,
        step: 'fetch_stripe_customer',
      },
      { verboseOnly: true }
    )
    const existingCustomer = await fetchTargetStripeCustomer(
      stripeClient,
      stripeCustomerId,
      stripeContext
    )

    logDebug(
      'Found existing Stripe customer',
      {
        ...context,
        stripeEmail: existingCustomer.email,
        stripeName: existingCustomer.name,
      },
      { verboseOnly: true }
    )

    // Extract VAT number and country for tax ID creation
    const vatNumber = coalesceOrThrowVATNumber(account, billingInfo)
    let taxIdType = null
    let country = null
    let createdTaxId = null
    let taxInfoPendingValue = null

    // Determine VAT number tax ID type (if possible)
    if (vatNumber) {
      // We need to extract address first to get the country
      const tempAddress = coalesceOrEqualOrThrowAddress(account, billingInfo)
      country = tempAddress?.country
      if (!country) {
        if (!forceInvalidTax) {
          throw new Error(`Unprocessable VAT number ${vatNumber} (no country)`)
        }
        logWarn('VAT number present but no country in address', {
          ...context,
          vatNumber,
        })
        taxInfoPendingValue = vatNumber
      } else {
        taxIdType = getTaxIdType(country, vatNumber, tempAddress?.postal_code)
        if (!taxIdType) {
          if (!forceInvalidTax) {
            throw new Error(
              `Unprocessable VAT number ${vatNumber} (failed getTaxIdType)`
            )
          }
          logWarn('Unable to determine tax id type for VAT number', {
            ...context,
            vatNumber,
            country,
            postalCode: tempAddress?.postal_code,
          })
          taxInfoPendingValue = vatNumber
        } else {
          logDebug(
            'Will create tax ID',
            {
              ...context,
              vatNumber,
              country,
              taxIdType,
            },
            { verboseOnly: true }
          )
        }
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

    const name = coalesceOrEqualOrThrowName(account, billingInfo)
    const address = coalesceOrEqualOrThrowAddress(account, billingInfo)
    const companyName = extractCompanyName(account, billingInfo)

    // TODO: Handle tax exempt status
    // Recurly has account.exemptionCertificate for tax exemption
    // Stripe has customer.tax_exempt: 'none' | 'exempt' | 'reverse'
    // Need to determine when customers are tax exempt and how to map.
    // Current Stripe checkout only allows tax exemption for US customers with EIN (us_ein).
    // if (account.exemptionCertificate) {
    //   customerParams.tax_exempt = 'exempt'
    // }

    // TODO: Handle CC emails
    // Recurly account.ccEmails field contains additional notification emails.
    // Stripe doesn't have a direct equivalent.
    // Options:
    // 1. Store in metadata (limited to 500 chars per value)
    // 2. Handle via application logic outside of Stripe
    // if (account.ccEmails) {
    //   customerParams.metadata.ccEmails = account.ccEmails
    // }

    const paymentMethods = await fetchTargetStripeCustomerPaymentMethods(
      stripeClient,
      stripeCustomerId,
      region,
      stripeContext
    )
    const paymentMethod = coalesceOrThrowPaymentMethod(
      paymentMethods,
      stripeCustomerId,
      billingInfo
    )

    /** @type {Record<string, string>} */
    const metadata = {}
    if (account.createdAt) {
      metadata.recurlyCreatedAt = account.createdAt.toISOString()
    }
    if (taxInfoPendingValue) {
      metadata.taxInfoPending = taxInfoPendingValue
    }
    if (
      existingCustomer.metadata != null &&
      existingCustomer.metadata.recurlyAccountCode === recurlyAccountCode &&
      existingCustomer.metadata.userId == null
    ) {
      metadata.recurlyAccountCode = ''
      metadata.userId = recurlyAccountCode
    } else {
      logWarn('Stripe customer metadata cannot be remapped', {
        ...context,
        existingCustomerMetadata: existingCustomer.metadata,
      })
    }

    const { metadata: customFieldMetadata, counts: customFieldCounts } =
      extractRecurlyCustomFieldMetadata(account)

    if (Object.keys(customFieldMetadata).length > 0) {
      Object.assign(metadata, customFieldMetadata)
    }

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
              country,
              createdTaxId,
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
    '  SKIPPED file (<output>_skipped_no_stripe_id.csv): Records without stripe_customer_id'
  )
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
  const skippedOutputPath = getSkippedPath(successOutputPath)
  const stripeJsonPath = getStripeJsonPath(successOutputPath)
  const stripeExistingFieldsJsonPath =
    getStripeExistingFieldsJsonPath(successOutputPath)

  const mode = commit ? 'COMMIT MODE' : 'DRY RUN MODE'
  logDebug(`Starting migration in ${mode}`, {
    inputPath,
    successOutputPath,
    errorsOutputPath,
    skippedOutputPath,
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
    writeSkipped,
    close: closeOutputs,
  } = commit
    ? createOutputWriters(
        successOutputPath,
        errorsOutputPath,
        skippedOutputPath,
        restart,
        { enableSuccessFile: true }
      )
    : createOutputWriters(
        successOutputPath,
        errorsOutputPath,
        skippedOutputPath,
        true,
        { enableSuccessFile: false }
      )

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
    let skippedNoStripeIdCount = 0
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
          } else if (result.outcome === 'skipped_no_stripe_id') {
            writeSkipped(result)
            skippedNoStripeIdCount++
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
              skippedNoStripeId: skippedNoStripeIdCount,
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
    await trackProgress(
      `  - Skipped (no stripe_customer_id): ${skippedNoStripeIdCount}`
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
      `Skipped file: ${skippedOutputPath} (${skippedNoStripeIdCount} records)`
    )
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
