#!/usr/bin/env node

/**
 * This script marks as archived all prices with a matching version key in their lookup key
 *
 * Usage:
 *   node scripts/stripe/archive_prices_by_version_key.mjs --region us --version versionKey [options]
 *   node scripts/stripe/archive_prices_by_version_key.mjs --region uk --version versionKey [options]
 *
 * Options:
 *   --region           Required. Stripe region to process (us or uk)
 *   --version          Required. Version key to match in lookup keys (e.g., 'jul2025')
 *   --action           Required. Action to perform: 'archive' or 'unarchive'
 *   --commit           Actually perform the updates (default: dry-run mode)
 *
 * Examples:
 *   # Dry run archive prices with version 'jul2025' in US region
 *   node scripts/stripe/archive_prices_by_version_key.mjs --region us --version jul2025 --action archive
 *
 *   # Commit archive prices with version 'jul2025' in UK region
 *   node scripts/stripe/archive_prices_by_version_key.mjs --region uk --version jul2025 --action archive --commit
 *
 *   # Unarchive prices with version 'jul2025'
 *   node scripts/stripe/archive_prices_by_version_key.mjs --region us --version jul2025 --action unarchive --commit
 */

import minimist from 'minimist'
import { z } from '../../app/src/infrastructure/Validation.mjs'
import { scriptRunner } from '../lib/ScriptRunner.mjs'
import { getRegionClient } from '../../modules/subscriptions/app/src/StripeClient.mjs'

/**
 * @import Stripe from 'stripe'
 */

const paramsSchema = z.object({
  region: z.enum(['us', 'uk']),
  version: z.string(),
  action: z.enum(['archive', 'unarchive']),
  commit: z.boolean().default(false),
})

/**
 * Sleep function to respect Stripe rate limits (100 requests per second)
 */
async function rateLimitSleep() {
  return new Promise(resolve => setTimeout(resolve, 50))
}

/**
 * Check if a price has active subscriptions (if an active subscription has
 * archived prices, those customers will run into issues modifying their
 * subscriptions)
 *
 * @param {Stripe} stripe
 * @param {string} priceId
 * @returns {Promise<boolean>}
 */
async function getHasActiveSubscriptions(stripe, priceId) {
  const potentiallyActiveStatuses = [
    'active',
    'trialing',
    'past_due',
    'unpaid',
    'paused',
    'incomplete',
  ]
  let hasMore = true
  let startingAfter

  while (hasMore) {
    const params = {
      price: priceId,
      limit: 100,
    }
    if (startingAfter) {
      params.starting_after = startingAfter
    }
    const subscriptions = await stripe.subscriptions.list(params)
    await rateLimitSleep()

    const hasActiveInBatch = subscriptions.data.some(subscription =>
      potentiallyActiveStatuses.includes(subscription.status)
    )

    if (hasActiveInBatch) {
      return true
    }

    hasMore = subscriptions.has_more

    if (hasMore && subscriptions.data.length > 0) {
      startingAfter = subscriptions.data[subscriptions.data.length - 1].id
    }
  }

  return false
}

/**
 * Fetch all prices matching the version key from Stripe
 *
 * @param {Stripe} stripe
 * @param {string} version
 * @param {function} trackProgress
 * @returns {Promise<Stripe.Price[]>}
 */
async function fetchPricesByVersion(stripe, version, trackProgress) {
  const matchingPrices = []
  let hasMore = true
  let startingAfter

  await trackProgress('Fetching prices from Stripe...')

  while (hasMore) {
    const pricesResult = await stripe.prices.list({
      limit: 100,
      starting_after: startingAfter,
    })

    // Filter prices that have the version in their lookup key
    const filtered = pricesResult.data.filter(
      price => price.lookup_key && price.lookup_key.includes(version)
    )

    matchingPrices.push(...filtered)
    hasMore = pricesResult.has_more

    if (hasMore) {
      startingAfter = pricesResult.data[pricesResult.data.length - 1].id
    }

    await rateLimitSleep()
  }

  await trackProgress(`Found ${matchingPrices.length} matching prices...`)
  return matchingPrices
}

/**
 * Archive or unarchive prices in Stripe
 *
 * @param {Stripe.Price[]} prices
 * @param {Stripe} stripe
 * @param {string} action
 * @param {boolean} commit
 * @param {function} trackProgress
 * @returns {Promise<object>}
 */
