#!/usr/bin/env node

/**
 * This script compares existing Stripe customer records with data from Recurly
 * to detect any drift since the last migration run.
 *
 * It is a read-only companion to migrate_recurly_customers_to_stripe.mjs.
 * It uses the same normalization logic but makes no changes to Stripe.
 *
 * Input CSV format:
 *   recurly_account_code,target_stripe_account,stripe_customer_id
 *
 * Output files:
 *   --output (comparison file): One row per customer with match/mismatch status
 *     Format: recurly_account_code,target_stripe_account,stripe_customer_id,status,diffs
 *
 *   <output>_details.json: Detailed diff for each customer with mismatches
 *     Format: Array of { recurly_account_code, stripe_customer_id, diffs: { field: { recurly, stripe } } }
 *
 *   <output>_errors.csv: Records that failed
 *     Format: recurly_account_code,target_stripe_account,stripe_customer_id,error
 *
 * Usage:
 *   node scripts/recurly/compare_recurly_stripe_customers.mjs --input customers.csv --output comparison.csv --comparison-date 2026-03-19
 *
 * Options:
 *   --input, -i <file>     Path to input CSV file (required)
 *   --output, -o <file>    Path to output CSV file (required)
 *   --comparison-date <date> Date in YYYY-MM-DD to compare against (required)
 *   --limit, -l <n>        Limit number of records processed (default: no limit)
 *   --concurrency, -c <n>  Number of customers to process concurrently (default: 10)
 *   --recurly-rate-limit <n>     Requests per second for Recurly (default: 10)
 *   --recurly-api-retries <n>    Number of retries on Recurly 429s (default: 5)
 *   --recurly-retry-delay-ms <n> Delay between Recurly retries in ms (default: 1000)
 *   --stripe-rate-limit <n>      Requests per second for Stripe (default: 50)
 *   --stripe-api-retries <n>     Number of retries on Stripe 429s (default: 5)
 *   --stripe-retry-delay-ms <n>  Delay between Stripe retries in ms (default: 1000)
 *   --verbose, -v          Enable debug logging
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

import { compareAccountFields } from '../helpers/migrate_recurly_customers_to_stripe.helpers.mjs'
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
      `No Stripe secret key configured for region ${regionLower}.`
    )
  }

  const client = new Stripe(secretKey, {
    httpClient: Stripe.createFetchHttpClient(),
    telemetry: false,
  })

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
// LOGGING UTILITIES
// =============================================================================

function timestamp() {
  return new Date().toISOString()
}

function logWarn(message, context = {}) {
  const contextStr =
    Object.keys(context).length > 0 ? ` ${JSON.stringify(context)}` : ''
  console.warn(`[${timestamp()}] WARN: ${message}${contextStr}`)
}

function logError(message, error = null, context = {}) {
  const contextStr =
    Object.keys(context).length > 0 ? ` ${JSON.stringify(context)}` : ''
  console.error(`[${timestamp()}] ERROR: ${message}${contextStr}`)
  if (error?.stack) {
    console.error(`[${timestamp()}] STACK: ${error.stack}`)
  }
}

let DEBUG_MODE = false

function logDebug(message, context = {}, { verboseOnly = false } = {}) {
  if (verboseOnly && !DEBUG_MODE) return
  const contextStr =
    Object.keys(context).length > 0 ? ` ${JSON.stringify(context)}` : ''
  const level = verboseOnly ? 'DEBUG' : 'INFO'
  console.log(`[${timestamp()}] ${level}: ${message}${contextStr}`)
}

// =============================================================================
// DATA FETCHING
// =============================================================================

let rateLimiters

async function fetchRecurlyData(accountCode, context) {
  return await rateLimiters.requestWithRetries(
    'recurly',
    () => recurlyClient.getAccount(`code-${accountCode}`),
    context
  )
}

async function fetchRecurlySubscription(accountCode, context) {
  // Try live subscriptions first, then fall back to expired.
  for (const state of ['live', 'expired']) {
    const subscriptions = await rateLimiters.requestWithRetries(
      'recurly',
      async () => {
        const pager = recurlyClient.listAccountSubscriptions(
          `code-${accountCode}`,
          { params: { state, order: 'desc', sort: 'updated_at' } }
        )
        const results = []
        for await (const subscription of pager.each()) {
          results.push(subscription)
        }
        return results
      },
      context
    )
    if (subscriptions.length > 0) {
      // Return the most recently updated subscription in this state
      return subscriptions[0]
    }
  }
  return null
}

async function fetchTargetStripeCustomer(
  stripeClient,
  stripeCustomerId,
  context
) {
  const customer = await rateLimiters.requestWithRetries(
    stripeClient.serviceName,
    () =>
      stripeClient.customers.retrieve(stripeCustomerId, {
        expand: ['tax_ids', 'invoice_settings.default_payment_method'],
      }),
    { ...context, stripeApi: 'customers.retrieve' }
  )
  if (customer.deleted) {
    throw new Error(`Stripe customer ${stripeCustomerId} has been deleted`)
  }
  return customer
}

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

// =============================================================================
// COMPARISON LOGIC
// =============================================================================

/**
 * Compare a single customer's Recurly data against Stripe.
 */
