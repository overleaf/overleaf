#!/usr/bin/env node

/**
 * Calculate Stripe taxes for addresses in a CSV
 *
 * This script reads a CSV file and calls the Stripe tax calculation API for each
 * address. By default, only US/CA addresses are processed.
 *
 * ⚠️ This script calls an API endpoint that incurs a charge per call. Please be conscientious about using this!
 *
 * Usage:
 *   node scripts/stripe/calculate_taxes.mjs [OPTIONS] INPUT-FILE
 *
 * Options:
 *   --output PATH              Output file path (default: /tmp/tax_output_<timestamp>.csv)
 *                              Use '-' to write to stdout
 *   --concurrency, -c N        Number of rows to process concurrently (default: 10)
 *   --countries CODES           Comma-separated country codes to process (default: no filter)
 *   --rate-limit N              Requests per second for Stripe (default: 50)
 *   --api-retries N             Number of retries on Stripe 429s (default: 5)
 *   --retry-delay-ms N          Delay between Stripe retries in ms (default: 1000)
 *   --help                      Show a help message
 *
 * CSV Input Format:
 *   The CSV must contain columns: user_id, billing_country, billing_postal_code, billing_address1, billing_address2, billing_city, billing_state
 *   Optional columns: plan_code
 *
 * Output:
 *   Writes a CSV with:
 *   - user_id
 *   - status (success, skipped_unsupported_country, skipped_missing_postal_code, invalid_address, api_error)
 *   - stripe_tax_breakdown_amount
 *   - stripe_tax_breakdown_taxability_reason
 *   - stripe_tax_breakdown_taxable_amount
 *
 * Examples:
 *   node scripts/stripe/calculate_taxes.mjs cohort.csv
 *   node scripts/stripe/calculate_taxes.mjs --output results.csv cohort.csv
 *   node scripts/stripe/calculate_taxes.mjs --countries US,CA,GB cohort.csv
 */

import fs from 'node:fs'
import path from 'node:path'
import * as csv from 'csv'
import minimist from 'minimist'
import PQueue from 'p-queue'
import { z } from '../../app/src/infrastructure/Validation.mjs'
import { scriptRunner } from '../lib/ScriptRunner.mjs'
import { getRegionClient } from '../../modules/subscriptions/app/src/StripeClient.mjs'
import {
  createRateLimitedApiWrappers,
  DEFAULT_STRIPE_RATE_LIMIT,
  DEFAULT_STRIPE_API_RETRIES,
  DEFAULT_STRIPE_RETRY_DELAY_MS,
} from './RateLimiter.mjs'

/**
 * @import { ReadStream } from 'node:fs'
 * @import { Parser } from 'csv-parse'
 * @import { Stringifier } from 'csv-stringify'
 */

const DEFAULT_CONCURRENCY = 10

const preloadedProductMetadata = new Map()

const AMOUNTS = {
  collaborator: 2100,
  'collaborator-annual': 19900,
  collaborator_free_trial_7_days: 2100,

  professional: 4200,
  'professional-annual': 39900,
  professional_free_trial_7_days: 4200,

  student: 1000,
  'student-annual': 9800,
  student_free_trial_7_days: 1000,
}

/**
 * Print usage information to stderr
 */
function usage() {
  console.error(`Usage: node scripts/stripe/calculate_taxes.mjs [OPTIONS] INPUT-FILE

Calculate Stripe taxes for addresses.

⚠️ This script calls an API endpoint that incurs a charge per call. Please be conscientious about using this!

Options:
    --output PATH              Output file path (default: /tmp/tax_output_<timestamp>.csv)
                               Use '-' to write to stdout
    --concurrency N            Number of rows to process concurrently (default: ${DEFAULT_CONCURRENCY})
    --countries CODES           Comma-separated country codes to process (default: no filter)
    --rate-limit N              Requests per second for Stripe (default: ${DEFAULT_STRIPE_RATE_LIMIT})
    --api-retries N             Number of retries on Stripe 429s (default: ${DEFAULT_STRIPE_API_RETRIES})
    --retry-delay-ms N          Delay between Stripe retries in ms (default: ${DEFAULT_STRIPE_RETRY_DELAY_MS})
    --help                      Show this help message

Output Fields:
  - user_id
  - status (success, skipped_unsupported_country, skipped_missing_postal_code, invalid_address, api_error)
  - stripe_tax_breakdown_amount
  - stripe_tax_breakdown_taxability_reason
  - stripe_tax_breakdown_taxable_amount

See the source file header for detailed documentation.
`)
}

