#!/usr/bin/env node

/**
 * This script iterates through all Stripe subscriptions and removes the adminUserId metadata
 * from subscription objects that have it.
 *
 * Usage:
 *   node scripts/stripe/remove_admin_user_id_from_stripe_subscription.mjs --region=us [options]
 *   node scripts/stripe/remove_admin_user_id_from_stripe_subscription.mjs --region=uk [options]
 *
 * Options:
 *   --region=us|uk     Required. Stripe region to process (us or uk)
 *   --commit           Actually perform the updates (default: dry-run mode)
 *   --verbose          Enable verbose logging
 *   --limit=N          Limit processing to N subscriptions (for testing)
 *
 * Examples:
 *   # Dry run for US region with verbose output
 *   node scripts/stripe/remove_admin_user_id_from_stripe_subscription.mjs --region=us --verbose
 *
 *   # Commit changes for UK region
 *   node scripts/stripe/remove_admin_user_id_from_stripe_subscription.mjs --region=uk --commit
 *
 *   # Test with limited subscriptions
 *   node scripts/stripe/remove_admin_user_id_from_stripe_subscription.mjs --region=us --limit=10 --verbose
 */

import minimist from 'minimist'
import { z } from '../../app/src/infrastructure/Validation.mjs'
import { scriptRunner } from '../lib/ScriptRunner.mjs'
import { getRegionClient } from '../../modules/subscriptions/app/src/StripeClient.mjs'

const paramsSchema = z.object({
  region: z.enum(['us', 'uk']),
  commit: z.boolean().default(false),
  verbose: z.boolean().default(false),
  limit: z.number().int().min(1).optional(),
})

let processedCount = 0
let updatedCount = 0
let errorCount = 0

/**
 * Sleep function to respect Stripe rate limits (100 requests per second)
 * We'll be conservative and sleep for 50ms between requests to stay well under the limit
 */
async function rateLimitSleep() {
  return new Promise(resolve => setTimeout(resolve, 50))
}

/**
 * Process a single subscription and remove adminUserId metadata if present
 */
async function processSubscription(
  subscription,
  stripeClient,
  commit,
  verbose
) {
  try {
    processedCount++

    // Check if subscription has adminUserId metadata
    const adminUserId = subscription.metadata?.adminUserId

    if (verbose) {
      console.info(
        `Processing subscription ${subscription.id} - adminUserId: ${adminUserId || 'none'}`
      )
    }

    if (!adminUserId) {
      // No adminUserId to remove
      return
    }

    if (commit) {
      // Create a new metadata object that will remove adminUserId
      const updatedMetadata = { ...subscription.metadata }
      updatedMetadata.adminUserId = ''

      // Update subscription metadata using Stripe API directly
      await stripeClient.stripe.subscriptions.update(subscription.id, {
        metadata: updatedMetadata,
      })

      console.info(
        `Removed adminUserId metadata from subscription ${subscription.id}`
      )
    } else {
      console.info(
        `DRY RUN: Would remove adminUserId metadata from subscription ${subscription.id}`
      )
    }

    updatedCount++
  } catch (error) {
    errorCount++
    console.log(error)
  }

  // Respect rate limits
  await rateLimitSleep()
}

/**
 * Main script function
 */
async function main(trackProgress) {
  const parseResult = paramsSchema.safeParse(
    minimist(process.argv.slice(2), {
      boolean: ['commit', 'verbose'],
      string: ['region'],
      number: ['limit'],
    })
  )

  if (!parseResult.success) {
    throw new Error(`Invalid parameters: ${parseResult.error.message}`)
  }

  const { region, commit, verbose, limit } = parseResult.data

  const mode = commit ? 'COMMIT MODE' : 'DRY RUN MODE'
  await trackProgress(
    `Starting script in ${mode} for Stripe ${region.toUpperCase()} region`
  )

  if (limit) {
    await trackProgress(`Processing limited to ${limit} subscriptions`)
  }

  // Get Stripe client for the specified region
  const stripeClient = getRegionClient(region)

  // Reset counters
  processedCount = 0
  updatedCount = 0
  errorCount = 0

  await trackProgress('Starting to iterate through Stripe subscriptions...')

  const listParams = {
    limit: 100, // Stripe's maximum limit per request
  }

  let hasMore = true
  let startingAfter = null
  let totalProcessed = 0

  while (hasMore) {
    const params = { ...listParams }
    if (startingAfter) {
      params.starting_after = startingAfter
    }

    // Get batch of subscriptions
    const subscriptions = await stripeClient.stripe.subscriptions.list(params)

    await trackProgress(
      `Retrieved ${subscriptions.data.length} subscriptions (total processed so far: ${totalProcessed})`
    )

    // Process each subscription in the batch
    for (const subscription of subscriptions.data) {
      await processSubscription(subscription, stripeClient, commit, verbose)

      totalProcessed++

      // Check if we've hit the limit
      if (limit && totalProcessed >= limit) {
        await trackProgress(`Reached limit of ${limit} subscriptions, stopping`)
        hasMore = false
        break
      }

      // Progress update every 50 subscriptions
      if (totalProcessed % 50 === 0) {
        await trackProgress(
          `Progress: ${totalProcessed} processed, ${updatedCount} subscriptions updated, ${errorCount} errors`
        )
      }
    }

    // Check if there are more subscriptions to process
    hasMore = hasMore && subscriptions.has_more
    if (hasMore && subscriptions.data.length > 0) {
      startingAfter = subscriptions.data[subscriptions.data.length - 1].id
    }

    // Rate limit between batch requests
    await rateLimitSleep()
  }

  // Final summary
  await trackProgress('FINAL SUMMARY:')
  await trackProgress(`   Total subscriptions processed: ${processedCount}`)
  await trackProgress(
    `   Subscriptions ${commit ? 'updated' : 'would be updated'}: ${updatedCount}`
  )
  await trackProgress(`   Errors encountered: ${errorCount}`)

  if (!commit && updatedCount > 0) {
    await trackProgress('')
    await trackProgress(
      'To actually perform the updates, run the script with --commit flag'
    )
  }

  if (errorCount > 0) {
    await trackProgress(
      'Some errors were encountered. Check the logs above for details.'
    )
  }

  await trackProgress(`Script completed successfully in ${mode}`)
}

// Execute the script using the runner
try {
  await scriptRunner(main)
  process.exit(0)
} catch (error) {
  console.error('Script failed:', error.message)
  process.exit(1)
}