async function compareCustomer(row, rowNumber, comparisonDate) {
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
    stripe_customer_id: stripeCustomerId,
    status: '', // 'match', 'mismatch', or 'error'
    diffs: '',
    error: '',
    diffDetails: null,
  }

  try {
    if (!recurlyAccountCode) throw new Error('Missing recurly_account_code')
    if (!targetStripeAccount) throw new Error('Missing target_stripe_account')
    if (!stripeCustomerId) throw new Error('Missing stripe_customer_id')

    const region = String(targetStripeAccount || '')
      .trim()
      .toLowerCase()
      .replace(/^stripe-/, '')
    const stripeClient = getRegionClient(region)

    const account = await fetchRecurlyData(recurlyAccountCode, context)
    const recurlyAccountUpdatedAt = account.updatedAt?.getTime() || 0

    // If Recurly account was not updated after the comparison date, consider it a match
    if (recurlyAccountUpdatedAt <= comparisonDate.getTime()) {
      result.status = 'match'
      result.diffs = ''
      return result
    }

    const stripeCustomer = await fetchTargetStripeCustomer(
      stripeClient,
      stripeCustomerId,
      stripeContext
    )

    const stripePaymentMethods = await fetchTargetStripeCustomerPaymentMethods(
      stripeClient,
      stripeCustomerId,
      stripeContext
    )

    const diffs = await compareAccountFields({
      account,
      stripeCustomer,
      overleafUserId: recurlyAccountCode,
      fetchCollectionMethod: async () => {
        const subscription = await fetchRecurlySubscription(
          recurlyAccountCode,
          context
        )
        return subscription?.collectionMethod || null
      },
      stripePaymentMethods,
      stripeServiceName: stripeClient.serviceName,
    })

    // Determine result
    const diffKeys = Object.keys(diffs)
    if (diffKeys.length === 0) {
      result.status = 'match'
      result.diffs = ''
    } else {
      result.status = 'mismatch'
      result.diffs = diffKeys.join('; ')
      result.diffDetails = {
        recurly_account_code: recurlyAccountCode,
        stripe_customer_id: stripeCustomerId,
        target_stripe_account: targetStripeAccount,
        comparison_date: comparisonDate.toISOString(),
        recurly_account_updated_at: account.updatedAt?.toISOString(),
        diffs,
      }

      logDebug('Customer has diffs', {
        ...context,
        diffFields: diffKeys,
      })
    }
  } catch (error) {
    result.status = 'error'
    const errorDetails = [error.message]
    if (error.code) errorDetails.push(`code=${error.code}`)
    if (error.type) errorDetails.push(`type=${error.type}`)
    if (error.statusCode) errorDetails.push(`statusCode=${error.statusCode}`)
    result.error = errorDetails.join('; ')
    logError('Failed to compare customer', error, context)
  }

  return result
}

// =============================================================================
// CSV HELPERS
// =============================================================================

function formatCsvRow(columns, row) {
  const values = columns.map(col => {
    const raw = row[col]
    const val = raw == null ? '' : String(raw)
    if (val.includes(',') || val.includes('"') || val.includes('\n')) {
      return `"${val.replace(/"/g, '""')}"`
    }
    return val
  })
  return values.join(',') + '\n'
}

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
// CLI
// =============================================================================

