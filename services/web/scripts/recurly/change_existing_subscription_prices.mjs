#!/usr/bin/env node

/**
 * This script changes prices for existing Recurly subscriptions.
 * It schedules changes to apply at the next renewal.
 *
 * Usage:
 *   node scripts/recurly/change_existing_subscription_prices.mjs [OPTS] [INPUT-FILE]
 *
 * Options:
 *   --timeframe TIMEFRAME  Either 'renewal' or 'now' (default: renewal)
 *   --output PATH          Output file path (default: /tmp/change_prices_output_<timestamp>.csv)
 *                          Use '-' to write to stdout
 *   --commit               Apply changes (without this flag, runs in dry-run mode)
 *   --throttle DURATION    Minimum time (in ms) between subscriptions processed (default: 2400)
 *   --force                Overwrite any existing pending changes
 *   --help                 Show a help message
 *
 * CSV Input Format:
 *   The CSV must have the following columns:
 *   - subscription_uuid: Recurly subscription UUID
 *   - plan_code: Current plan code
 *   - currency: Current currency
 *   - unit_amount: Current price per unit
 *   - new_unit_amount: New price per unit
 *   - subscription_add_on_unit_amount_in_cents: Current additional-licenses add-on price (optional)
 *   - new_subscription_add_on_unit_amount_in_cents: New additional-licenses add-on price (optional)
 *
 * Output:
 *   Writes a CSV with columns:
 *   - subscription_uuid: The subscription UUID processed
 *   - status: Result status (changed, validated, not-found, inactive, mismatch, pending-change, or error)
 *   - note: Additional information about the status (includes dry run notice when not using --commit)
 *
 * Running on a Pod:
 *   This script may run for multiple days. When running using `rake run:longpod[ENV,web]`,
 *   use one of these strategies to preserve output:
 *
 *   1. Tail the output file from another session (the filename is logged when the script starts):
 *      kubectl exec -it <pod-name> -- tail -f /tmp/change_prices_output_<timestamp>.csv > local_backup.csv
 *
 *   2. Periodically copy the output file to your laptop:
 *      kubectl cp <pod-name>:/tmp/change_prices_output_<timestamp>.csv ./backup.csv
 *
 *   3. Write to stdout and capture locally:
 *      kubectl exec -it <pod-name> -- node scripts/recurly/change_existing_subscription_prices.mjs \
 *        --timeframe renewal --commit --output - input.csv > output.csv
 *
 *   For monitoring handoffs, have the next person start tailing (or copying periodically)
 *   before the current monitor disconnects to ensure no records are lost.
 */

import fs from 'node:fs'
import path from 'node:path'
import { setTimeout } from 'node:timers/promises'
import * as csv from 'csv'
import minimist from 'minimist'
import recurly from 'recurly'
import Settings from '@overleaf/settings'
import AnalyticsManager from '../../app/src/Features/Analytics/AnalyticsManager.mjs'
import { z } from '../../app/src/infrastructure/Validation.mjs'
import { scriptRunner } from '../lib/ScriptRunner.mjs'

/**
 * @import { ReadStream } from 'node:fs'
 * @import { Parser } from 'csv-parse'
 * @import { Stringifier } from 'csv-stringify'
 * @import { Subscription } from 'recurly'
 */

/**
 * @typedef {Object} CSVSubscriptionChange
 * @property {string} subscription_uuid
 * @property {string} plan_code
 * @property {string} currency
 * @property {number} unit_amount
 * @property {number} new_unit_amount
 * @property {number | null} subscription_add_on_unit_amount_in_cents
 * @property {number | null} new_subscription_add_on_unit_amount_in_cents
 */

/**
 * @typedef {'renewal' | 'now'} Timeframe
 */

const recurlyClient = new recurly.Client(Settings.apis.recurly.apiKey)

// 2400 ms corresponds to approx. 3000 API calls per hour
const DEFAULT_THROTTLE = 2400

/**
 * Print usage information to stderr
 */