// rate limiters - initialized in main()
let rateLimiters

/**
 * Main script entry point
 * @param {function(string): Promise<void>} trackProgress - Function to log progress messages
 */
async function main(trackProgress) {
  const opts = parseArgs()
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const outputFile = opts.output ?? `/tmp/tax_output_${timestamp}.csv`

  // initialize rate limiters
  rateLimiters = createRateLimitedApiWrappers({
    rateLimit: opts.rateLimit,
    apiRetries: opts.apiRetries,
    retryDelayMs: opts.retryDelayMs,
  })

  await trackProgress('Starting Stripe tax calculation')
  await trackProgress(
    '⚠️ This script calls an API endpoint that incurs a charge per call. Please be conscientious about using this!'
  )
  await trackProgress(
    `Run mode: concurrency=${opts.concurrency}, Stripe rate limit=${opts.rateLimit}/s`
  )
  if (opts.countries.size > 0) {
    await trackProgress(
      `Country filter applied: Only processing addresses from ${Array.from(opts.countries).join(', ')}`
    )
  } else {
    await trackProgress(
      'No country filter applied: Processing addresses from all countries'
    )
  }

  await trackProgress('Populating product metadata...')
  await preloadProductMetadata('uk')
  await preloadProductMetadata('us')
  await trackProgress('Product metadata populated')

  const inputStream = fs.createReadStream(opts.inputFile)
  const csvReader = getCsvReader(inputStream)

  await trackProgress(`Output: ${outputFile === '-' ? 'stdout' : outputFile}`)

  let csvWriter = null
  let processedCount = 0
  let apiCalls = 0

  const queue = new PQueue({ concurrency: opts.concurrency })
  const maxQueueSize = opts.concurrency

  try {
    for await (const record of csvReader) {
      // Initialize writer on first record when we know the input columns
      if (!csvWriter) {
        csvWriter = getCsvWriter(outputFile)
      }

      // throttle input if queue is full
      if (queue.size >= maxQueueSize) {
        await queue.onSizeLessThan(maxQueueSize)
      }

      queue.add(async () => {
        processedCount++

        try {
          let taxResult

          const addressResult = buildCustomerAddress(record, opts.countries)
          if (addressResult.status !== 'ok') {
            taxResult = {
              status: addressResult.status,
              ...emptyTaxFields(),
            }
          } else {
            // Call Stripe API
            taxResult = await calculateTax(
              addressResult.address,
              record.plan_code
            )
            apiCalls++
          }

          csvWriter.write({
            user_id: record.user_id ?? '',
            ...taxResult,
          })

          if (processedCount % 10 === 0) {
            await trackProgress(
              `Processed ${processedCount} rows (${apiCalls} API calls)`
            )
          }
        } catch (err) {
          console.log(err)
          await trackProgress(
            `Error processing row ${processedCount}: ${err.message}`
          )
          csvWriter.write({
            user_id: record.user_id ?? '',
            status: 'api_error',
            ...emptyTaxFields(),
          })
        }
      })
    }
  } finally {
    // wait for all queued tasks to complete
    await queue.onIdle()
  }

  await trackProgress(
    `🎉 Script completed! Total: ${processedCount} rows, ${apiCalls} API calls`
  )

  csvWriter.end()
}

/**
 * Build a Stripe customer address from a CSV record
 * @param {Record<string, unknown>} record
 * @param {Set<string>} allowedCountries - Set of country codes to process
 * @returns {{status: 'ok', address: object} | {status: 'skipped_unsupported_country'} | {status: 'skipped_missing_postal_code'}}
 */
