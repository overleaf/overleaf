#!/usr/bin/env node

/**
 * This script changes prices for existing Stripe subscriptions.
 * It schedules changes to apply at the next renewal.
 *
 * Usage:
 *   node scripts/stripe/change_existing_subscription_prices.mjs [OPTS] [INPUT-FILE]
 *
 * Options:
 *   --region REGION        Either 'uk' or 'us' (required)
 *   --timeframe TIMEFRAME  Either 'renewal' or 'now' (default: renewal)
 *   --output PATH          Output file path (default: /tmp/change_prices_output_<timestamp>.csv)
 *                          Use '-' to write to stdout
 *   --commit               Apply changes (without this flag, runs in dry-run mode)
 *   --throttle DURATION    Minimum time (in ms) between subscriptions processed (default: 100)
 *   --force                Overwrite any existing pending changes
 *   --help                 Show a help message
 *
 * CSV Input Format:
 *   The CSV must have the following columns:
 *   - subscription_id: Stripe subscription id
 *   - current_lookup_key: Current price lookup key
 *   - new_lookup_key: New price lookup key
 *   - current_add_on_lookup_key: Current price lookup key for add-on (optional)
 *   - new_add_on_lookup_key: New price lookup key for add-on (optional)
 *
 * Output:
 *   Writes a CSV with columns:
 *   - subscription_id: The subscription id processed
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
 *      kubectl exec -it <pod-name> -- node scripts/stripe/change_existing_subscription_prices.mjs \
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
import AnalyticsManager from '../../app/src/Features/Analytics/AnalyticsManager.mjs'
import { z } from '../../app/src/infrastructure/Validation.mjs'
import { scriptRunner } from '../lib/ScriptRunner.mjs'
import { getRegionClient } from '../../modules/subscriptions/app/src/StripeClient.mjs'
import {
  ReportError,
  getProductIdFromPrice,
  getProductIdFromItem,
  getPriceIdFromItem,
} from './helpers.mjs'

/**
 * @import { CSVSubscriptionChange, Timeframe, StripeClient } from './helpers.mjs'
 * @import Stripe from 'stripe'
 * @import { ReadStream } from 'node:fs'
 * @import { Parser } from 'csv-parse'
 * @import { Stringifier } from 'csv-stringify'
 */

// 100 ms corresponds to 10 requests per second (cautious rate within Stripe's 100 req/s limit)
const DEFAULT_THROTTLE = 100

/**
 * cache for price objects to avoid redundant Stripe API calls
 * @type {Map<string, Stripe.Price>}
 */
const priceCache = new Map()

/**
 * Print usage information to stderr
 */
