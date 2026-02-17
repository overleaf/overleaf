#!/usr/bin/env node

/**
 * This script validates subscriptions that are canceled or expired and have migration metadata set to "in_progress",
 * then updates the metadata to "cancelled" if validation passes.
 *
 * TODO: This script can be deleted after being run in production.
 *
 * Usage:
 *   node scripts/stripe/bulk-update-migration-status.mjs [OPTS] [INPUT-FILE]
 *
 * Options:
 *   --output PATH                 Output file path (default: /tmp/bulk_update_output_<timestamp>.csv)
 *                                 Use '-' to write to stdout
 *   --commit                      Apply changes (without this flag, runs in dry-run mode)
 *   --concurrency N               Number of subscriptions to process concurrently (default: 10)
 *   --stripe-rate-limit N         Requests per second for Stripe (default: 50)
 *   --stripe-api-retries N        Number of retries on Stripe 429s (default: 5)
 *   --stripe-retry-delay-ms N     Delay between Stripe retries in ms (default: 1000)
 *   --help                        Show a help message
 *
 * CSV Input Format:
 *   The CSV must have the following columns:
 *   - subscription_id: Stripe subscription id
 *   - target_stripe_account: Either 'stripe-uk' or 'stripe-us'
 *
 * Output:
 *   Writes a CSV with columns:
 *   - subscription_id: The subscription id processed
 *   - target_stripe_account: The Stripe account
 *   - status: Result status (validated, updated, invalid-status, invalid-metadata, or error)
 *   - note: Additional information about the status
 */

import fs from 'node:fs'
import path from 'node:path'
import * as csv from 'csv'
import minimist from 'minimist'
import PQueue from 'p-queue'
import { z } from '../../app/src/infrastructure/Validation.mjs'
import { scriptRunner } from '../lib/ScriptRunner.mjs'
import { getRegionClient } from '../../modules/subscriptions/app/src/StripeClient.mjs'
import { ReportError } from './helpers.mjs'
import {
  createRateLimitedApiWrappers,
  DEFAULT_STRIPE_RATE_LIMIT,
  DEFAULT_STRIPE_API_RETRIES,
  DEFAULT_STRIPE_RETRY_DELAY_MS,
} from './RateLimiter.mjs'

const DEFAULT_CONCURRENCY = 10

// rate limiters - initialized in main()
let rateLimiters

function usage() {
  console.error(`Usage: node scripts/stripe/bulk-update-migration-status.mjs [OPTS] [INPUT-FILE]

Options:
    --output PATH                 Output file path (default: /tmp/bulk_update_output_<timestamp>.csv)
                                  Use '-' to write to stdout
    --commit                      Apply changes (without this, runs in dry-run mode)
    --concurrency N               Number of subscriptions to process concurrently (default: ${DEFAULT_CONCURRENCY})
    --stripe-rate-limit N         Requests per second for Stripe (default: ${DEFAULT_STRIPE_RATE_LIMIT})
    --stripe-api-retries N        Number of retries on Stripe 429s (default: ${DEFAULT_STRIPE_API_RETRIES})
    --stripe-retry-delay-ms N     Delay between Stripe retries in ms (default: ${DEFAULT_STRIPE_RETRY_DELAY_MS})
    --help                        Show this help message
`)
}

async function main(trackProgress) {
  const opts = parseArgs()
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const outputFile = opts.output ?? `/tmp/bulk_update_output_${timestamp}.csv`

  // initialize rate limiters
  rateLimiters = createRateLimitedApiWrappers({
    stripeRateLimit: opts.stripeRateLimit,
    stripeApiRetries: opts.stripeApiRetries,
    stripeRetryDelayMs: opts.stripeRetryDelayMs,
  })

  await trackProgress(
    'Starting bulk validation and update of subscription metadata'
  )
  await trackProgress(`Run mode: ${opts.commit ? 'COMMIT' : 'DRY RUN'}`)
  await trackProgress(`Rate limit: Stripe ${opts.stripeRateLimit}/s`)
  await trackProgress(`Concurrency: ${opts.concurrency}`)

  const inputStream = opts.inputFile
    ? fs.createReadStream(opts.inputFile)
    : process.stdin
  const csvReader = getCsvReader(inputStream)
  const csvWriter = getCsvWriter(outputFile)

  await trackProgress(`Output: ${outputFile === '-' ? 'stdout' : outputFile}`)

  let processedCount = 0
  let successCount = 0
  let errorCount = 0

  const queue = new PQueue({ concurrency: opts.concurrency })
  const maxQueueSize = opts.concurrency

  try {
    for await (const input of csvReader) {
      if (queue.size >= maxQueueSize) {
        await queue.onSizeLessThan(maxQueueSize)
      }

      queue.add(async () => {
        try {
          const result = await processValidation(input, opts.commit)

          csvWriter.write({
            subscription_id: input.subscription_id,
            target_stripe_account: input.target_stripe_account,
            status: result.status,
            note:
              result.note ||
              (opts.commit ? '' : 'dry run - no changes applied'),
          })

          if (result.status === 'updated' || result.status === 'validated') {
            successCount++
          } else {
            errorCount++
          }
        } catch (err) {
          errorCount++
          if (err instanceof ReportError) {
            csvWriter.write({
              subscription_id: input.subscription_id,
              target_stripe_account: input.target_stripe_account,
              status: err.status,
              note: err.message,
            })
          } else {
            csvWriter.write({
              subscription_id: input.subscription_id,
              target_stripe_account: input.target_stripe_account,
              status: 'error',
              note: err.message,
            })
            await trackProgress(
              `Error processing ${input.subscription_id}: ${err.message}`
            )
          }
        }

        processedCount++
        if (processedCount % 10 === 0) {
          await trackProgress(
            `Processed ${processedCount} subscriptions (${successCount} ${opts.commit ? 'updated' : 'validated'}, ${errorCount} errors)`
          )
        }
      })
    }
  } finally {
    await queue.onIdle()
  }

  await trackProgress(`✅ Total processed: ${processedCount}`)
  if (opts.commit) {
    await trackProgress(`✅ Successfully updated: ${successCount}`)
  } else {
    await trackProgress(`✅ Successfully validated: ${successCount}`)
    await trackProgress('ℹ️  DRY RUN: No changes were applied')
  }
  await trackProgress(`❌ Errors: ${errorCount}`)
  await trackProgress('🎉 Script completed!')

  csvWriter.end()
}

