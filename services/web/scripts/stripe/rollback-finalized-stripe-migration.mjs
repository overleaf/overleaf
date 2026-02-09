#!/usr/bin/env node

/**
 * This script rolls back the cutover of a subscription from Recurly to Stripe.
 *
 * IMPORTANT: This script does NOT cancel the Stripe subscription.
 * Use scripts/stripe/bulk-cancel-subscriptions.mjs to cancel them separately.
 *
 * It undoes everything done by finalize-stripe-subscription-migration.mjs
 *
 * Usage:
 *   node scripts/stripe/rollback-finalized-stripe-migration.mjs [OPTS] [INPUT-FILE]
 *
 * Options:
 *   --output PATH          Output file path (default: /tmp/rollback_output_<timestamp>.csv)
 *   --commit               Apply changes (without this, runs in dry-run mode)
 *   --throttle DURATION    Minimum time between requests in ms (default: 40)
 *   --help                 Show help message
 *
 * CSV Input Format:
 *   recurly_account_code,target_stripe_account,stripe_customer_id
 *   507f1f77bcf86cd799439011,stripe-uk,cus_1234567890abcdef
 *
 * CSV Output Format:
 *   recurly_account_code,target_stripe_account,stripe_customer_id,status,note
 *
 * Note: recurly_account_code is the Overleaf user ID (admin_id)
 */

import fs from 'node:fs'
import path from 'node:path'
import * as csv from 'csv'
import minimist from 'minimist'
import PQueue from 'p-queue'
import { z } from '../../app/src/infrastructure/Validation.mjs'
import { scriptRunner } from '../lib/ScriptRunner.mjs'
import { getRegionClient } from '../../modules/subscriptions/app/src/StripeClient.mjs'
import RecurlyWrapper from '../../app/src/Features/Subscription/RecurlyWrapper.mjs'
import { Subscription } from '../../app/src/models/Subscription.mjs'
import AnalyticsManager from '../../app/src/Features/Analytics/AnalyticsManager.mjs'
import UserAnalyticsIdCache from '../../app/src/Features/Analytics/UserAnalyticsIdCache.mjs'
import CustomerIoHandler from '../../modules/customer-io/app/src/CustomerIoHandler.mjs'
import { ReportError } from './helpers.mjs'
import AccountMappingHelper from '../../app/src/Features/Analytics/AccountMappingHelper.mjs'
import {
  createRateLimitedApiWrappers,
  DEFAULT_RECURLY_RATE_LIMIT,
  DEFAULT_STRIPE_RATE_LIMIT,
  DEFAULT_RECURLY_API_RETRIES,
  DEFAULT_RECURLY_RETRY_DELAY_MS,
  DEFAULT_STRIPE_API_RETRIES,
  DEFAULT_STRIPE_RETRY_DELAY_MS,
} from './RateLimiter.mjs'

// rate limiters - initialized in main()
let rateLimiters

function usage() {
  console.error(`Usage: node scripts/stripe/rollback-finalized-stripe-migration.mjs [OPTS] [INPUT-FILE]

Options:
    --output PATH                 Output file path (default: /tmp/rollback_output_<timestamp>.csv)
    --commit                      Apply changes (without this, runs in dry-run mode)
    --concurrency N               Number of rollbacks to process concurrently (default: 10)
    --recurly-rate-limit N        Requests per second for Recurly (default: ${DEFAULT_RECURLY_RATE_LIMIT})
    --recurly-api-retries N       Number of retries on Recurly 429s (default: ${DEFAULT_RECURLY_API_RETRIES})
    --recurly-retry-delay-ms N    Delay between Recurly retries in ms (default: ${DEFAULT_RECURLY_RETRY_DELAY_MS})
    --stripe-rate-limit N         Requests per second for Stripe (default: ${DEFAULT_STRIPE_RATE_LIMIT})
    --stripe-api-retries N        Number of retries on Stripe 429s (default: ${DEFAULT_STRIPE_API_RETRIES})
    --stripe-retry-delay-ms N     Delay between Stripe retries in ms (default: ${DEFAULT_STRIPE_RETRY_DELAY_MS})
    --help                        Show this help message

Note: This script does NOT cancel Stripe subscriptions. Use scripts/stripe/bulk-cancel-subscriptions.mjs separately.
`)
}