function usage() {
  console.error(`Usage: node scripts/recurly/change_existing_subscription_prices.mjs [OPTS] [INPUT-FILE]

Options:
    --timeframe TIMEFRAME  Either 'renewal' or 'now' (default: renewal)
    --output PATH          Output file path (default: /tmp/change_prices_output_<timestamp>.csv)
                           Use '-' to write to stdout
    --commit               Apply changes (without this, runs in dry-run mode)
    --throttle DURATION    Minimum time between requests in ms (default: ${DEFAULT_THROTTLE})
    --force                Overwrite any existing pending changes
    --help                 Show this help message

See the source file header for detailed documentation on CSV format and pod usage.
`)
}

/**
 * Main script entry point
 * @param {function(string): Promise<void>} trackProgress - Function to log progress messages
 */
async function main(trackProgress) {
  const opts = parseArgs()
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const outputFile = opts.output ?? `/tmp/change_prices_output_${timestamp}.csv`

  await trackProgress('Starting price change script for Recurly')
  await trackProgress(
    `Timeframe: ${opts.timeframe === 'now' ? 'now (immediate)' : 'renewal (at next cycle)'}`
  )
  await trackProgress(`Run mode: ${opts.commit ? 'COMMIT' : 'DRY RUN'}`)
  await trackProgress(`Throttle: ${opts.throttle}ms between requests`)
  await trackProgress(`Force mode: ${opts.force ? 'enabled' : 'disabled'}`)

  const inputStream = opts.inputFile
    ? fs.createReadStream(opts.inputFile)
    : process.stdin
  const csvReader = getCsvReader(inputStream)
  const csvWriter = getCsvWriter(outputFile)

  await trackProgress(`Output: ${outputFile === '-' ? 'stdout' : outputFile}`)

  let processedCount = 0
  let successCount = 0
  let errorCount = 0

  let lastLoopTimestamp = 0
  for await (const change of csvReader) {
    const timeSinceLastLoop = Date.now() - lastLoopTimestamp
    if (timeSinceLastLoop < opts.throttle) {
      await setTimeout(opts.throttle - timeSinceLastLoop)
    }
    lastLoopTimestamp = Date.now()

    processedCount++

    try {
      const subscription = await processChange(
        change,
        opts.commit,
        opts.force,
        opts.timeframe
      )

      if (opts.commit && subscription) {
        try {
          const userId = subscription.account.code
          await AnalyticsManager.recordEventForUser(
            userId,
            'script_price_change',
            {
              subscriptionId: change.subscription_uuid,
            }
          )
        } catch (err) {
          await trackProgress(
            `Warning: failed to record analytics event after successful price change for ${change.subscription_uuid}: ${err.message}`
          )
        }
      }

      csvWriter.write({
        subscription_uuid: change.subscription_uuid,
        status: opts.commit ? 'changed' : 'validated',
        note: opts.commit ? undefined : 'dry run - no changes applied',
      })
      successCount++

      if (processedCount % 10 === 0) {
        await trackProgress(
          `Processed ${processedCount} subscriptions (${successCount} ${opts.commit ? 'changed' : 'validated'}, ${errorCount} errors)`
        )
      }
    } catch (err) {
      errorCount++
      if (err instanceof ReportError) {
        csvWriter.write({
          subscription_uuid: change.subscription_uuid,
          status: err.status,
          note: err.message,
        })
      } else {
        csvWriter.write({
          subscription_uuid: change.subscription_uuid,
          status: 'error',
          note: err.message,
        })
        await trackProgress(
          `Error processing ${change.subscription_uuid}: ${err.message}`
        )
      }
    }
  }

  await trackProgress('\n✨ FINAL SUMMARY ✨')
  await trackProgress(`📊 Total processed: ${processedCount}`)
  if (opts.commit) {
    await trackProgress(`✅ Successfully changed: ${successCount}`)
  } else {
    await trackProgress(`✅ Successfully validated: ${successCount}`)
    await trackProgress('ℹ️  DRY RUN: No changes were applied to Recurly')
  }
  await trackProgress(`❌ Errors: ${errorCount}`)
  await trackProgress('🎉 Script completed!')

  csvWriter.end()
}

