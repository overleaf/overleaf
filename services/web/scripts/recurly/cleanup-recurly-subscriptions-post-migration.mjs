#!/usr/bin/env node

/**
 * This script CLEANS UP Recurly subscriptions after migration to Stripe is finalized.
 *
 * IMPORTANT: Only run this AFTER the cutover is complete, verified, and
 * we've confirmed that Stripe is working correctly.
 *
 * WARNING: After running this script, rollback is NO LONGER POSSIBLE.
 *
 * NOTE: This script will trigger lifecycle emails to be sent. Please turn off:
 * - "Subscription Expired Template" (https://sharelatex.recurly.com/emails/subscription_expired/template/edit)
 *
 * Usage:
 *   node scripts/recurly/cleanup-recurly-subscriptions-post-migration.mjs [OPTS] [INPUT-FILE]
 *
 * Options:
 *   --output PATH                 Output file path (default: /tmp/cancel_output_<timestamp>.csv)
 *   --commit                      Apply changes (without this, runs in dry-run mode)
 *   --concurrency N               Number of customers to process concurrently (default: 10)
 *   --recurly-rate-limit N        Requests per second for Recurly (default: 10)
 *   --recurly-api-retries N       Number of retries on Recurly 429s (default: 5)
 *   --recurly-retry-delay-ms N    Delay between Recurly retries in ms (default: 1000)
 *   --help                        Show help message
 *
 * CSV Input Format:
 *   recurly_account_code,previous_recurly_subscription_id
 *   507f1f77bcf86cd799439011,abcd1234efgh5678
 *
 * CSV Output Format:
 *   recurly_account_code,previous_recurly_subscription_id,status,note
 *
 * Note: recurly_account_code is the Overleaf user ID (admin_id)
 */

import fs from 'node:fs'
import path from 'node:path'
import * as csv from 'csv'
import minimist from 'minimist'
import PQueue from 'p-queue'
import RecurlyClient from '../../app/src/Features/Subscription/RecurlyClient.mjs'
import { z } from '../../app/src/infrastructure/Validation.mjs'
import { scriptRunner } from '../lib/ScriptRunner.mjs'
import { Subscription } from '../../app/src/models/Subscription.mjs'
import { ReportError } from '../stripe/helpers.mjs'
import {
  createRateLimitedApiWrappers,
  DEFAULT_RECURLY_RATE_LIMIT,
  DEFAULT_RECURLY_API_RETRIES,
  DEFAULT_RECURLY_RETRY_DELAY_MS,
} from '../stripe/RateLimiter.mjs'

const DEFAULT_CONCURRENCY = 10

// rate limiters - initialized in main()
let rateLimiters

function usage() {
  console.error(`Usage: node scripts/recurly/cleanup-recurly-subscriptions-post-migration.mjs [OPTS] [INPUT-FILE]

Options:
    --output PATH                 Output file path (default: /tmp/terminate_output_<timestamp>.csv)
    --commit                      Apply changes (without this, runs in dry-run mode)
    --concurrency N               Number of customers to process concurrently (default: ${DEFAULT_CONCURRENCY})
    --recurly-rate-limit N        Requests per second for Recurly (default: ${DEFAULT_RECURLY_RATE_LIMIT})
    --recurly-api-retries N       Number of retries on Recurly 429s (default: ${DEFAULT_RECURLY_API_RETRIES})
    --recurly-retry-delay-ms N    Delay between Recurly retries in ms (default: ${DEFAULT_RECURLY_RETRY_DELAY_MS})
    --help                        Show this help message
`)
}

async function main(trackProgress) {
  const opts = parseArgs()
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const outputFile = opts.output ?? `/tmp/terminate_output_${timestamp}.csv`

  // initialize rate limiters
  rateLimiters = createRateLimitedApiWrappers({
    recurlyRateLimit: opts.recurlyRateLimit,
    recurlyApiRetries: opts.recurlyApiRetries,
    recurlyRetryDelayMs: opts.recurlyRetryDelayMs,
  })

  await trackProgress('Starting Recurly subscription termination')
  await trackProgress(`Run mode: ${opts.commit ? 'COMMIT' : 'DRY RUN'}`)
  await trackProgress(`Rate limit: Recurly ${opts.recurlyRateLimit}/s`)
  await trackProgress(`Concurrency: ${opts.concurrency}`)

  const inputStream = opts.inputFile
    ? fs.createReadStream(opts.inputFile)
    : process.stdin
  const csvReader = getCsvReader(inputStream)
  const csvWriter = getCsvWriter(outputFile)

  await trackProgress(`Output: ${outputFile}`)

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
        processedCount++

        try {
          const result = await processTermination(input, opts.commit)

          csvWriter.write({
            recurly_account_code: input.recurly_account_code,
            status: result.status,
            note: result.note,
            previous_recurly_subscription_id:
              input.previous_recurly_subscription_id,
          })

          if (result.status === 'terminated' || result.status === 'validated') {
            successCount++
          } else {
            errorCount++
          }

          if (processedCount % 25 === 0) {
            await trackProgress(
              `Progress: ${processedCount} processed, ${successCount} successful, ${errorCount} errors`
            )
          }
        } catch (err) {
          errorCount++
          if (err instanceof ReportError) {
            csvWriter.write({
              recurly_account_code: input.recurly_account_code,
              previous_recurly_subscription_id:
                input.previous_recurly_subscription_id,
              status: err.status,
              note: err.message,
            })
          } else {
            csvWriter.write({
              recurly_account_code: input.recurly_account_code,
              previous_recurly_subscription_id:
                input.previous_recurly_subscription_id,
              status: 'error',
              note: err.message,
            })
          }
        }
      })
    }
  } finally {
    await queue.onIdle()
  }

  await trackProgress(`✅ Total processed: ${processedCount}`)
  if (opts.commit) {
    await trackProgress(`✅ Successfully terminated: ${successCount}`)
  } else {
    await trackProgress(`✅ Successfully validated: ${successCount}`)
    await trackProgress('ℹ️  DRY RUN: No changes were applied')
  }
  await trackProgress(`❌ Errors: ${errorCount}`)
  await trackProgress('🎉 Script completed!')

  csvWriter.end()
}

