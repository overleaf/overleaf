#!/usr/bin/env node

/**
 * Rollback pending price changes for Stripe subscriptions
 *
 * This script removes pending subscription schedule changes that were created by the
 * change_existing_subscription_prices.mjs script. It only removes schedules that
 * are purely price changes on an existing plan - if the user has made any other
 * modifications (plan change, add-on changes), the pending change is left untouched.
 *
 * Usage:
 *   node scripts/stripe/rollback_price_changes.mjs [OPTIONS] [INPUT-FILE]
 *
 * Options:
 *   --region REGION        Either 'uk' or 'us' (required)
 *   --output PATH          Output file path (default: /tmp/rollback_prices_output_<timestamp>.csv)
 *                          Use '-' to write to stdout
 *   --commit               Apply changes (without this flag, runs in dry-run mode)
 *   --throttle DURATION    Minimum time (in ms) between subscriptions processed (default: 100)
 *   --help                 Show a help message
 *
 * CSV Input Format:
 *   The CSV must have the following columns (same format as change_existing_subscription_prices.mjs):
 *   - subscription_id: Stripe subscription id
 *   - current_lookup_key: Current price lookup key
 *   - new_lookup_key: New price lookup key
 *   - current_add_on_lookup_key: Current price lookup key for add-on (optional)
 *   - new_add_on_lookup_key: New price lookup key for add-on (optional)
 *
 * Output:
 *   Writes a CSV with columns:
 *   - subscription_id: The subscription id processed
 *   - status: Result status (rolled-back, skipped, validated, not-found, or error)
 *   - note: Additional information about the status
 *
 * The script will SKIP (not rollback) a subscription if:
 *   - There is no active subscription schedule
 *   - The schedule involves a plan change (user downgrade/upgrade)
 *   - The schedule involves add-on additions/removals
 *   - The schedule involves add-on quantity changes
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
 *      kubectl exec -it <pod-name> -- node scripts/stripe/rollback_price_changes.mjs \
 *        --region us --commit --output - input.csv > output.csv
 *
 * Examples:
 *   # Dry run (preview only)
 *   node scripts/stripe/rollback_price_changes.mjs --region us input.csv
 *
 *   # Actually perform the rollback
 *   node scripts/stripe/rollback_price_changes.mjs --region us --commit input.csv
 */

import fs from 'node:fs'
import path from 'node:path'
import { setTimeout } from 'node:timers/promises'
import * as csv from 'csv'
import minimist from 'minimist'
import AnalyticsManager from '../../app/src/Features/Analytics/AnalyticsManager.mjs'
import { z } from '../../app/src/infrastructure/Validation.mjs'
import { scriptRunner } from '../lib/ScriptRunner.mjs'
import { getRegionClient } from '../../modules/subscriptions/app/src/StripeClient.mjs'
import { ReportError, getProductIdFromItem } from './helpers.mjs'

/**
 * @import { CSVSubscriptionChange, StripeClient } from './helpers.mjs'
 * @import Stripe from 'stripe'
 * @import { ReadStream } from 'node:fs'
 * @import { Parser } from 'csv-parse'
 * @import { Stringifier } from 'csv-stringify'
 */

// 100 ms corresponds to 10 requests per second (cautious rate within Stripe's 100 req/s limit)
const DEFAULT_THROTTLE = 100

/**
 * Print usage information to stderr
 */