function usage() {
  console.error(
    'Compare Recurly customer data against migrated Stripe customers'
  )
  console.error('')
  console.error('Usage:')
  console.error(
    '  node scripts/recurly/compare_recurly_stripe_customers.mjs [options]'
  )
  console.error('')
  console.error('Options:')
  console.error('  --input, -i <file>   Path to input CSV file (required)')
  console.error('  --output, -o <file>  Path to output CSV file (required)')
  console.error(
    '  --comparison-date <date> Date in YYYY-MM-DD to compare against (required)'
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
  console.error('  --verbose, -v         Enable debug logging')
}

function parseConcurrency(value, { defaultValue = 10 } = {}) {
  if (value === undefined || value === null || value === '') return defaultValue
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 1) {
    throw new Error(
      `Invalid --concurrency value: ${value}. Expected a positive integer.`
    )
  }
  return parsed
}

function parseRateLimit(value, { defaultValue, name }) {
  if (value === undefined || value === null || value === '') return defaultValue
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(
      `Invalid --${name} value: ${value}. Expected a positive number.`
    )
  }
  return parsed
}

function parseNonNegativeInt(value, { defaultValue, name }) {
  if (value === undefined || value === null || value === '') return defaultValue
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
      'comparison-date',
      'limit',
      'recurly-rate-limit',
      'recurly-api-retries',
      'recurly-retry-delay-ms',
      'stripe-rate-limit',
      'stripe-api-retries',
      'stripe-retry-delay-ms',
    ],
    boolean: ['verbose', 'help'],
    default: {
      verbose: false,
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

// =============================================================================
// MAIN
// =============================================================================

async function main(trackProgress) {
  const startTime = new Date()
  const args = parseArgs()
  const {
    input: inputPath,
    output: outputPath,
    'comparison-date': comparisonDateRaw,
    verbose,
    help,
    concurrency: concurrencyRaw,
    limit: limitRaw,
    'recurly-rate-limit': recurlyRateLimitRaw,
    'recurly-api-retries': recurlyApiRetriesRaw,
    'recurly-retry-delay-ms': recurlyRetryDelayMsRaw,
    'stripe-rate-limit': stripeRateLimitRaw,
    'stripe-api-retries': stripeApiRetriesRaw,
    'stripe-retry-delay-ms': stripeRetryDelayMsRaw,
  } = args

  let concurrency,
    recurlyRateLimit,
    recurlyApiRetriesValue,
    recurlyRetryDelayMsValue,
    stripeRateLimitPerSecond,
    stripeApiRetriesValue,
    stripeRetryDelayMsValue,
    limit,
    comparisonDate
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
    if (!comparisonDateRaw) {
      throw new Error('--comparison-date is required')
    }
    const dateMatch = comparisonDateRaw.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (!dateMatch) {
      throw new Error('--comparison-date must be in YYYY-MM-DD format')
    }
    const [, year, month, day] = dateMatch
    comparisonDate = new Date(`${year}-${month}-${day}T00:00:00.000Z`)
    if (isNaN(comparisonDate.getTime())) {
      throw new Error('Invalid date provided for --comparison-date')
    }
  } catch (error) {
    logError(error.message)
    usage()
    process.exit(1)
  }

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

  DEBUG_MODE = !!verbose

  if (help || !inputPath || !outputPath) {
    usage()
    process.exit(help ? 0 : 1)
  }

  const errorsPath = outputPath.replace(/\.csv$/, '_errors.csv')
  const detailsJsonPath = outputPath.replace(/\.csv$/, '_details.json')

  logDebug('Starting comparison', {
    inputPath,
    outputPath,
    errorsPath,
    detailsJsonPath,
    comparisonDate: comparisonDate.toISOString(),
    concurrency,
    ...(limit != null ? { limit } : {}),
  })
  await trackProgress('Starting comparison')

  // Output CSV columns
  const outputColumns = [
    'recurly_account_code',
    'target_stripe_account',
    'stripe_customer_id',
    'status',
    'diffs',
  ]
  const errorColumns = [
    'recurly_account_code',
    'target_stripe_account',
    'stripe_customer_id',
    'error',
  ]

  const outputStream = fs.createWriteStream(outputPath, { flags: 'w' })
  outputStream.write(outputColumns.join(',') + '\n')

  const errorsStream = fs.createWriteStream(errorsPath, { flags: 'w' })
  errorsStream.write(errorColumns.join(',') + '\n')

  const detailsWriter = createJsonArrayWriter(detailsJsonPath)

  try {
    let totalInInput = 0
    let processedCount = 0
    let matchCount = 0
    let mismatchCount = 0
    let errorCount = 0
    let queuedCount = 0

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

    let rowNumber = 0
    let limitReached = false

    try {
      for await (const row of parser) {
        rowNumber++
        totalInInput++

        const thisRowNumber = rowNumber

        if (limit != null && queuedCount >= limit) {
          limitReached = true
          logDebug('Record limit reached', { limit, queuedCount })
          break
        }

        if (queue.size >= maxQueueSize) {
          await queue.onSizeLessThan(maxQueueSize)
        }

        queuedCount++
        queue.add(async () => {
          let result
          try {
            result = await compareCustomer(row, thisRowNumber, comparisonDate)
          } catch (error) {
            result = {
              ...row,
              status: 'error',
              diffs: '',
              error: error?.message || String(error),
              diffDetails: null,
            }
            logError('Unhandled error', error, {
              rowNumber: thisRowNumber,
              accountCode: row.recurly_account_code,
            })
          }

          processedCount++

          if (result.status === 'match') {
            matchCount++
            outputStream.write(formatCsvRow(outputColumns, result))
          } else if (result.status === 'mismatch') {
            mismatchCount++
            outputStream.write(formatCsvRow(outputColumns, result))
            if (result.diffDetails) {
              detailsWriter.write(result.diffDetails)
            }
          } else {
            errorCount++
            errorsStream.write(formatCsvRow(errorColumns, result))
          }

          const progressInterval = DEBUG_MODE ? 100 : 1000
          if (processedCount % progressInterval === 0) {
            logDebug('Progress', {
              processedCount,
              matchCount,
              mismatchCount,
              errorCount,
            })
            await trackProgress(
              `Progress: ${processedCount} processed, ${matchCount} match, ${mismatchCount} mismatch, ${errorCount} errors`
            )
          }
        })
      }
    } finally {
      await queue.onIdle()
    }

    if (limitReached) {
      await trackProgress(`Limit reached (${limit}).`)
    }

    // Final summary
    const endTime = new Date()
    const durationMs = endTime.getTime() - startTime.getTime()
    const durationSeconds = Math.floor(durationMs / 1000)

    const finalStats = rateLimiters.getRateLimiterStats()

    await trackProgress('=== COMPARISON SUMMARY ===')
    await trackProgress(`Total in input: ${totalInInput}`)
    await trackProgress(`Processed: ${processedCount}`)
    await trackProgress(`  Match: ${matchCount}`)
    await trackProgress(`  Mismatch: ${mismatchCount}`)
    await trackProgress(`  Error: ${errorCount}`)
    await trackProgress(`Duration: ${durationSeconds}s`)
    await trackProgress(`Output: ${outputPath}`)
    await trackProgress(`Errors: ${errorsPath} (${errorCount} records)`)
    await trackProgress(
      `Details: ${detailsJsonPath} (${mismatchCount} records)`
    )
    await trackProgress(
      `API calls - Recurly: ${finalStats.recurly.totalRequests}, Stripe: ${finalStats.stripe.totalRequests}`
    )

    logDebug('Comparison complete', {
      totalInInput,
      processedCount,
      matchCount,
      mismatchCount,
      errorCount,
    })

    return errorCount === 0 && mismatchCount === 0 ? 0 : 1
  } finally {
    outputStream.end()
    errorsStream.end()

    const results = await Promise.allSettled([
      new Promise((resolve, reject) => {
        outputStream.on('finish', resolve)
        outputStream.on('error', reject)
      }),
      new Promise((resolve, reject) => {
        errorsStream.on('finish', resolve)
        errorsStream.on('error', reject)
      }),
      detailsWriter.close(),
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

try {
  const exitCode = await scriptRunner(main)
  process.exit(exitCode ?? 0)
} catch (error) {
  logError('Script failed with unhandled error', error)
  process.exit(1)
}