async function main(trackProgress) {
  const opts = parseArgs()
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const outputFile = opts.output ?? `/tmp/rollback_output_${timestamp}.csv`

  // initialize rate limiters
  rateLimiters = createRateLimitedApiWrappers({
    recurlyRateLimit: opts.recurlyRateLimit,
    recurlyApiRetries: opts.recurlyApiRetries,
    recurlyRetryDelayMs: opts.recurlyRetryDelayMs,
    stripeRateLimit: opts.stripeRateLimit,
    stripeApiRetries: opts.stripeApiRetries,
    stripeRetryDelayMs: opts.stripeRetryDelayMs,
  })

  await trackProgress('Starting Stripe to Recurly rollback')
  await trackProgress(`Run mode: ${opts.commit ? 'COMMIT' : 'DRY RUN'}`)
  await trackProgress(
    'Note: Stripe subscriptions are NOT cancelled by this script'
  )
  await trackProgress(
    `Rate limits: Recurly ${opts.recurlyRateLimit}/s, Stripe ${opts.stripeRateLimit}/s`
  )
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
      // throttle input if queue is full
      if (queue.size >= maxQueueSize) {
        await queue.onSizeLessThan(maxQueueSize)
      }

      queue.add(async () => {
        processedCount++

        try {
          const result = await processRollback(input, opts.commit)

          csvWriter.write({
            recurly_account_code: input.recurly_account_code,
            target_stripe_account: input.target_stripe_account,
            stripe_customer_id: input.stripe_customer_id,
            status: result.status,
            note: result.note,
          })

          if (
            result.status === 'rolled-back' ||
            result.status === 'validated' ||
            result.status === 'already-recurly'
          ) {
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
              target_stripe_account: input.target_stripe_account,
              stripe_customer_id: input.stripe_customer_id,
              status: err.status,
              note: err.message,
            })
          } else {
            csvWriter.write({
              recurly_account_code: input.recurly_account_code,
              target_stripe_account: input.target_stripe_account,
              stripe_customer_id: input.stripe_customer_id,
              status: 'error',
              note: err.message,
            })
          }
        }
      })
    }
  } finally {
    // wait for all queued tasks to complete
    await queue.onIdle()
  }

  await trackProgress(`✅ Total processed: ${processedCount}`)
  if (opts.commit) {
    await trackProgress(`✅ Successfully rolled back: ${successCount}`)
  } else {
    await trackProgress(`✅ Successfully validated: ${successCount}`)
    await trackProgress('ℹ️  DRY RUN: No changes were applied')
  }
  await trackProgress(`❌ Errors: ${errorCount}`)
  await trackProgress('🎉 Script completed!')

  csvWriter.end()
  await CustomerIoHandler.closeCustomerIo()
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
      'target_stripe_account',
      'stripe_customer_id',
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

async function processRollback(input, commit) {
  const {
    recurly_account_code: accountCode,
    target_stripe_account: targetStripeAccount,
  } = input

  // Get Stripe client for the target account (strip 'stripe-' prefix if present)
  const region = targetStripeAccount.replace(/^stripe-/, '')
  const stripeClient = getRegionClient(region)

  // 1. Fetch Mongo subscription
  const mongoSubscription = await Subscription.findOne({
    admin_id: accountCode,
  }).exec()
  if (!mongoSubscription) {
    throw new ReportError(
      'no-mongo-subscription',
      'No subscription found in Mongo'
    )
  }

  // 2. Check if already using Recurly
  if (
    mongoSubscription.recurlySubscription_id &&
    !mongoSubscription.paymentProvider?.service?.includes('stripe')
  ) {
    throw new ReportError(
      'already-recurly',
      'Subscription already using Recurly'
    )
  }

  // 3. Verify subscription is using Stripe
  if (!mongoSubscription.paymentProvider?.service?.includes('stripe')) {
    throw new ReportError(
      'not-using-stripe',
      'Subscription is not using Stripe'
    )
  }

  const stripeSubscriptionId = mongoSubscription.paymentProvider.subscriptionId

  // 4. Find Recurly subscription ID from Stripe metadata
  let recurlySubscriptionId
  try {
    const stripeSubData = await rateLimiters.requestWithRetries(
      stripeClient.serviceName,
      () => stripeClient.stripe.subscriptions.retrieve(stripeSubscriptionId),
      {
        operation: 'subscriptions.retrieve',
        stripeSubscriptionId,
        region: stripeClient.serviceName,
      }
    )
    recurlySubscriptionId = stripeSubData.metadata?.recurly_subscription_id
    if (!recurlySubscriptionId) {
      throw new ReportError(
        'no-recurly-id-in-metadata',
        'No recurly_subscription_id found in Stripe metadata'
      )
    }
  } catch (err) {
    if (err instanceof ReportError) throw err
    throw new ReportError(
      'stripe-fetch-error',
      `Failed to fetch Stripe subscription: ${err.message}`
    )
  }

  // 5. Fetch Recurly subscription to get original billing date
  let recurlySubscription
  try {
    recurlySubscription = await rateLimiters.requestWithRetries(
      'recurly',
      () => RecurlyWrapper.promises.getSubscription(recurlySubscriptionId, {}),
      {
        operation: 'getSubscription',
        recurlySubscriptionId,
      }
    )
  } catch (err) {
    throw new ReportError(
      'no-recurly-subscription',
      `Recurly subscription not found: ${err.message}`
    )
  }

  // 6. If commit mode, perform rollback
  if (commit) {
    await performRollback(mongoSubscription, recurlySubscription, stripeClient)
    return {
      status: 'rolled-back',
      note: 'Successfully rolled back to Recurly',
    }
  } else {
    return {
      status: 'validated',
      note: 'DRY RUN: Ready to rollback to Recurly',
    }
  }
}

