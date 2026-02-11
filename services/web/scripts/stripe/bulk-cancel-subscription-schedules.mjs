#!/usr/bin/env node

/**
 * This script bulk cancels pending Stripe subscription schedules (status: "not_started")
 * that are not attached to a subscription (this can be deleted once the migration is complete)
 *
 * For each customer in the input CSV, it:
 * 1. Lists all subscription schedules for the customer
 * 2. Finds the schedule with status "not_started"
 * 3. Cancels that schedule via the Stripe API
 *
 * NOTE: this will NOT email customers to inform them of the cancellation
 *
 * Usage:
 *   node scripts/stripe/bulk-cancel-subscription-schedules.mjs [OPTS] [INPUT-FILE]
 *
 * Options:
 *   --output PATH                 Output file path (default: /tmp/bulk_cancel_schedules_output_<timestamp>.csv)
 *   --commit                      Apply changes (without this, runs in dry-run mode)
 *   --concurrency N               Number of customers to process concurrently (default: 10)
 *   --stripe-rate-limit N         Requests per second for Stripe (default: 50)
 *   --stripe-api-retries N        Number of retries on Stripe 429s (default: 5)
 *   --stripe-retry-delay-ms N     Delay between Stripe retries in ms (default: 1000)
 *   --help                        Show help message
 *
 * CSV Input Format:
 *   The CSV must have the following columns:
 *   - stripe_customer_id: Stripe customer id
 *   - target_stripe_account: Either 'stripe-uk' or 'stripe-us'
 *
 * CSV Output Format:
 *   stripe_customer_id,target_stripe_account,schedule_id,status,note
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

// rate limiters - initialized in main()
let rateLimiters

function usage() {
  console.error(`Usage: node scripts/stripe/bulk-cancel-subscription-schedules.mjs [OPTS] [INPUT-FILE]

Options:
    --output PATH                 Output file path (default: /tmp/bulk_cancel_schedules_output_<timestamp>.csv)
    --commit                      Apply changes (without this, runs in dry-run mode)
    --concurrency N               Number of customers to process concurrently (default: 10)
    --stripe-rate-limit N         Requests per second for Stripe (default: ${DEFAULT_STRIPE_RATE_LIMIT})
    --stripe-api-retries N        Number of retries on Stripe 429s (default: ${DEFAULT_STRIPE_API_RETRIES})
    --stripe-retry-delay-ms N     Delay between Stripe retries in ms (default: ${DEFAULT_STRIPE_RETRY_DELAY_MS})
    --help                        Show this help message
`)
}

async function main(trackProgress) {
  const opts = parseArgs()
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const outputFile =
    opts.output ?? `/tmp/bulk_cancel_schedules_output_${timestamp}.csv`

  rateLimiters = createRateLimitedApiWrappers({
    stripeRateLimit: opts.stripeRateLimit,
    stripeApiRetries: opts.stripeApiRetries,
    stripeRetryDelayMs: opts.stripeRetryDelayMs,
  })

  await trackProgress(
    'Starting bulk subscription schedule cancellation for Stripe'
  )
  await trackProgress(`Run mode: ${opts.commit ? 'COMMIT' : 'DRY RUN'}`)
  await trackProgress(`Rate limit: Stripe ${opts.stripeRateLimit}/s`)
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
          const result = await processScheduleCancellation(input, opts.commit)

          csvWriter.write({
            stripe_customer_id: input.stripe_customer_id,
            target_stripe_account: input.target_stripe_account,
            schedule_id: result.scheduleId || '',
            status: result.status,
            note: result.note,
          })

          if (result.status === 'cancelled' || result.status === 'validated') {
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
          csvWriter.write({
            stripe_customer_id: input.stripe_customer_id,
            target_stripe_account: input.target_stripe_account,
            schedule_id: '',
            status: err instanceof ReportError ? err.status : 'error',
            note: err.message,
          })
        }
      })
    }
  } finally {
    await queue.onIdle()
  }

  await trackProgress(`✅ Total processed: ${processedCount}`)
  if (opts.commit) {
    await trackProgress(`✅ Successfully cancelled: ${successCount}`)
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
      concurrency: 10,
      'stripe-rate-limit': DEFAULT_STRIPE_RATE_LIMIT,
      'stripe-api-retries': DEFAULT_STRIPE_API_RETRIES,
      'stripe-retry-delay-ms': DEFAULT_STRIPE_RETRY_DELAY_MS,
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
  fs.mkdirSync(path.dirname(outputFile), { recursive: true })
  const outputStream = fs.createWriteStream(outputFile)

  const writer = csv.stringify({
    columns: [
      'stripe_customer_id',
      'target_stripe_account',
      'schedule_id',
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

async function processScheduleCancellation(input, commit) {
  const {
    stripe_customer_id: customerId,
    target_stripe_account: targetStripeAccount,
  } = input

  // get Stripe client for the target account
  const region = targetStripeAccount.replace(/^stripe-/, '')
  const stripeClient = getRegionClient(region)

  // list all subscription schedules for this customer
  let schedules
  try {
    schedules = await rateLimiters.requestWithRetries(
      stripeClient.serviceName,
      () =>
        stripeClient.stripe.subscriptionSchedules.list({
          customer: customerId,
          limit: 100, // max limit
        }),
      {
        operation: 'subscriptionSchedules.list',
        customerId,
        region: stripeClient.serviceName,
      }
    )
  } catch (err) {
    throw new ReportError(
      'list-schedules-failed',
      `Failed to list subscription schedules: ${err.message}`
    )
  }

  // find the schedule with status "not_started"
  const notStartedSchedules = schedules.data.filter(
    schedule =>
      schedule.status === 'not_started' &&
      schedule.subscription == null &&
      schedule.metadata?.billing_migration_id != null
  )

  if (notStartedSchedules.length === 0) {
    throw new ReportError(
      'no-not-started-schedule',
      `No subscription schedule with status "not_started" found for customer ${customerId}`
    )
  }

  if (notStartedSchedules.length > 1) {
    const scheduleIds = notStartedSchedules.map(s => s.id).join(', ')
    throw new ReportError(
      'multiple-not-started-schedules',
      `Found ${notStartedSchedules.length} schedules with status "not_started" (${scheduleIds}), expected exactly 1`
    )
  }

  const targetSchedule = notStartedSchedules[0]

  if (!commit) {
    return {
      status: 'validated',
      note: `Schedule ${targetSchedule.id} can be cancelled`,
      scheduleId: targetSchedule.id,
    }
  }

  // cancel the schedule
  try {
    await rateLimiters.requestWithRetries(
      stripeClient.serviceName,
      () => stripeClient.stripe.subscriptionSchedules.cancel(targetSchedule.id),
      {
        operation: 'subscriptionSchedules.cancel',
        scheduleId: targetSchedule.id,
        region: stripeClient.serviceName,
      }
    )

    return {
      status: 'cancelled',
      note: `Cancelled schedule ${targetSchedule.id}`,
      scheduleId: targetSchedule.id,
    }
  } catch (err) {
    throw new ReportError(
      'cancel-schedule-failed',
      `Failed to cancel schedule ${targetSchedule.id}: ${err.message}`
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