function getCsvReader(inputStream) {
  const parser = csv.parse({ columns: true })
  inputStream.pipe(parser)
  return parser
}

function getCsvWriter(outputFile) {
  fs.mkdirSync(path.dirname(outputFile), { recursive: true })
  const outputStream = fs.createWriteStream(outputFile)

  const writer = csv.stringify({
    columns: [
      'recurly_account_code',
      'previous_recurly_subscription_id',
      'status',
      'note',
    ],
    header: true,
  })

  writer.on('error', err => {
    console.error(err)
    process.exit(1)
  })

  writer.pipe(outputStream)
  return writer
}

async function processTermination(input, commit) {
  const {
    recurly_account_code: adminUserId,
    previous_recurly_subscription_id: subscriptionUuid,
  } = input

  // 1. Fetch Mongo subscription
  const mongoSubscription = await Subscription.findOne({
    admin_id: adminUserId,
  }).exec()

  // 2. Verify subscription has been migrated to Stripe (skipping if the
  // Mongo subscription is missing, which would indicate that the Stripe
  // subscription has expired after the cutover)
  if (
    mongoSubscription &&
    !mongoSubscription.paymentProvider?.service?.includes('stripe')
  ) {
    throw new ReportError(
      'not-migrated',
      'Subscription has not been migrated to Stripe yet'
    )
  }

  // 3. Fetch Recurly subscription and verify it is in our expected state
  let recurlySubscription
  let isInExpectedEndState = true
  try {
    recurlySubscription = await rateLimiters.requestWithRetries(
      'recurly',
      () => RecurlyClient.promises.getSubscription(subscriptionUuid),
      { operation: 'getSubscription', subscriptionUuid }
    )
  } catch (err) {
    isInExpectedEndState = false
  }

  if (recurlySubscription) {
    const nineYearsFromNow = new Date()
    nineYearsFromNow.setFullYear(new Date().getFullYear() + 9)

    if (
      recurlySubscription.periodEnd > nineYearsFromNow &&
      recurlySubscription.state === 'canceled'
    ) {
      isInExpectedEndState = false
    }
  } else {
    throw new ReportError(
      'missing-subscription',
      'Recurly subscription not found'
    )
  }
  const warning = isInExpectedEndState
    ? ''
    : `(subscription was NOT in expected state: periodEnd=${recurlySubscription?.periodEnd?.toISOString()}, state=${recurlySubscription?.state})`

  // 4. If commit mode, terminate the subscription
  if (commit) {
    try {
      await rateLimiters.requestWithRetries(
        'recurly',
        () =>
          RecurlyClient.promises.terminateSubscriptionByUuid(subscriptionUuid),
        { operation: 'terminateSubscriptionByUuid', subscriptionUuid }
      )
      return {
        status: isInExpectedEndState
          ? 'terminated'
          : 'terminated-with-warnings',
        note: `Successfully terminated Recurly subscription ${warning}`,
      }
    } catch (err) {
      throw new ReportError(
        'terminate-failed',
        `Failed to terminate: ${err.message} ${warning}`
      )
    }
  } else {
    const note = isInExpectedEndState
      ? 'DRY RUN: Ready to terminate'
      : `DRY RUN: Ready to terminate ${warning}`

    return {
      status: 'validated',
      note,
    }
  }
}

function parseArgs() {
  const args = minimist(process.argv.slice(2), {
    string: [
      'output',
      'concurrency',
      'recurly-rate-limit',
      'recurly-api-retries',
      'recurly-retry-delay-ms',
    ],
    boolean: ['commit', 'help'],
    default: {
      commit: false,
      concurrency: DEFAULT_CONCURRENCY,
      'recurly-rate-limit': DEFAULT_RECURLY_RATE_LIMIT,
      'recurly-api-retries': DEFAULT_RECURLY_API_RETRIES,
      'recurly-retry-delay-ms': DEFAULT_RECURLY_RETRY_DELAY_MS,
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
    recurlyRateLimit: z.number().positive(),
    recurlyApiRetries: z.number().int().nonnegative(),
    recurlyRetryDelayMs: z.number().int().nonnegative(),
    inputFile: z.string().optional(),
  })

  try {
    return paramsSchema.parse({
      output: args.output,
      commit: args.commit,
      concurrency: Number(args.concurrency),
      recurlyRateLimit: Number(args['recurly-rate-limit']),
      recurlyApiRetries: Number(args['recurly-api-retries']),
      recurlyRetryDelayMs: Number(args['recurly-retry-delay-ms']),
      inputFile,
    })
  } catch (err) {
    console.error('Invalid arguments:', err.message)
    usage()
    process.exit(1)
  }
}

try {
  await scriptRunner(main)
  process.exit(0)
} catch (error) {
  console.error(error)
  process.exit(1)
}