async function performRollback(
  mongoSubscription,
  recurlySubscription,
  stripeClient
) {
  const adminUserId = mongoSubscription.admin_id.toString()
  const recurlySubscriptionId = recurlySubscription.uuid
  const stripeSubscriptionId = mongoSubscription.paymentProvider.subscriptionId

  // Step 1: Restore Recurly fields in Mongo
  mongoSubscription.recurlySubscription_id = recurlySubscriptionId
  mongoSubscription.recurlyStatus = {
    state: recurlySubscription.state,
    trialStartedAt: recurlySubscription.trial_started_at,
    trialEndsAt: recurlySubscription.trial_ends_at,
  }
  mongoSubscription.paymentProvider = undefined
  await mongoSubscription.save()

  // Step 2: Emit rollback analytics event
  AnalyticsManager.recordEventForUserInBackground(
    adminUserId,
    'subscription-rolled-back-from-stripe',
    {
      subscriptionId: mongoSubscription._id.toString(),
      migrationDirection: 'stripe-to-recurly',
    }
  )

  // Step 3: Un-postpone Recurly billing by 10 years if next billing period was postponed
  const currentPeriodEnd = new Date(recurlySubscription.current_period_ends_at)
  const nineYearsFromNow = new Date()
  nineYearsFromNow.setFullYear(new Date().getFullYear() + 9)

  if (currentPeriodEnd > nineYearsFromNow) {
    const nextBillingDate = new Date(currentPeriodEnd)
    nextBillingDate.setFullYear(currentPeriodEnd.getFullYear() - 10)
    const targetBillingDateIsInFuture = nextBillingDate.getTime() > Date.now()

    if (targetBillingDateIsInFuture) {
      try {
        await rateLimiters.requestWithRetries(
          'recurly',
          () =>
            RecurlyWrapper.promises.apiRequest({
              url: `subscriptions/${recurlySubscriptionId}/postpone`,
              qs: { bulk: true, next_bill_date: nextBillingDate },
              method: 'PUT',
            }),
          {
            operation: 'postpone',
            recurlySubscriptionId,
          }
        )
      } catch (err) {
        throw new ReportError(
          'rolled-back-recurly-restore-failed',
          `Restored Mongo but failed to restore Recurly billing: ${err.message}`
        )
      }
    } else {
      throw new ReportError(
        'rolled-back-recurly-restore-failed',
        `Restored Mongo and Recurly but failed to restore Recurly billing: target next billing date is in the past (${nextBillingDate.toISOString()})`
      )
    }
  }

  // Step 4: Restore migration metadata to Stripe
  try {
    await rateLimiters.requestWithRetries(
      stripeClient.serviceName,
      () =>
        stripeClient.updateSubscriptionMetadata(stripeSubscriptionId, {
          recurly_to_stripe_migration_status: 'in_progress',
        }),
      {
        operation: 'updateSubscriptionMetadata',
        stripeSubscriptionId,
        region: stripeClient.serviceName,
      }
    )
  } catch (err) {
    throw new ReportError(
      'rolled-back-metadata-restore-failed',
      `Restored Mongo and Recurly but failed to restore Stripe metadata: ${err.message}`
    )
  }

  // Step 5: Register analytics mapping for the Recurly subscription
  try {
    AnalyticsManager.registerAccountMapping(
      AccountMappingHelper.generateSubscriptionToRecurlyMapping(
        mongoSubscription._id,
        recurlySubscriptionId,
        'recurly'
      )
    )
  } catch (err) {
    throw new ReportError(
      'rolled-back-analytics-mapping-failed',
      `Restored Mongo, Recurly, Stripe but failed to register analytics mapping: ${err.message}`
    )
  }

  // Step 5: Remove migration date from customer.io
  const analyticsId = await UserAnalyticsIdCache.get(adminUserId)
  if (analyticsId) {
    try {
      CustomerIoHandler.updateUserAttributes(analyticsId, {
        stripe_migration: {},
      })
    } catch (err) {
      throw new ReportError(
        'rolled-back-customerio-update-failed',
        `Restored Mongo, Recurly, Stripe but failed to update user in customer.io: ${err.message}`
      )
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
      'stripe-rate-limit',
      'stripe-api-retries',
      'stripe-retry-delay-ms',
    ],
    boolean: ['commit', 'help'],
    default: {
      commit: false,
      concurrency: 10,
      'recurly-rate-limit': DEFAULT_RECURLY_RATE_LIMIT,
      'recurly-api-retries': DEFAULT_RECURLY_API_RETRIES,
      'recurly-retry-delay-ms': DEFAULT_RECURLY_RETRY_DELAY_MS,
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
    recurlyRateLimit: z.number().positive(),
    recurlyApiRetries: z.number().int().nonnegative(),
    recurlyRetryDelayMs: z.number().int().nonnegative(),
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
      recurlyRateLimit: Number(args['recurly-rate-limit']),
      recurlyApiRetries: Number(args['recurly-api-retries']),
      recurlyRetryDelayMs: Number(args['recurly-retry-delay-ms']),
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

try {
  await scriptRunner(main)
  process.exit(0)
} catch (error) {
  console.error(error)
  process.exit(1)
}