function usage() {
  console.error(`Usage: node scripts/stripe/change_existing_subscription_prices.mjs [OPTS] [INPUT-FILE]

Options:
    --region REGION        Either 'uk' or 'us' (required)
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

  const stripeClient = getRegionClient(opts.region)

  await trackProgress('Starting price change script for Stripe')
  await trackProgress(`Region: ${opts.region}`)
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
        stripeClient,
        opts.commit,
        opts.force,
        opts.timeframe
      )

      if (opts.commit && subscription) {
        try {
          const userId = subscription.customer.metadata?.userId
          await AnalyticsManager.recordEventForUser(
            userId,
            'script_price_change',
            {
              subscriptionId: change.subscription_id,
            }
          )
        } catch (err) {
          await trackProgress(
            `Warning: failed to record analytics event after successful price change for ${change.subscription_id}: ${err.message}`
          )
        }
      }

      csvWriter.write({
        subscription_id: change.subscription_id,
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
          subscription_id: change.subscription_id,
          status: err.status,
          note: err.message,
        })
      } else {
        csvWriter.write({
          subscription_id: change.subscription_id,
          status: 'error',
          note: err.message,
        })
        await trackProgress(
          `Error processing ${change.subscription_id}: ${err.message}`
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
    await trackProgress('ℹ️  DRY RUN: No changes were applied to Stripe')
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
 * Process a single subscription change
 * @param {CSVSubscriptionChange} change - The subscription change to process
 * @param {StripeClient} stripeClient - The Stripe client for the region
 * @param {boolean} commit - Whether to commit changes or run in dry-run mode
 * @param {boolean} force - Whether to overwrite existing pending changes
 * @param {Timeframe} timeframe - When to apply the change
 * @returns {Promise<Stripe.Subscription | undefined>} The subscription if commit mode, undefined otherwise
 */
async function processChange(change, stripeClient, commit, force, timeframe) {
  const subscription = await fetchSubscription(
    change.subscription_id,
    stripeClient
  )

  const nextPrices = await fetchPrices(
    [change.new_lookup_key, change.new_add_on_lookup_key].filter(Boolean),
    stripeClient
  )

  validateChange(change, subscription, nextPrices, force)

  if (!commit) {
    // dry run mode - validation passed, no changes applied
    return
  }

  let updatedSubscription
  if (timeframe === 'now') {
    updatedSubscription = await updateSubscriptionImmediately(
      subscription,
      stripeClient,
      nextPrices
    )
  } else {
    updatedSubscription = await createSubscriptionSchedule(
      subscription,
      stripeClient,
      nextPrices
    )
  }

  return updatedSubscription
}

/**
 * Fetch a subscription from Stripe
 * @param {string} subscriptionId - The Stripe subscription id
 * @param {StripeClient} stripeClient - The Stripe client for the region
 * @returns {Promise<Stripe.Subscription>} The subscription with expanded items and schedule
 * @throws {ReportError} If subscription is not found
 */
async function fetchSubscription(subscriptionId, stripeClient) {
  try {
    const subscription = await stripeClient.stripe.subscriptions.retrieve(
      subscriptionId,
      {
        expand: ['schedule', 'discounts'],
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
 * Fetch price entities from Stripe with caching
 * @param {string[]} lookupKeys
 * @param {StripeClient} stripeClient - The Stripe client for the region
 * @returns {Promise<Stripe.Price[]>} the fetched prices
 * @throws {ReportError} If price is not found
 */
async function fetchPrices(lookupKeys, stripeClient) {
  if (lookupKeys.length === 0) {
    throw new ReportError('not-found', 'no lookup keys provided')
  }

  const cachedPrices = []
  const keysToFetch = []

  for (const key of lookupKeys) {
    if (priceCache.has(key)) {
      cachedPrices.push(priceCache.get(key))
    } else {
      keysToFetch.push(key)
    }
  }

  if (keysToFetch.length === 0) {
    return cachedPrices
  }

  try {
    const results = await stripeClient.stripe.prices.list({
      lookup_keys: keysToFetch,
      limit: keysToFetch.length,
    })

    if (results.data.length === 0) {
      throw new ReportError(
        'not-found',
        `${keysToFetch.join(', ')} prices not found in Stripe`
      )
    }

    for (const price of results.data) {
      priceCache.set(price.lookup_key, price)
    }

    return [...cachedPrices, ...results.data]
  } catch (err) {
    if (err.type === 'StripeInvalidRequestError' && err.statusCode === 404) {
      throw new ReportError(
        'not-found',
        `${keysToFetch.join(', ')} prices not found in Stripe`
      )
    }
    throw err
  }
}

/**
 * Helper function to validate that the proposed price looks correct
 * @param {Stripe.Price} currentPrice - The current price
 * @param {Stripe.Price[]} nextPrices - Available next prices
 * @throws {ReportError} If validation fails
 */
function validateProposedPrice(currentPrice, nextPrices) {
  const currentProductId = getProductIdFromPrice(currentPrice)

  if (!currentProductId) {
    throw new ReportError('mismatch', 'current price has no associated product')
  }

  // Find matching new price by product ID
  const matchingNewPrice = nextPrices.find(p => {
    const nextProductId = getProductIdFromPrice(p)
    return nextProductId === currentProductId
  })

  // Verify new price with matching product exists
  if (!matchingNewPrice) {
    throw new ReportError(
      'mismatch',
      `no new prices found belonging to the same product: current ${currentProductId}`
    )
  }

  // Verify currency matches
  if (currentPrice.currency !== matchingNewPrice.currency) {
    throw new ReportError(
      'mismatch',
      `currency mismatch found: current ${currentPrice.currency}, new ${matchingNewPrice.currency}`
    )
  }
}

/**
 * Validate that the subscription matches the expected state
 * @param {CSVSubscriptionChange} change - The subscription change to validate
 * @param {Stripe.Subscription} subscription - The Stripe subscription
 * @param {Stripe.Price[]} nextPrices - The next prices for the subscription
 * @param {boolean} force - Whether to ignore existing pending changes
 * @throws {ReportError} If validation fails
 */
function validateChange(change, subscription, nextPrices, force) {
  // Check subscription is updatable
  const inactiveStatuses = [
    'incomplete',
    'incomplete_expired',
    'canceled',
    'trialing',
  ]
  if (inactiveStatuses.includes(subscription.status)) {
    throw new ReportError(
      'inactive',
      `subscription status: ${subscription.status}`
    )
  }

  // Skip subscriptions that are scheduled to be canceled
  if (subscription.cancel_at_period_end) {
    throw new ReportError(
      'inactive',
      'subscription is scheduled to be canceled at period end'
    )
  }

  // Skip subscriptions that already have a schedule (unless force mode)
  if (subscription.schedule && !force) {
    if (typeof subscription.schedule === 'string') {
      throw new ReportError(
        'pending-change',
        `subscription has a schedule (${subscription.schedule}) - re-run with expanded schedule data`
      )
    }
    if (subscription.schedule.status !== 'released') {
      throw new ReportError(
        'pending-change',
        'subscription already has an active schedule'
      )
    }
  }

  // Verify all requested next prices were found
  const requestedLookupKeys = [
    change.new_lookup_key,
    change.new_add_on_lookup_key,
  ].filter(Boolean)

  for (const requestedKey of requestedLookupKeys) {
    if (!nextPrices.find(p => p.lookup_key === requestedKey)) {
      throw new ReportError(
        'not-found',
        `requested price with lookup key ${requestedKey} not found in Stripe`
      )
    }
  }

  // Verify current lookup keys exist in subscription
  const currentLookupKey = change.current_lookup_key
  const currentItem = subscription.items.data.find(
    item => item.price.lookup_key === currentLookupKey
  )
  if (!currentItem) {
    throw new ReportError(
      'mismatch',
      `current_lookup_key ${currentLookupKey} not found in subscription items`
    )
  }

  if (change.current_add_on_lookup_key) {
    const currentAddOnItem = subscription.items.data.find(
      item => item.price.lookup_key === change.current_add_on_lookup_key
    )
    if (!currentAddOnItem) {
      throw new ReportError(
        'mismatch',
        `current_add_on_lookup_key ${change.current_add_on_lookup_key} not found in subscription items`
      )
    }
  }

  // Verify the proposed new prices match the current prices' products
  // For plan price
  const currentPrice = currentItem.price
  validateProposedPrice(currentPrice, nextPrices)

  // For add-on price (if present)
  if (change.current_add_on_lookup_key) {
    const currentAddOnItem = subscription.items.data.find(
      item => item.price.lookup_key === change.current_add_on_lookup_key
    )
    const currentAddOnPrice = currentAddOnItem.price
    validateProposedPrice(currentAddOnPrice, nextPrices)
  }
}

/**
 * Helper function to find a matching new price for a subscription item
 * @param {Stripe.SubscriptionItem} item - The subscription item
 * @param {Stripe.Price[]} nextPrices - Available next prices
 * @returns {string} The matching price ID or the current price ID if no match
 */
function findMatchingPriceId(item, nextPrices) {
  const itemProductId = getProductIdFromItem(item)

  if (!itemProductId) {
    // No product ID available, keep current price
    return item.price.id
  }

  // Find matching new price by product ID
  const matchingPrice = nextPrices.find(price => {
    const priceProductId = getProductIdFromPrice(price)
    return priceProductId === itemProductId
  })

  return matchingPrice?.id || item.price.id
}

/**
 * Update subscription prices immediately without proration
 * @param {Stripe.Subscription} subscription - The Stripe subscription
 * @param {StripeClient} stripeClient - The Stripe client for the region
 * @param {Stripe.Price[]} nextPrices - The next prices for the subscription
 * @returns {Promise<Stripe.Subscription>} The updated subscription
 * @throws {Error} If unable to build lookup key for plan
 * @throws {ReportError} If new price doesn't match expected price
 */
async function updateSubscriptionImmediately(
  subscription,
  stripeClient,
  nextPrices
) {
  // Release any existing schedule. This only executes when --force is enabled,
  // as validation would have rejected subscriptions with active schedules otherwise.
  if (
    subscription.schedule &&
    typeof subscription.schedule !== 'string' &&
    subscription.schedule.status !== 'released'
  ) {
    await stripeClient.stripe.subscriptionSchedules.release(
      subscription.schedule.id
    )
  }

  // NOTE: The `id` field is required for all items when using this endpoint,
  // otherwise Stripe will append the subscription with the new item instead of
  // replacing the current item.
  const subscriptionItems = subscription.items.data.map(item => ({
    id: item.id,
    price: findMatchingPriceId(item, nextPrices),
    quantity: item.quantity || 1,
  }))

  const updatedSubscription = await stripeClient.stripe.subscriptions.update(
    subscription.id,
    {
      items: subscriptionItems,
      proration_behavior: 'none',
      expand: ['customer'],
    }
  )

  return updatedSubscription
}

/**
 * Create a subscription schedule to change prices at renewal
 * @param {Stripe.Subscription} subscription - The Stripe subscription
 * @param {StripeClient} stripeClient - The Stripe client for the region
 * @param {Stripe.Price[]} nextPrices - The next prices for the subscription
 * @returns {Promise<Stripe.Subscription>} The updated subscription
 * @throws {Error} If unable to build lookup key for plan
 * @throws {ReportError} If new price doesn't match expected price
 */
async function createSubscriptionSchedule(
  subscription,
  stripeClient,
  nextPrices
) {
  // Release any existing schedule. This only executes when --force is enabled,
  // as validation would have rejected subscriptions with active schedules otherwise.
  if (
    subscription.schedule &&
    typeof subscription.schedule !== 'string' &&
    subscription.schedule.status !== 'released'
  ) {
    await stripeClient.stripe.subscriptionSchedules.release(
      subscription.schedule.id
    )
  }

  // NOTE: The `id` field cannot be used with this endpoint
  const nextPhaseItems = subscription.items.data.map(item => ({
    price: findMatchingPriceId(item, nextPrices),
    quantity: item.quantity || 1,
  }))

  // Create a subscription schedule
  const schedule = await stripeClient.stripe.subscriptionSchedules.create({
    from_subscription: subscription.id,
    expand: ['subscription', 'subscription.customer'],
  })

  const currentPhase = schedule.phases[0]

  // Update the schedule to include the new phase starting at the end of the current billing period
  // If the update fails, release the schedule to clean up the state
  try {
    const currentPhaseConfig = {
      start_date: currentPhase.start_date,
      end_date: currentPhase.end_date,
      items: currentPhase.items.map(item => ({
        price: getPriceIdFromItem(item),
        quantity: item.quantity,
      })),
    }

    const nextPhaseConfig = {
      start_date: currentPhase.end_date,
      items: nextPhaseItems,
    }

    // Stripe doesn't copy discount settings from subscription to schedule
    // so we need to manually preserve them
    if (subscription.discounts) {
      const discounts = subscription.discounts
        .map(discount => {
          if (discount.promotion_code) {
            return {
              promotion_code: discount.promotion_code,
            }
          } else if (discount.coupon) {
            return {
              coupon:
                typeof discount.coupon === 'string'
                  ? discount.coupon
                  : discount.coupon.id,
            }
          }
          return {}
        })
        .filter(d => d.coupon || d.promotion_code)

      currentPhaseConfig.discounts = discounts
      nextPhaseConfig.discounts = discounts
    }

    await stripeClient.stripe.subscriptionSchedules.update(schedule.id, {
      phases: [currentPhaseConfig, nextPhaseConfig],
      end_behavior: 'release',
    })
  } catch (err) {
    // If the update fails, release the schedule to prevent it from remaining in an invalid state
    try {
      await stripeClient.stripe.subscriptionSchedules.release(schedule.id)
    } catch (releaseErr) {
      // Do nothing, and throw the original error
    }
    throw err
  }

  return schedule.subscription
}

const paramsSchema = z.object({
  region: z.enum(['uk', 'us']),
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
 * @returns {{inputFile: string | undefined, output: string | undefined, force: boolean, commit: boolean, timeframe: 'renewal' | 'now', throttle: number, region: 'uk' | 'us'}} Parsed options
 */
function parseArgs() {
  const argv = minimist(process.argv.slice(2), {
    string: ['throttle', 'timeframe', 'output', 'region'],
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

  const { region, timeframe, output, commit, force, throttle, _ } =
    parseResult.data

  return {
    inputFile: _[0],
    output,
    force,
    commit,
    timeframe,
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