async function processPrices(prices, stripe, action, commit, trackProgress) {
  const targetActiveStatus = action === 'unarchive'
  const results = {
    processed: 0,
    skipped: 0,
    hasSubscriptions: 0,
    errored: 0,
  }

  // pre-filter prices already in the desired state to avoid unnecessary API calls
  const pricesToProcess = []
  for (const price of prices) {
    const hasArchivedNickname = price.nickname?.includes('[ARCHIVED]')
    const alreadyInDesiredState =
      action === 'archive'
        ? hasArchivedNickname
        : price.active && !hasArchivedNickname

    if (alreadyInDesiredState) {
      await trackProgress(
        `Skipping price ${price.id} (${price.lookup_key}) - already ${price.active ? 'active' : 'archived'}`
      )
      results.skipped++
    } else {
      pricesToProcess.push(price)
    }
  }

  if (pricesToProcess.length === 0) {
    return results
  }

  await trackProgress(`Processing ${pricesToProcess.length} prices...`)

  for (const price of pricesToProcess) {
    try {
      const hasActiveSubscriptions =
        action === 'archive'
          ? await getHasActiveSubscriptions(stripe, price.id)
          : false
      if (hasActiveSubscriptions) {
        results.hasSubscriptions++
      }

      if (commit) {
        const updateParams = {}

        if (!hasActiveSubscriptions) {
          updateParams.active = targetActiveStatus
        }

        if (action === 'archive' && !price.nickname?.includes('[ARCHIVED]')) {
          updateParams.nickname = price.nickname
            ? `[ARCHIVED] ${price.nickname}`
            : '[ARCHIVED]'
        }
        if (action === 'unarchive' && price.nickname?.includes('[ARCHIVED]')) {
          updateParams.nickname = price.nickname.replace(/^\[ARCHIVED\]\s*/, '')
        }

        if (Object.keys(updateParams).length > 0) {
          await stripe.prices.update(price.id, updateParams)
          const statusNote = hasActiveSubscriptions
            ? '(nickname only - has active subscriptions)'
            : ''
          await trackProgress(
            `${action === 'archive' ? 'Archived' : 'Unarchived'} price: ${price.id} (${price.lookup_key}) ${statusNote}`
          )
          await rateLimitSleep()
        }
      } else {
        const statusNote = hasActiveSubscriptions
          ? '(nickname only - has active subscriptions)'
          : ''
        await trackProgress(
          `[DRY RUN] Would ${action} price: ${price.id} (${price.lookup_key}) ${statusNote}`
        )
      }

      results.processed++
    } catch (error) {
      await trackProgress(
        `ERROR processing price ${price.id}: ${error.message}`
      )
      results.errored++
    }
  }

  return results
}

async function main(trackProgress) {
  const parseResult = paramsSchema.safeParse(
    minimist(process.argv.slice(2), {
      boolean: ['commit'],
      string: ['region', 'version', 'action'],
    })
  )

  if (!parseResult.success) {
    throw new Error(`Invalid parameters: ${parseResult.error.message}`)
  }

  const { region, version, action, commit } = parseResult.data

  const mode = commit ? 'COMMIT MODE' : 'DRY RUN MODE'
  await trackProgress(`Starting ${action} in ${mode} for region: ${region}`)
  await trackProgress(`Target version: ${version}`)

  const stripe = getRegionClient(region).stripe

  const prices = await fetchPricesByVersion(stripe, version, trackProgress)

  if (prices.length === 0) {
    await trackProgress('No prices found. Exiting.')
    return
  }

  await trackProgress(`Processing ${action} operation...`)
  const results = await processPrices(
    prices,
    stripe,
    action,
    commit,
    trackProgress
  )

  await trackProgress('OPERATION SUMMARY')
  await trackProgress(
    `Prices ${commit ? 'processed' : 'would be processed'}: ${results.processed}`
  )
  await trackProgress(
    `Prices skipped (already in desired state): ${results.skipped}`
  )
  await trackProgress(
    `Prices skipped (has active subscriptions): ${results.hasSubscriptions}`
  )
  await trackProgress(`Prices errored: ${results.errored}`)

  if (results.errored > 0) {
    await trackProgress(
      'WARNING: Some prices failed to process. Check the logs above.'
    )
  }

  if (!commit) {
    await trackProgress(
      'This was a dry run. Use --commit to actually perform the operation.'
    )
  }

  await trackProgress(`Script completed in ${mode}`)
}

try {
  await scriptRunner(main)
  process.exit(0)
} catch (error) {
  console.error('Script failed:', error.message)
  process.exit(1)
}