function usage() {
  console.error(`Usage: node scripts/stripe/rollback_price_changes.mjs [OPTIONS] [INPUT-FILE]

Rollback pending price changes for Stripe subscriptions.

This script only removes pending subscription schedules that are purely price changes on an
existing plan. If a user has made any other modifications (plan change, add-on
changes), the subscription is skipped.

Options:
    --region REGION        Either 'uk' or 'us' (required)
    --output PATH          Output file path (default: /tmp/rollback_prices_output_<timestamp>.csv)
                           Use '-' to write to stdout
    --commit               Apply changes (without this, runs in dry-run mode)
    --throttle DURATION    Minimum time between requests in ms (default: ${DEFAULT_THROTTLE})
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
  const outputFile =
    opts.output ?? `/tmp/rollback_prices_output_${timestamp}.csv`

  const stripeClient = getRegionClient(opts.region)

  await trackProgress('Starting price rollback script for Stripe')
  await trackProgress(`Region: ${opts.region}`)
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
      const result = await processRollback(record, stripeClient, opts.commit)

      if (opts.commit && result.subscription) {
        try {
          const userId = result.subscription.customer.metadata?.userId
          await AnalyticsManager.recordEventForUser(
            userId,
            'script_price_change_reversed',
            {
              subscriptionId: record.subscription_id,
            }
          )
        } catch (err) {
          await trackProgress(
            `Warning: failed to record analytics event after successful price rollback for ${record.subscription_id}: ${err.message}`
          )
        }
      }

      csvWriter.write({
        subscription_id: record.subscription_id,
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
          subscription_id: record.subscription_id,
          status: err.status,
          note: err.message,
        })
      } else {
        csvWriter.write({
          subscription_id: record.subscription_id,
          status: 'error',
          note: err.message,
        })
        await trackProgress(
          `Error processing ${record.subscription_id}: ${err.message}`
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
    await trackProgress('ℹ️  DRY RUN: No changes were applied to Stripe')
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
    columns: ['subscription_id', 'status', 'note'],
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
 * @param {StripeClient} stripeClient - The Stripe client for the region
 * @param {boolean} commit - Whether to commit changes or run in dry-run mode
 * @returns {Promise<{status: string, note: string, subscription?: Stripe.Subscription}>} The result of the rollback
 */
async function processRollback(record, stripeClient, commit) {
  const subscription = await fetchSubscription(
    record.subscription_id,
    stripeClient
  )

  // Validate this is a price-only change that we created
  const validation = await validatePriceOnlyChange(
    record,
    subscription,
    stripeClient
  )

  if (!validation.isPriceOnly) {
    return {
      status: 'skipped',
      note: `${validation.reason}: ${validation.detail || 'N/A'}`,
    }
  }

  if (!commit) {
    return {
      status: 'validated',
      note: `Would release subscription schedule: ${validation.scheduleId}`,
    }
  }

  // Safe to release - this is a price-only change matching our expected values
  await stripeClient.stripe.subscriptionSchedules.release(validation.scheduleId)

  return {
    status: 'rolled-back',
    note: `Released subscription schedule: ${validation.scheduleId}`,
    subscription,
  }
}

/**
 * Fetch a subscription from Stripe
 * @param {string} subscriptionId - The Stripe subscription id
 * @param {StripeClient} stripeClient - The Stripe client for the region
 * @returns {Promise<Stripe.Subscription>} The subscription with expanded schedule
 * @throws {ReportError} If subscription is not found
 */
async function fetchSubscription(subscriptionId, stripeClient) {
  try {
    const subscription = await stripeClient.stripe.subscriptions.retrieve(
      subscriptionId,
      {
        expand: [
          'schedule',
          'schedule.phases.items.price',
          'items.data.price',
          'customer',
        ],
      }
    )
    return subscription
  } catch (err) {
    if (err.type === 'StripeInvalidRequestError' && err.statusCode === 404) {
      throw new ReportError('not-found', 'subscription not found')
    }
    throw err
  }
}

/**
 * Validate that the subscription schedule is a price-only change created by our
 * price increase script, and not a user-initiated plan change or add-on modification.
 *
 * @param {CSVSubscriptionChange} record - The CSV record with expected values
 * @param {Stripe.Subscription} subscription - The Stripe subscription
 * @param {StripeClient} stripeClient - The Stripe client for the region
 * @returns {Promise<{ isPriceOnly: boolean, reason?: string, detail?: string, scheduleId?: string }>}
 */
async function validatePriceOnlyChange(record, subscription, stripeClient) {
  // Must have a subscription schedule
  if (!subscription.schedule) {
    return {
      isPriceOnly: false,
      reason: 'no-pending-change',
      detail: 'subscription has no schedule to rollback',
    }
  }

  // Subscription must be updatable
  const inactiveStatuses = [
    'incomplete',
    'incomplete_expired',
    'canceled',
    'trialing',
  ]
  if (inactiveStatuses.includes(subscription.status)) {
    return {
      isPriceOnly: false,
      reason: 'inactive',
      detail: `subscription status: ${subscription.status}`,
    }
  }

  // Subscription should not be scheduled to be canceled
  if (subscription.cancel_at_period_end) {
    return {
      isPriceOnly: false,
      reason: 'inactive',
      detail: 'subscription is scheduled to be canceled at period end',
    }
  }

  // Get the schedule (already expanded in subscription fetch)
  const schedule =
    typeof subscription.schedule === 'string' ? null : subscription.schedule

  if (!schedule) {
    return {
      isPriceOnly: false,
      reason: 'no-pending-change',
      detail: 'subscription schedule not expanded',
    }
  }

  const scheduleId = schedule.id

  // Schedule must not be released already
  if (schedule.status === 'released') {
    return {
      isPriceOnly: false,
      reason: 'schedule-released',
      detail: 'schedule has already been released',
    }
  }

  // Schedule must have exactly 2 phases (current + future)
  if (schedule.phases.length !== 2) {
    return {
      isPriceOnly: false,
      reason: 'unexpected-schedule-structure',
      detail: `expected 2 phases, got ${schedule.phases.length}`,
    }
  }

  const currentPhase = schedule.phases[0]
  const nextPhase = schedule.phases[1]

  // All phases must have same number of items (no add-ons added/removed)
  const currentPhaseItemCount = currentPhase.items.length
  const subscriptionItemCount = subscription.items.data.length
  const nextPhaseItemCount = nextPhase.items.length

  if (currentPhaseItemCount !== subscriptionItemCount) {
    return {
      isPriceOnly: false,
      reason: 'item-count-mismatch',
      detail: `current phase has ${currentPhaseItemCount} items, subscription has ${subscriptionItemCount}`,
    }
  }

  if (nextPhaseItemCount !== currentPhaseItemCount) {
    return {
      isPriceOnly: false,
      reason: 'addon-change-detected',
      detail: `next phase has ${nextPhaseItemCount} items, current has ${currentPhaseItemCount}`,
    }
  }

  // Verify current lookup keys match expected
  const currentLookupKeys = new Set(
    subscription.items.data.map(item => item.price.lookup_key)
  )

  if (!currentLookupKeys.has(record.current_lookup_key)) {
    return {
      isPriceOnly: false,
      reason: 'current-price-mismatch',
      detail: `expected current_lookup_key ${record.current_lookup_key} not found in subscription`,
    }
  }

  if (
    record.current_add_on_lookup_key &&
    !currentLookupKeys.has(record.current_add_on_lookup_key)
  ) {
    return {
      isPriceOnly: false,
      reason: 'current-addon-price-mismatch',
      detail: `expected current_add_on_lookup_key ${record.current_add_on_lookup_key} not found in subscription`,
    }
  }

  // Verify next phase price IDs match expected
  const nextPhaseLookupKeys = new Set(
    nextPhase.items.map(item => item.price.lookup_key)
  )

  if (!nextPhaseLookupKeys.has(record.new_lookup_key)) {
    return {
      isPriceOnly: false,
      reason: 'pending-price-mismatch',
      detail: `expected new_lookup_key ${record.new_lookup_key} not found in next phase`,
    }
  }

  if (
    record.new_add_on_lookup_key &&
    !nextPhaseLookupKeys.has(record.new_add_on_lookup_key)
  ) {
    return {
      isPriceOnly: false,
      reason: 'pending-addon-price-mismatch',
      detail: `expected new_add_on_lookup_key ${record.new_add_on_lookup_key} not found in next phase`,
    }
  }

  // Verify quantities remain the same and products match (no plan/add-on changes)
  for (const currentItem of currentPhase.items) {
    const currentLookupKey = currentItem.price.lookup_key
    const currentProductId = getProductIdFromItem(currentItem)

    const nextItem = nextPhase.items.find(item => {
      const nextLookupKey = item.price.lookup_key
      const nextProductId = getProductIdFromItem(item)
      // Match by product ID to handle price changes
      return (
        nextLookupKey === currentLookupKey || nextProductId === currentProductId
      )
    })

    if (!nextItem) {
      return {
        isPriceOnly: false,
        reason: 'item-mismatch',
        detail: `current phase item ${currentLookupKey} not found in next phase`,
      }
    }

    // Verify quantity hasn't changed
    if (nextItem.quantity !== currentItem.quantity) {
      return {
        isPriceOnly: false,
        reason: 'quantity-change-detected',
        detail: `quantity change: ${currentItem.quantity} -> ${nextItem.quantity}`,
      }
    }

    // Verify product hasn't changed
    const nextProductId = getProductIdFromItem(nextItem)

    if (
      currentProductId &&
      nextProductId &&
      currentProductId !== nextProductId
    ) {
      return {
        isPriceOnly: false,
        reason: 'product-change-detected',
        detail: `product change: ${currentProductId} -> ${nextProductId}`,
      }
    }
  }

  // All checks passed - this is a price-only change we created
  return { isPriceOnly: true, scheduleId }
}

const paramsSchema = z.object({
  region: z.enum(['uk', 'us']),
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
 * @returns {{inputFile: string | undefined, output: string | undefined, commit: boolean, throttle: number, region: 'uk' | 'us'}} Parsed options
 */
function parseArgs() {
  const argv = minimist(process.argv.slice(2), {
    string: ['throttle', 'output', 'region'],
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

  const { region, output, commit, throttle, _ } = parseResult.data

  return {
    inputFile: _[0],
    output,
    commit,
    throttle,
    region,
  }
}

try {
  await scriptRunner(main)
  process.exit(0)
} catch (error) {
  console.error(error)
  process.exit(1)
}