function buildCustomerAddress(record, allowedCountries) {
  const country = record.billing_country.trim().toUpperCase()

  if (allowedCountries.size > 0 && !allowedCountries.has(country)) {
    return { status: 'skipped_unsupported_country' }
  }

  const address = {
    country,
  }

  if (['US', 'CA'].includes(country)) {
    const postalCode = normalizePostalCode(country, record.billing_postal_code)
    if (postalCode) {
      address.postal_code = postalCode
    } else {
      return { status: 'skipped_missing_postal_code' }
    }
  }

  const maybeSet = (key, value) => {
    if (value === undefined || value === null) return
    const str = value.toString().trim()
    if (!str) return
    address[key] = str
  }

  maybeSet('postal_code', record.billing_postal_code)
  maybeSet('line1', record.billing_address1)
  maybeSet('line2', record.billing_address2)
  maybeSet('city', record.billing_city)
  maybeSet('state', record.billing_state)

  return { status: 'ok', address }
}

/**
 * Normalize a postal code to a string suitable for Stripe.
 * - US: Pads 4-digit ZIPs to 5 digits.
 * - CA: Uppercases and formats as "A1A 1A1" when possible.
 * @param {'US' | 'CA'} country
 * @param {unknown} value
 * @returns {string}
 */
function normalizePostalCode(country, value) {
  if (!value) return ''

  const trimmed = value.toString().trim()
  if (!trimmed) return ''

  if (country === 'US') {
    if (trimmed.length === 4) return `0${trimmed}`
    return trimmed
  }

  const compact = trimmed.replace(/[^0-9a-z]/gi, '').toUpperCase()
  if (!compact) return ''
  if (compact.length === 6) {
    return `${compact.slice(0, 3)} ${compact.slice(3)}`
  }
  return compact
}

/**
 * Preload product metadata for a given region to avoid redundant API calls during tax calculations
 * @param {'us' | 'uk'} region
 * @returns {Promise<void>}
 */
async function preloadProductMetadata(region) {
  if (preloadedProductMetadata.has(region)) return

  const stripeClient = getRegionClient(region)
  const products = await rateLimiters.requestWithRetries(
    stripeClient.serviceName,
    () =>
      stripeClient.stripe.products.list({
        active: true,
        limit: 100,
      }),
    { operation: 'products.list', region: stripeClient.serviceName }
  )

  const results = new Map()
  for (const product of products.data) {
    if (!product.metadata?.plan_code) continue
    results.set(product.metadata?.plan_code, product.id)
  }

  preloadedProductMetadata.set(region, results)
}

/**
 * Get a CSV parser configured for input
 * @param {ReadStream | NodeJS.ReadableStream} inputStream - The input stream to parse
 * @returns {Parser} The configured CSV parser
 */
function getCsvReader(inputStream) {
  const parser = csv.parse({
    columns: true,
  })
  inputStream.pipe(parser)
  return parser
}

/**
 * Get a CSV stringifier configured for output
 * @param {string} outputFile - The output file path to write to, or '-' for stdout
 * @returns {Stringifier} The configured CSV stringifier
 */
function getCsvWriter(outputFile) {
  let outputStream
  if (outputFile === '-') {
    outputStream = process.stdout
  } else {
    fs.mkdirSync(path.dirname(outputFile), { recursive: true })
    outputStream = fs.createWriteStream(outputFile)
  }

  const taxFields = [
    'user_id',
    'status',
    'stripe_tax_breakdown_taxability_reason',
    'stripe_tax_breakdown_amount',
    'stripe_tax_breakdown_taxable_amount',
  ]

  const writer = csv.stringify({
    columns: taxFields,
    header: true,
  })
  writer.on('error', err => {
    console.error(err)
    process.exit(1)
  })
  writer.pipe(outputStream)
  return writer
}

/**
 * Calculate tax for an address using Stripe API
 * @param {{country: string, postal_code: string, line1?: string, line2?: string, city?: string, state?: string}} customerAddress
 * @param {string} planCode
 * @returns {Promise<Object>}
 */