/**
 * Get a CSV parser configured for subscription change input
 * @param {ReadStream | NodeJS.ReadableStream} inputStream - The input stream to parse
 * @returns {Parser} The configured CSV parser
 */
function getCsvReader(inputStream) {
  const parser = csv.parse({
    columns: true,
    cast: (value, context) => {
      if (context.header) {
        return value
      }
      switch (context.column) {
        case 'unit_amount':
        case 'new_unit_amount': {
          const parsed = parseFloat(value)
          if (Number.isNaN(parsed)) {
            throw new ReportError(
              'mismatch',
              `Invalid number for ${context.column} at row ${context.lines}: "${value}"`
            )
          }
          return parsed
        }
        case 'subscription_add_on_unit_amount_in_cents':
        case 'new_subscription_add_on_unit_amount_in_cents': {
          if (value === '') {
            return null
          }
          const parsed = parseInt(value, 10)
          if (Number.isNaN(parsed)) {
            throw new ReportError(
              'mismatch',
              `Invalid number for ${context.column} at row ${context.lines}: "${value}"`
            )
          }
          return parsed
        }
        default:
          return value
      }
    },
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
  const writer = csv.stringify({
    columns: ['subscription_uuid', 'status', 'note'],
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
 * Process a single subscription change
 * @param {CSVSubscriptionChange} change - The subscription change to process
 * @param {boolean} commit - Whether to commit changes or run in dry-run mode
 * @param {boolean} force - Whether to overwrite existing pending changes
 * @param {Timeframe} timeframe - When to apply the change
 * @returns {Promise<Subscription | undefined>} The subscription if commit mode, undefined otherwise
 */
async function processChange(change, commit, force, timeframe) {
  const subscription = await fetchSubscription(change.subscription_uuid)
  validateChange(change, subscription, force)

  if (!commit) {
    // Dry run mode - validation passed, no changes applied
    return
  }

  await createSubscriptionChange(change, subscription, timeframe)

  return subscription
}

/**
 * Fetch a subscription from Recurly
 * @param {string} uuid - The Recurly subscription UUID
 * @returns {Promise<Subscription>} The subscription
 * @throws {ReportError} If subscription is not found
 */
async function fetchSubscription(uuid) {
  try {
    const subscription = await recurlyClient.getSubscription(`uuid-${uuid}`)
    return subscription
  } catch (err) {
    if (err instanceof recurly.errors.NotFoundError) {
      throw new ReportError('not-found', 'subscription not found')
    } else {
      throw err
    }
  }
}

/**
 * Validate that the subscription matches the expected state
 * @param {CSVSubscriptionChange} change - The subscription change to validate
 * @param {Subscription} subscription - The Recurly subscription
 * @param {boolean} force - Whether to ignore existing pending changes
 * @throws {ReportError} If validation fails
 */
function validateChange(change, subscription, force) {
  if (subscription.state !== 'active') {
    throw new ReportError(
      'inactive',
      `subscription state: ${subscription.state}`
    )
  }

  if (subscription.plan.code !== change.plan_code) {
    throw new ReportError(
      'mismatch',
      `subscription plan (${subscription.plan.code}) does not match expected plan (${change.plan_code})`
    )
  }

  if (subscription.currency !== change.currency) {
    throw new ReportError(
      'mismatch',
      `subscription currency (${subscription.currency}) does not match expected currency (${change.currency})`
    )
  }

  if (subscription.unitAmount !== change.unit_amount) {
    throw new ReportError(
      'mismatch',
      `subscription price (${subscription.unitAmount}) does not match expected price (${change.unit_amount})`
    )
  }

  if (Math.abs(change.unit_amount - change.new_unit_amount) < 0.01) {
    throw new ReportError(
      'mismatch',
      `price not expected to change (before: ${change.unit_amount}, after: ${change.new_unit_amount})`
    )
  }

  if (subscription.pendingChange != null && !force) {
    throw new ReportError(
      'pending-change',
      'subscription already has a pending change'
    )
  }

  const additionalLicenseAddOn = subscription.addOns.find(
    addOnItem => addOnItem.addOn.code === 'additional-license'
  )

  if (change.subscription_add_on_unit_amount_in_cents != null) {
    if (!additionalLicenseAddOn) {
      throw new ReportError(
        'mismatch',
        'add-on for additional-license not found'
      )
    }
    const expectedAddOnPrice =
      change.subscription_add_on_unit_amount_in_cents / 100
    if (additionalLicenseAddOn.unitAmount !== expectedAddOnPrice) {
      throw new ReportError(
        'mismatch',
        `add-on price (${additionalLicenseAddOn.unitAmount}) does not match expected price (${expectedAddOnPrice})`
      )
    }
    if (change.new_subscription_add_on_unit_amount_in_cents == null) {
      throw new ReportError(
        'mismatch',
        'new_subscription_add_on_unit_amount_in_cents is required when subscription_add_on_unit_amount_in_cents is provided'
      )
    }
  } else if (additionalLicenseAddOn) {
    throw new ReportError(
      'mismatch',
      'subscription has additional-license add-on but subscription_add_on_unit_amount_in_cents not provided in CSV'
    )
  }
}

/**
 * Create a subscription change in Recurly
 * @param {CSVSubscriptionChange} change - The subscription change to create
 * @param {Subscription} subscription - The Recurly subscription
 * @param {Timeframe} timeframe - When to apply the change
 */
async function createSubscriptionChange(change, subscription, timeframe) {
  const subscriptionChange = {
    timeframe,
    unitAmount: change.new_unit_amount,
  }

  if (timeframe === 'now') {
    // TODO: the Recurly Node SDK usually uses camel case, but this field isn't in the type definitions...
    subscriptionChange.prorationSettings = {
      charge: 'none',
      credit: 'none',
    }

    // TODO: this field is in the API docs but not in their type definitions
    subscriptionChange.proration_settings = {
      charge: 'none',
      credit: 'none',
    }
  }

  const additionalLicenseAddOn = subscription.addOns.find(
    addOnItem => addOnItem.addOn.code === 'additional-license'
  )
  if (additionalLicenseAddOn != null) {
    subscriptionChange.addOns = subscription.addOns.map(item => {
      const result = { id: item.id }
      if (item.addOn.code === 'additional-license') {
        result.unitAmount =
          change.new_subscription_add_on_unit_amount_in_cents / 100
      }
      return result
    })
  }
  await recurlyClient.createSubscriptionChange(
    `uuid-${change.subscription_uuid}`,
    subscriptionChange
  )
}

const paramsSchema = z.object({
  timeframe: z.enum(['renewal', 'now']).default('renewal'),
  output: z.string().optional(),
  commit: z.boolean().default(false),
  force: z.boolean().default(false),
  throttle: z
    .string()
    .optional()
    .transform(val => (val ? parseInt(val, 10) : DEFAULT_THROTTLE)),
  _: z.array(z.string()).max(1),
  help: z.boolean().optional(),
})

/**
 * Parse command line arguments
 * @returns {{inputFile: string | undefined, output: string | undefined, force: boolean, commit: boolean, timeframe: 'renewal' | 'now', throttle: number}} Parsed options
 */
function parseArgs() {
  const argv = minimist(process.argv.slice(2), {
    string: ['throttle', 'timeframe', 'output'],
    boolean: ['help', 'force', 'commit'],
  })

  if (argv.help) {
    usage()
    process.exit(0)
  }

  const parseResult = paramsSchema.safeParse(argv)

  if (!parseResult.success) {
    console.error(`Invalid parameters: ${parseResult.error.message}`)
    usage()
    process.exit(1)
  }

  const { timeframe, output, commit, force, throttle, _ } = parseResult.data

  return {
    inputFile: _[0],
    output,
    force,
    commit,
    timeframe,
    throttle,
  }
}

/**
 * Custom error class for reportable errors that should be written to CSV output
 */
class ReportError extends Error {
  /**
   * @param {string} status - The error status code for CSV output
   * @param {string} message - The error message
   */
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

try {
  await scriptRunner(main)
  process.exit(0)
} catch (error) {
  console.error(error)
  process.exit(1)
}
