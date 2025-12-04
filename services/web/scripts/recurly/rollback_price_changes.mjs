#!/usr/bin/env node

/**
 * Rollback pending price changes for Recurly subscriptions
 *
 * This script removes pending subscription changes that were created by the
 * change_existing_subscription_prices.mjs script. It only removes changes that
 * are purely price changes on an existing plan - if the user has made any other
 * modifications (plan change, add-on changes), the pending change is left untouched.
 *
 * Usage:
 *   node scripts/recurly/rollback_price_changes.mjs [OPTIONS] [INPUT-FILE]
 *
 * Options:
 *   --output PATH          Output file path (default: /tmp/rollback_prices_output_<timestamp>.csv)
 *                          Use '-' to write to stdout
 *   --commit               Apply changes (without this flag, runs in dry-run mode)
 *   --throttle DURATION    Minimum time (in ms) between subscriptions processed (default: 2400)
 *   --help                 Show a help message
 *
 * CSV Input Format:
 *   The CSV must have the following columns (same format as change_existing_subscription_prices.mjs):
 *   - subscription_uuid: Recurly subscription UUID
 *   - plan_code: Plan code at time of price change
 *   - currency: Currency
 *   - unit_amount: Original price per unit (before our price increase)
 *   - new_unit_amount: New price per unit (after our price increase)
 *   - subscription_add_on_unit_amount_in_cents: Original additional-licenses add-on price (optional)
 *   - new_subscription_add_on_unit_amount_in_cents: New additional-licenses add-on price (optional)
 *
 * Output:
 *   Writes a CSV with columns:
 *   - subscription_uuid: The subscription UUID processed
 *   - status: Result status (rolled-back, skipped, validated, not-found, or error)
 *   - note: Additional information about the status
 *
 * The script will SKIP (not rollback) a subscription if:
 *   - There is no pending change
 *   - The pending change involves a plan change (user downgrade/upgrade)
 *   - The pending change involves add-on additions/removals
 *   - The pending change involves add-on quantity changes
 *   - The prices don't match what we expect from the CSV
 *
 * Running on a Pod:
 *   This script may run for multiple days. When running using `rake run:longpod[ENV,web]`,
 *   use one of these strategies to preserve output:
 *
 *   1. Tail the output file from another session:
 *      kubectl exec -it <pod-name> -- tail -f /tmp/rollback_prices_output_<timestamp>.csv > local_backup.csv
 *
 *   2. Periodically copy the output file to your laptop:
 *      kubectl cp <pod-name>:/tmp/rollback_prices_output_<timestamp>.csv ./backup.csv
 *
 *   3. Write to stdout and capture locally:
 *      kubectl exec -it <pod-name> -- node scripts/recurly/rollback_price_changes.mjs \
 *        --commit --output - input.csv > output.csv
 *
 * Examples:
 *   # Dry run (preview only)
 *   node scripts/recurly/rollback_price_changes.mjs input.csv
 *
 *   # Actually perform the rollback
 *   node scripts/recurly/rollback_price_changes.mjs --commit input.csv
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

const recurlyClient = new recurly.Client(Settings.apis.recurly.apiKey)

// 2400 ms corresponds to approx. 3000 API calls per hour
const DEFAULT_THROTTLE = 2400

/**
 * Print usage information to stderr
 */