async function calculateTax(customerAddress, planCode) {
  const region = ['US', 'CA'].includes(customerAddress.country) ? 'us' : 'uk'
  const stripeClient = getRegionClient(region)

  const productId = preloadedProductMetadata.get(region)?.get(planCode)
  const amount = AMOUNTS[planCode] || AMOUNTS.collaborator

  let calculation
  try {
    calculation = await rateLimiters.requestWithRetries(
      stripeClient.serviceName,
      () =>
        stripeClient.stripe.tax.calculations.create({
          currency: 'USD',
          line_items: [
            {
              amount,
              product: productId,
              quantity: 1,
              reference: 'tax_calculation',
            },
          ],
          customer_details: {
            address: {
              ...customerAddress,
            },
            address_source: 'billing',
          },
          expand: ['line_items'],
        }),
      { operation: 'tax.calculations.create', region: stripeClient.serviceName }
    )
  } catch (err) {
    if (err.code === 'customer_tax_location_invalid') {
      return {
        status: 'invalid_address',
        ...emptyTaxFields(),
      }
    }
    throw err
  }

  // extract and aggregate taxes applied
  const result = (calculation.tax_breakdown || []).reduce(
    (acc, taxBreakdown) => {
      if (taxBreakdown?.amount > 0) {
        acc.stripe_tax_breakdown_amount += taxBreakdown?.amount ?? 0

        const taxabilityReason = taxBreakdown?.taxability_reason ?? ''
        if (taxabilityReason) {
          acc.stripe_tax_breakdown_taxability_reason +=
            acc.stripe_tax_breakdown_taxability_reason
              ? `;${taxabilityReason}`
              : taxabilityReason
        }

        acc.stripe_tax_breakdown_taxable_amount +=
          taxBreakdown?.taxable_amount ?? 0
      }
      return acc
    },
    emptyTaxFields()
  )

  return {
    status: 'success',
    ...result,
  }
}

/**
 * Return an object with all tax fields set to empty strings
 * @returns {Object} Object with empty tax fields
 */
function emptyTaxFields() {
  return {
    stripe_tax_breakdown_amount: 0,
    stripe_tax_breakdown_taxability_reason: '',
    stripe_tax_breakdown_taxable_amount: 0,
  }
}

/**
 * Parse command line arguments
 * @returns {{inputFile: string, output: string | undefined, concurrency: number, countries: Set<string>, rateLimit: number, apiRetries: number, retryDelayMs: number}} Parsed options
 */
function parseArgs() {
  const args = minimist(process.argv.slice(2), {
    string: [
      'output',
      'concurrency',
      'countries',
      'rate-limit',
      'api-retries',
      'retry-delay-ms',
    ],
    boolean: ['help'],
    alias: { c: 'concurrency' },
    default: {
      concurrency: DEFAULT_CONCURRENCY,
      'rate-limit': DEFAULT_STRIPE_RATE_LIMIT,
      'api-retries': DEFAULT_STRIPE_API_RETRIES,
      'retry-delay-ms': DEFAULT_STRIPE_RETRY_DELAY_MS,
    },
  })

  if (args.help) {
    usage()
    process.exit(0)
  }

  const inputFile = args._[0]
  if (!inputFile) {
    console.error('Input file is required')
    usage()
    process.exit(1)
  }

  const paramsSchema = z.object({
    output: z.string().optional(),
    concurrency: z.number().int().positive(),
    countries: z.string().optional(),
    rateLimit: z.number().positive(),
    apiRetries: z.number().int().nonnegative(),
    retryDelayMs: z.number().int().nonnegative(),
    inputFile: z.string(),
  })

  let parsed
  try {
    parsed = paramsSchema.parse({
      output: args.output,
      concurrency: Number(args.concurrency),
      countries: args.countries,
      rateLimit: Number(args['rate-limit']),
      apiRetries: Number(args['api-retries']),
      retryDelayMs: Number(args['retry-delay-ms']),
      inputFile,
    })
  } catch (err) {
    console.error(`Invalid parameters: ${err.message}`)
    usage()
    process.exit(1)
  }

  // Parse countries into a Set, defaulting to no filter
  const countrySet = new Set(
    (parsed.countries || '')
      .split(',')
      .map(c => c.trim().toUpperCase())
      .filter(c => c.length > 0)
  )

  return {
    inputFile: parsed.inputFile,
    output: parsed.output,
    concurrency: parsed.concurrency,
    countries: countrySet,
    rateLimit: parsed.rateLimit,
    apiRetries: parsed.apiRetries,
    retryDelayMs: parsed.retryDelayMs,
  }
}

try {
  await scriptRunner(main)
  process.exit(0)
} catch (error) {
  console.error(error)
  process.exit(1)
}