function parseArgs() {
  const args = minimist(process.argv.slice(2), {
    string: [
      'output',
      'concurrency',
      'stripe-rate-limit',
      'stripe-api-retries',
      'stripe-retry-delay-ms',
    ],
    boolean: ['commit', 'help'],
    default: {
      commit: false,
      concurrency: DEFAULT_CONCURRENCY,
      'stripe-rate-limit': DEFAULT_STRIPE_RATE_LIMIT,
      'stripe-api-retries': DEFAULT_STRIPE_API_RETRIES,
      'stripe-retry-delay-ms': DEFAULT_STRIPE_RETRY_DELAY_MS,
    },
    unknown: arg => {
      if (arg.startsWith('-')) {
        console.error(`Unknown option: ${arg}`)
        usage()
        process.exit(1)
      }
      return true
    },
  })

  if (args.help) {
    usage()
    process.exit(0)
  }

  const inputFile = args._[0]
  const paramsSchema = z.object({
    output: z.string().optional(),
    commit: z.boolean(),
    concurrency: z.number().int().positive(),
    stripeRateLimit: z.number().positive(),
    stripeApiRetries: z.number().int().nonnegative(),
    stripeRetryDelayMs: z.number().int().nonnegative(),
    inputFile: z.string().optional(),
  })

  try {
    return paramsSchema.parse({
      output: args.output,
      commit: args.commit,
      concurrency: Number(args.concurrency),
      stripeRateLimit: Number(args['stripe-rate-limit']),
      stripeApiRetries: Number(args['stripe-api-retries']),
      stripeRetryDelayMs: Number(args['stripe-retry-delay-ms']),
      inputFile,
    })
  } catch (err) {
    console.error('Invalid arguments:', err.message)
    usage()
    process.exit(1)
  }
}

function getCsvReader(inputStream) {
  const parser = csv.parse({ columns: true })
  inputStream.pipe(parser)
  return parser
}

function getCsvWriter(outputFile) {
  if (outputFile === '-') {
    const writer = csv.stringify({
      columns: ['subscription_id', 'target_stripe_account', 'status', 'note'],
      header: true,
    })
    writer.on('error', err => {
      console.error(err)
      process.exit(1)
    })
    writer.pipe(process.stdout)
    return writer
  }

  fs.mkdirSync(path.dirname(outputFile), { recursive: true })
  const outputStream = fs.createWriteStream(outputFile)

  const writer = csv.stringify({
    columns: ['subscription_id', 'target_stripe_account', 'status', 'note'],
    header: true,
  })

  writer.on('error', err => {
    console.error(err)
    process.exit(1)
  })

  writer.pipe(outputStream)
  return writer
}

async function processValidation(input, commit) {
  const {
    subscription_id: subscriptionId,
    target_stripe_account: targetStripeAccount,
  } = input

  // get Stripe client for the target account (strip 'stripe-' prefix if present)
  const region = targetStripeAccount.replace(/^stripe-/, '')
  const stripeClient = getRegionClient(region)

  // fetch subscription
  let subscription
  try {
    subscription = await rateLimiters.requestWithRetries(
      stripeClient.serviceName,
      () => stripeClient.stripe.subscriptions.retrieve(subscriptionId),
      {
        operation: 'subscriptions.retrieve',
        subscriptionId,
        region: stripeClient.serviceName,
      }
    )
  } catch (err) {
    throw new ReportError(
      'subscription-not-found',
      `Subscription not found: ${err.message}`
    )
  }

  const validStatuses = ['canceled']
  if (!validStatuses.includes(subscription.status)) {
    throw new ReportError(
      'invalid-status',
      `Subscription status is ${subscription.status}, expected canceled`
    )
  }

  if (
    subscription.metadata?.recurly_to_stripe_migration_status !== 'in_progress'
  ) {
    throw new ReportError(
      'invalid-metadata',
      `Migration status is ${subscription.metadata?.recurly_to_stripe_migration_status}, expected in_progress`
    )
  }

  if (!commit) {
    return {
      status: 'validated',
      note: 'Subscription is valid for update',
    }
  }

  try {
    await rateLimiters.requestWithRetries(
      stripeClient.serviceName,
      () =>
        stripeClient.updateSubscriptionMetadata(subscriptionId, {
          recurly_to_stripe_migration_status: 'cancelled',
        }),
      {
        operation: 'updateSubscriptionMetadata',
        subscriptionId,
        region: stripeClient.serviceName,
      }
    )

    return {
      status: 'updated',
      note: `Updated metadata for subscription ${subscriptionId}`,
    }
  } catch (err) {
    throw new ReportError(
      'update-failed',
      `Failed to update metadata: ${err.message}`
    )
  }
}

try {
  await scriptRunner(main)
  process.exit(0)
} catch (error) {
  console.error(error)
  process.exit(1)
}