function usage() {
  console.error(`Usage: node scripts/recurly/rollback_price_changes.mjs [OPTIONS] [INPUT-FILE]

Rollback pending price changes for Recurly subscriptions.

This script only removes pending changes that are purely price changes on an
existing plan. If a user has made any other modifications (plan change, add-on
changes), the subscription is skipped.

Options:
    --output PATH          Output file path (default: /tmp/rollback_prices_output_<timestamp>.csv)
                           Use '-' to write to stdout
    --commit               Apply changes (without this, runs in dry-run mode)
    --throttle DURATION    Minimum time between requests in ms (default: ${DEFAULT_THROTTLE})
    --help                 Show this help message

Output Statuses:
    rolled-back    Pending price change was removed
    validated      Dry run - would have removed pending price change
    mismatch       Input prices malformed or subscription price does not match expected values
    skipped        Not a price-only change, or values don't match (see note)
    not-found      Subscription not found in Recurly
    error          An error occurred

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
  const outputFile =
    opts.output ?? `/tmp/rollback_prices_output_${timestamp}.csv`

  await trackProgress('Starting price rollback script for Recurly')
  await trackProgress(`Run mode: ${opts.commit ? 'COMMIT' : 'DRY RUN'}`)
  await trackProgress(`Throttle: ${opts.throttle}ms between requests`)

  const inputStream = opts.inputFile
    ? fs.createReadStream(opts.inputFile)
    : process.stdin
  const csvReader = getCsvReader(inputStream)
  const csvWriter = getCsvWriter(outputFile)

  await trackProgress(`Output: ${outputFile === '-' ? 'stdout' : outputFile}`)

  let processedCount = 0
  let successCount = 0
  let skippedCount = 0
  let errorCount = 0

  let lastLoopTimestamp = 0
  for await (const record of csvReader) {
    const timeSinceLastLoop = Date.now() - lastLoopTimestamp
    if (timeSinceLastLoop < opts.throttle) {
      await setTimeout(opts.throttle - timeSinceLastLoop)
    }
    lastLoopTimestamp = Date.now()

    processedCount++

    try {
      const result = await processRollback(record, opts.commit)

      if (opts.commit && result.subscription) {
        try {
          const userId = result.subscription.account.code
          await AnalyticsManager.recordEventForUser(
            userId,
            'script_price_change_reversed',
            {
              subscriptionId: record.subscription_uuid,
            }
          )
        } catch (err) {
          await trackProgress(
            `Warning: failed to record analytics event after successful price rollback for ${record.subscription_uuid}: ${err.message}`
          )
        }
      }

      csvWriter.write({
        subscription_uuid: record.subscription_uuid,
        status: result.status,
        note: result.note || '',
      })

      if (result.status === 'skipped') {
        skippedCount++
      } else {
        successCount++
      }

      if (processedCount % 10 === 0) {
        await trackProgress(
          `Processed ${processedCount} subscriptions (${successCount} ${opts.commit ? 'rolled-back' : 'validated'}, ${skippedCount} skipped, ${errorCount} errors)`
        )
      }
    } catch (err) {
      errorCount++
      if (err instanceof ReportError) {
        csvWriter.write({
          subscription_uuid: record.subscription_uuid,
          status: err.status,
          note: err.message,
        })
      } else {
        csvWriter.write({
          subscription_uuid: record.subscription_uuid,
          status: 'error',
          note: err.message,
        })
        await trackProgress(
          `Error processing ${record.subscription_uuid}: ${err.message}`
        )
      }
    }
  }

  await trackProgress('\n✨ FINAL SUMMARY ✨')
  await trackProgress(`📊 Total processed: ${processedCount}`)
  if (opts.commit) {
    await trackProgress(`✅ Successfully rolled back: ${successCount}`)
  } else {
    await trackProgress(`✅ Successfully validated: ${successCount}`)
    await trackProgress('ℹ️  DRY RUN: No changes were applied to Recurly')
  }
  await trackProgress(`⏭️  Skipped: ${skippedCount}`)
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
 * Process a single subscription rollback
 * @param {CSVSubscriptionChange} record - The subscription record to process
 * @param {boolean} commit - Whether to commit changes or run in dry-run mode
 * @returns {Promise<{status: string, note: string, subscription?: Subscription}>} The result of the rollback
 */
async function processRollback(record, commit) {
  const subscription = await fetchSubscription(record.subscription_uuid)

  // Validate this is a price-only change that we created
  const validation = validatePriceOnlyChange(record, subscription)

  if (!validation.isPriceOnly) {
    return {
      status: 'skipped',
      note: `${validation.reason}: ${validation.detail || 'N/A'}`,
    }
  }

  if (!commit) {
    return {
      status: 'validated',
      note: `Would remove pending price change: ${subscription.unitAmount} -> ${subscription.pendingChange.unitAmount}`,
    }
  }

  // Safe to remove - this is a price-only change matching our expected values
  await recurlyClient.removeSubscriptionChange(
    `uuid-${record.subscription_uuid}`
  )

  return {
    status: 'rolled-back',
    note: `Removed pending price change: ${subscription.unitAmount} -> ${subscription.pendingChange.unitAmount}`,
    subscription,
  }
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
 * Validate that the pending change is a price-only change created by our
 * price increase script, and not a user-initiated plan change or add-on modification.
 *
 * @param {CSVSubscriptionChange} record - The CSV record with expected values
 * @param {Subscription} subscription - The Recurly subscription
 * @returns {{ isPriceOnly: boolean, reason?: string, detail?: string }}
 */
function validatePriceOnlyChange(record, subscription) {
  const pendingChange = subscription.pendingChange

  // Check 1: Must have a pending change
  if (pendingChange == null) {
    return {
      isPriceOnly: false,
      reason: 'no-pending-change',
      detail: 'subscription has no pending change to rollback',
    }
  }

  // Check 2: Subscription must be active
  if (subscription.state !== 'active') {
    return {
      isPriceOnly: false,
      reason: 'inactive',
      detail: `subscription state: ${subscription.state}`,
    }
  }

  // Check 3: Plan code must match expected (from CSV)
  if (subscription.plan.code !== record.plan_code) {
    return {
      isPriceOnly: false,
      reason: 'plan-mismatch',
      detail: `expected plan ${record.plan_code}, got ${subscription.plan.code}`,
    }
  }

  // Check 4: Pending change must be for the SAME plan (not a downgrade/upgrade)
  if (pendingChange.plan.code !== subscription.plan.code) {
    return {
      isPriceOnly: false,
      reason: 'plan-change-detected',
      detail: `pending plan change: ${subscription.plan.code} -> ${pendingChange.plan.code}`,
    }
  }

  // Check 5: Currency must match
  if (subscription.currency !== record.currency) {
    return {
      isPriceOnly: false,
      reason: 'currency-mismatch',
      detail: `expected ${record.currency}, got ${subscription.currency}`,
    }
  }

  // Check 6: Current price must match expected (from CSV)
  if (Math.abs(subscription.unitAmount - record.unit_amount) > 0.01) {
    return {
      isPriceOnly: false,
      reason: 'current-price-mismatch',
      detail: `expected current price ${record.unit_amount}, got ${subscription.unitAmount}`,
    }
  }

  // Check 7: Pending price must match expected new price (from CSV)
  if (Math.abs(pendingChange.unitAmount - record.new_unit_amount) > 0.01) {
    return {
      isPriceOnly: false,
      reason: 'pending-price-mismatch',
      detail: `expected pending price ${record.new_unit_amount}, got ${pendingChange.unitAmount}`,
    }
  }

  // Check 8: Add-on codes must be the same (no add-ons added or removed)
  const currentAddOnCodes = new Set(
    (subscription.addOns || []).map(a => a.addOn.code)
  )
  const pendingAddOnCodes = new Set(
    (pendingChange.addOns || []).map(a => a.addOn.code)
  )

  if (!setsEqual(currentAddOnCodes, pendingAddOnCodes)) {
    return {
      isPriceOnly: false,
      reason: 'addon-change-detected',
      detail: `current add-ons: [${[...currentAddOnCodes]}], pending: [${[...pendingAddOnCodes]}]`,
    }
  }

  // Check 9: Add-on quantities must be the same
  for (const currentAddOn of subscription.addOns || []) {
    const pendingAddOn = (pendingChange.addOns || []).find(
      a => a.addOn.code === currentAddOn.addOn.code
    )
    if (pendingAddOn && pendingAddOn.quantity !== currentAddOn.quantity) {
      return {
        isPriceOnly: false,
        reason: 'addon-quantity-change-detected',
        detail: `${currentAddOn.addOn.code}: quantity ${currentAddOn.quantity} -> ${pendingAddOn.quantity}`,
      }
    }
  }

  // Check 10: Validate add-on prices if provided in CSV
  if (record.subscription_add_on_unit_amount_in_cents != null) {
    const additionalLicenseAddOn = (subscription.addOns || []).find(
      a => a.addOn.code === 'additional-license'
    )

    if (additionalLicenseAddOn == null) {
      return {
        isPriceOnly: false,
        reason: 'addon-mismatch',
        detail: 'expected additional-license add-on but not found',
      }
    }

    const expectedCurrentAddOnPrice =
      record.subscription_add_on_unit_amount_in_cents / 100
    if (
      Math.abs(additionalLicenseAddOn.unitAmount - expectedCurrentAddOnPrice) >
      0.01
    ) {
      return {
        isPriceOnly: false,
        reason: 'addon-price-mismatch',
        detail: `expected add-on price ${expectedCurrentAddOnPrice}, got ${additionalLicenseAddOn.unitAmount}`,
      }
    }

    // Verify pending add-on price matches expected new price
    if (record.new_subscription_add_on_unit_amount_in_cents != null) {
      const pendingAddOn = (pendingChange.addOns || []).find(
        a => a.addOn.code === 'additional-license'
      )
      const expectedNewAddOnPrice =
        record.new_subscription_add_on_unit_amount_in_cents / 100

      if (pendingAddOn == null) {
        return {
          isPriceOnly: false,
          reason: 'pending-addon-mismatch',
          detail:
            'expected additional-license add-on in pending change but not found',
        }
      }

      if (Math.abs(pendingAddOn.unitAmount - expectedNewAddOnPrice) > 0.01) {
        return {
          isPriceOnly: false,
          reason: 'pending-addon-price-mismatch',
          detail: `expected pending add-on price ${expectedNewAddOnPrice}, got ${pendingAddOn.unitAmount}`,
        }
      }
    }
  }

  // All checks passed - this is a price-only change we created
  return { isPriceOnly: true }
}

/**
 * Check if two sets are equal
 * @param {Set<string>} a - First set
 * @param {Set<string>} b - Second set
 * @returns {boolean} True if sets are equal
 */
function setsEqual(a, b) {
  return a.size === b.size && [...a].every(x => b.has(x))
}

const paramsSchema = z.object({
  output: z.string().optional(),
  commit: z.boolean().default(false),
  throttle: z
    .string()
    .optional()
    .transform(val => (val ? parseInt(val, 10) : DEFAULT_THROTTLE)),
  _: z.array(z.string()).max(1),
  help: z.boolean().optional(),
})

/**
 * Parse command line arguments
 * @returns {{inputFile: string | undefined, output: string | undefined, commit: boolean, throttle: number}} Parsed options
 */
function parseArgs() {
  const argv = minimist(process.argv.slice(2), {
    string: ['throttle', 'output'],
    boolean: ['help', 'commit'],
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

  const { output, commit, throttle, _ } = parseResult.data

  return {
    inputFile: _[0],
    output,
    commit,
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
