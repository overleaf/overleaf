#!/usr/bin/env node

/**
 * This script handles the cutover for subscriptions migrating from Recurly to Stripe.
 *
 * IMPORTANT: Only run this after Stripe subscriptions have been created in Stripe and
 * are ready to take over billing from Recurly.
 *
 * NOTE: This script will trigger lifecycle emails to be sent. Please turn off:
 * - "Send emails about upcoming renewals" (https://dashboard.stripe.com/<account>/settings/billing/subscriptions)
 * - "Subscription Change Template" (https://sharelatex.recurly.com/emails/subscription_change/template/edit)
 *
 * Usage:
 *   node scripts/stripe/finalize-stripe-subscription-migration.mjs [OPTS] [INPUT-FILE]
 *
 * Options:
 *   --output PATH                 Output file path (default: /tmp/migrate_output_<timestamp>.csv)
 *   --commit                      Apply changes (without this, runs in dry-run mode)
 *   --concurrency, -c <n>         Number of customers to process concurrently (default: 10)
 *   --recurly-rate-limit N        Requests per second for Recurly (default: 10)
 *   --recurly-api-retries N       Number of retries on Recurly 429s (default: 5)
 *   --recurly-retry-delay-ms N    Delay between Recurly retries in ms (default: 1000)
 *   --stripe-rate-limit N         Requests per second for Stripe (default: 50)
 *   --stripe-api-retries N        Number of retries on Stripe 429s (default: 5)
 *   --stripe-retry-delay-ms N     Delay between Stripe retries in ms (default: 1000)
 *   --help                        Show help message
 *
 * CSV Input Format:
 *   recurly_account_code,target_stripe_account,stripe_customer_id
 *   507f1f77bcf86cd799439011,stripe-uk,cus_1234567890abcdef
 *
 * CSV Output Format:
 *   recurly_account_code,target_stripe_account,stripe_customer_id,previous_recurly_status,previous_recurly_subscription_id,email,analyticsId,status,note
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
import {
  getRegionClient,
  convertStripeStatusToSubscriptionState,
} from '../../modules/subscriptions/app/src/StripeClient.mjs'
import RecurlyWrapper from '../../app/src/Features/Subscription/RecurlyWrapper.mjs'
import { Subscription } from '../../app/src/models/Subscription.mjs'
import { User } from '../../app/src/models/User.mjs'
import AnalyticsManager from '../../app/src/Features/Analytics/AnalyticsManager.mjs'
import AccountMappingHelper from '../../app/src/Features/Analytics/AccountMappingHelper.mjs'
import PlansLocator from '../../app/src/Features/Subscription/PlansLocator.mjs'
import UserAnalyticsIdCache from '../../app/src/Features/Analytics/UserAnalyticsIdCache.mjs'
import CustomerIoHandler from '../../modules/customer-io/app/src/CustomerIoHandler.mjs'
import { ReportError } from './helpers.mjs'
import isEqual from 'lodash/isEqual.js'
import {
  createRateLimitedApiWrappers,
  DEFAULT_RECURLY_RATE_LIMIT,
  DEFAULT_STRIPE_RATE_LIMIT,
  DEFAULT_RECURLY_API_RETRIES,
  DEFAULT_RECURLY_RETRY_DELAY_MS,
  DEFAULT_STRIPE_API_RETRIES,
  DEFAULT_STRIPE_RETRY_DELAY_MS,
} from './RateLimiter.mjs'

const preloadedProductMetadata = new Map()

// rate limiters - initialized in main()
let rateLimiters

function usage() {
  console.error(`Usage: node scripts/stripe/finalize-stripe-subscription-migration.mjs [OPTS] [INPUT-FILE]

Options:
    --output PATH                 Output file path (default: /tmp/migrate_output_<timestamp>.csv)
    --commit                      Apply changes (without this, runs in dry-run mode)
    --concurrency N               Number of customers to process concurrently (default: 10)
    --recurly-rate-limit N        Requests per second for Recurly (default: ${DEFAULT_RECURLY_RATE_LIMIT})
    --recurly-api-retries N       Number of retries on Recurly 429s (default: ${DEFAULT_RECURLY_API_RETRIES})
    --recurly-retry-delay-ms N    Delay between Recurly retries in ms (default: ${DEFAULT_RECURLY_RETRY_DELAY_MS})
    --stripe-rate-limit N         Requests per second for Stripe (default: ${DEFAULT_STRIPE_RATE_LIMIT})
    --stripe-api-retries N        Number of retries on Stripe 429s (default: ${DEFAULT_STRIPE_API_RETRIES})
    --stripe-retry-delay-ms N     Delay between Stripe retries in ms (default: ${DEFAULT_STRIPE_RETRY_DELAY_MS})
    --help                        Show this help message
`)
}

async function main(trackProgress) {
  const opts = parseArgs()
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const outputFile = opts.output ?? `/tmp/migrate_output_${timestamp}.csv`

  // initialize rate limiters
  rateLimiters = createRateLimitedApiWrappers({
    recurlyRateLimit: opts.recurlyRateLimit,
    recurlyApiRetries: opts.recurlyApiRetries,
    recurlyRetryDelayMs: opts.recurlyRetryDelayMs,
    stripeRateLimit: opts.stripeRateLimit,
    stripeApiRetries: opts.stripeApiRetries,
    stripeRetryDelayMs: opts.stripeRetryDelayMs,
  })

  await trackProgress('Starting Recurly to Stripe migration cutover')
  await trackProgress(`Run mode: ${opts.commit ? 'COMMIT' : 'DRY RUN'}`)
  await trackProgress(
    `Rate limits: Recurly ${opts.recurlyRateLimit}/s, Stripe ${opts.stripeRateLimit}/s`
  )
  await trackProgress(`Concurrency: ${opts.concurrency}`)

  const inputStream = opts.inputFile
    ? fs.createReadStream(opts.inputFile)
    : process.stdin
  const csvReader = getCsvReader(inputStream)
  const csvWriter = getCsvWriter(outputFile)

  await trackProgress('Populating product metadata...')
  await preloadProductMetadata('uk')
  await preloadProductMetadata('us')
  await trackProgress('Product metadata populated')

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
          const result = await processMigration(input, opts.commit)

          csvWriter.write({
            recurly_account_code: input.recurly_account_code,
            target_stripe_account: input.target_stripe_account,
            stripe_customer_id: input.stripe_customer_id,
            previous_recurly_status: result.previousRecurlyStatus || '',
            previous_recurly_subscription_id:
              result.previousRecurlySubscriptionId || '',
            email: result.email || '',
            analyticsId: result.analyticsId || '',
            status: result.status,
            note: result.note,
          })

          if (
            result.status.startsWith('migrated') ||
            result.status === 'validated'
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
              previous_recurly_status: '',
              previous_recurly_subscription_id: '',
              email: '',
              analyticsId: '',
              status: err.status,
              note: err.message,
            })
          } else {
            csvWriter.write({
              recurly_account_code: input.recurly_account_code,
              target_stripe_account: input.target_stripe_account,
              stripe_customer_id: input.stripe_customer_id,
              previous_recurly_status: '',
              previous_recurly_subscription_id: '',
              email: '',
              analyticsId: '',
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
    await trackProgress(`✅ Successfully migrated: ${successCount}`)
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
      'previous_recurly_status',
      'previous_recurly_subscription_id',
      'email',
      'analyticsId',
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

async function preloadProductMetadata(region) {
  if (preloadedProductMetadata.has(region)) return

  const stripeClient = getRegionClient(region)
  const products = await rateLimiters.requestWithRetries(
    stripeClient.serviceName,
    () =>
      stripeClient.stripe.products.list({
        active: true,
        limit: 100,
      }),
    { operation: 'products.list', region: stripeClient.serviceName }
  )

  const results = new Map()
  for (const product of products.data) {
    results.set(product.id, product.metadata)
  }

  preloadedProductMetadata.set(region, results)
}

async function processMigration(input, commit) {
  const {
    recurly_account_code: overleafUserId,
    target_stripe_account: targetStripeAccount,
    stripe_customer_id: stripeCustomerId,
  } = input

  // Get Stripe client for the target account (strip 'stripe-' prefix if present)
  const region = targetStripeAccount.replace(/^stripe-/, '')
  const stripeClient = getRegionClient(region)

  // 1. Fetch Mongo subscription
  const mongoSubscription = await Subscription.findOne({
    admin_id: overleafUserId,
  }).exec()
  if (!mongoSubscription) {
    throw new ReportError(
      'no-mongo-subscription',
      'No subscription found in Mongo'
    )
  }

  // 2. Check if already migrated to Stripe
  if (mongoSubscription.paymentProvider?.service?.includes('stripe')) {
    throw new ReportError('already-stripe', 'Subscription already using Stripe')
  }

  // 3. Store previous state for output
  const previousRecurlyStatus = mongoSubscription.recurlyStatus
    ? JSON.stringify(mongoSubscription.recurlyStatus)
    : ''
  const previousRecurlySubscriptionId =
    mongoSubscription.recurlySubscription_id || ''

  // 4. Find Stripe subscription for this customer
  let stripeCustomer
  let stripeSubscription
  try {
    stripeCustomer = await rateLimiters.requestWithRetries(
      stripeClient.serviceName,
      () => stripeClient.getCustomerById(stripeCustomerId, ['subscriptions']),
      {
        operation: 'getCustomerById',
        stripeCustomerId,
        region: stripeClient.serviceName,
      }
    )

    // handle no subscriptions found
    if (
      !stripeCustomer.subscriptions ||
      stripeCustomer.subscriptions.data.length === 0
    ) {
      throw new ReportError(
        'no-stripe-subscription',
        'No Stripe subscriptions found for customer'
      )
    }

    // handle multiple active subscriptions found
    const activeSubscriptions = stripeCustomer.subscriptions.data.filter(sub =>
      ['active', 'past_due', 'incomplete'].includes(sub.status)
    )
    if (activeSubscriptions.length > 1) {
      throw new ReportError(
        'multiple-active-stripe-subscriptions',
        'Multiple active Stripe subscriptions found for customer'
      )
    }

    // find the target subscription with migration metadata
    stripeSubscription = stripeCustomer.subscriptions.data.find(
      sub => sub.metadata?.recurly_to_stripe_migration_status === 'in_progress'
    )
    if (!stripeSubscription) {
      throw new ReportError(
        'no-target-stripe-subscription',
        'No target Stripe subscription found for customer'
      )
    }
  } catch (err) {
    if (err instanceof ReportError) throw err
    throw new ReportError(
      'stripe-fetch-error',
      `Failed to fetch Stripe subscription: ${err.message}`
    )
  }

  // 5. Fetch Recurly subscription
  let recurlySubscription
  try {
    recurlySubscription = await rateLimiters.requestWithRetries(
      'recurly',
      () =>
        RecurlyWrapper.promises.getSubscription(
          previousRecurlySubscriptionId,
          {}
        ),
      {
        operation: 'getSubscription',
        recurlySubscriptionId: previousRecurlySubscriptionId,
      }
    )
  } catch (err) {
    throw new ReportError(
      'no-recurly-subscription',
      `Recurly subscription not found: ${err.message}`
    )
  }

  // 6. Detect changes between Recurly and Stripe
  const changes = detectChanges(recurlySubscription, stripeSubscription, region)
  if (changes.length > 0) {
    throw new ReportError(
      'changes-detected',
      `Changes detected between Recurly and Stripe: ${changes.join('; ')}`
    )
  }

  // 7. If commit mode, perform migration
  const analyticsId = await UserAnalyticsIdCache.get(overleafUserId)
  const mongoUser = await User.findOne({
    _id: overleafUserId,
  }).exec()
  const result = {
    status: 'not-migrated',
    note: 'Not yet migrated',
    previousRecurlyStatus,
    previousRecurlySubscriptionId,
    email: mongoUser?.email || stripeCustomer.email,
    analyticsId,
  }
  if (commit) {
    try {
      await performCutover(
        mongoSubscription,
        stripeSubscription,
        recurlySubscription,
        stripeClient,
        stripeCustomer,
        analyticsId,
        mongoUser?.email
      )
    } catch (err) {
      if (err instanceof ReportError && err.status?.startsWith('migrated-')) {
        result.status = err.status
        result.note = err.message
        return result
      }

      throw err
    }

    result.status = 'migrated'
    result.note = 'Successfully migrated to Stripe'
    return result
  } else {
    result.status = 'validated'
    result.note = 'DRY RUN: Ready to migrate'
    return result
  }
}

/**
 * Format subscription items for display in error messages
 */
function formatItems(items) {
  return items
    .map(item => `${item.code}(qty:${item.quantity},amt:${item.amount})`)
    .join(', ')
}

function detectChanges(recurlySubscription, stripeSubscription, region) {
  const changes = []

  // Extract item details from Recurly subscription
  const targetRecurlySubscription =
    recurlySubscription.pending_subscription || recurlySubscription
  const recurlyPlanItem =
    PlansLocator.convertLegacyGroupPlanCodeToConsolidatedGroupPlanCodeIfNeeded(
      targetRecurlySubscription.plan.plan_code
    )
  const simplifiedPlanCode = recurlyPlanItem.planCode.replace(
    /_free_trial.*$/,
    ''
  )
  const additionalLicenseQuantity =
    (targetRecurlySubscription.subscription_add_ons || []).find(
      addOn => addOn.add_on_code === 'additional-license'
    )?.quantity || 0
  const recurlyItems = [
    {
      code: simplifiedPlanCode,
      quantity: recurlyPlanItem.quantity + additionalLicenseQuantity,
      amount:
        targetRecurlySubscription.unit_amount_in_cents /
        recurlyPlanItem.quantity,
    },
    ...(targetRecurlySubscription.subscription_add_ons || [])
      .filter(addOn => addOn.add_on_code !== 'additional-license')
      .map(addOn => ({
        code: addOn.add_on_code,
        quantity: addOn.quantity,
        amount: addOn.unit_amount_in_cents,
      })),
  ].sort((a, b) => a.code.localeCompare(b.code))

  // Extract item details from Stripe subscription
  const products = preloadedProductMetadata.get(region)
  const hasAddOns = stripeSubscription.items.data.length > 1
  const stripeItems = stripeSubscription.items.data
    .map(item => {
      const productMetadata = products.get(item.price.product)
      if (!productMetadata) {
        throw new ReportError(
          'unknown-stripe-product',
          `Unknown Stripe product: ${item.price.product}`
        )
      }

      return {
        code:
          productMetadata?.planCode?.includes('assistant') && hasAddOns
            ? productMetadata?.addOnCode
            : productMetadata?.planCode,
        quantity: item.quantity,
        amount: item.price.unit_amount,
      }
    })
    .sort((a, b) => a.code.localeCompare(b.code))

  // Compare items
  if (!isEqual(recurlyItems, stripeItems)) {
    changes.push(
      `Items: Recurly=[${formatItems(recurlyItems)}], Stripe=[${formatItems(stripeItems)}]`
    )
  }

  // Compare states
  const recurlyState = recurlySubscription.state
  const stripeState = convertStripeStatusToSubscriptionState(stripeSubscription)
  if (recurlyState !== stripeState) {
    changes.push(`State: Recurly=${recurlyState}, Stripe=${stripeState}`)
  }

  return changes
}

async function performCutover(
  mongoSubscription,
  stripeSubscription,
  recurlySubscription,
  stripeClient,
  stripeCustomer,
  analyticsId,
  mongoUserEmail
) {
  const adminUserId = mongoSubscription.admin_id.toString()

  // Step 1: Update Mongo subscription to point to Stripe
  mongoSubscription.paymentProvider = {
    service: stripeClient.serviceName,
    subscriptionId: stripeSubscription.id,
    state: convertStripeStatusToSubscriptionState(stripeSubscription),
  }

  mongoSubscription.recurlySubscription_id = undefined
  mongoSubscription.recurlyStatus = undefined

  try {
    await mongoSubscription.save()
  } catch (err) {
    throw new ReportError(
      'not-migrated-mongo-update-failed',
      `Failed to update Mongo subscription: ${err.message}`
    )
  }

  // Step 2: Emit migration analytics event
  AnalyticsManager.recordEventForUserInBackground(
    adminUserId,
    'subscription-migrated-to-stripe',
    {
      subscriptionId: mongoSubscription._id.toString(),
      migrationDirection: 'recurly-to-stripe',
    }
  )

  // Step 3: Postpone Recurly billing by +10 years if Recurly subscription is active
  if (recurlySubscription.state !== 'canceled') {
    const currentBillingDate = new Date(
      recurlySubscription.current_period_ends_at
    )
    const postponedDate = new Date(currentBillingDate)
    postponedDate.setFullYear(currentBillingDate.getFullYear() + 10)

    try {
      await rateLimiters.requestWithRetries(
        'recurly',
        () =>
          RecurlyWrapper.promises.apiRequest({
            url: `subscriptions/${recurlySubscription.uuid}/postpone`,
            qs: { bulk: true, next_bill_date: postponedDate },
            method: 'PUT',
          }),
        {
          operation: 'postpone',
          recurlySubscriptionId: recurlySubscription.uuid,
        }
      )
    } catch (err) {
      throw new ReportError(
        'migrated-recurly-postpone-failed',
        `Failed to postpone Recurly billing: ${err.message}`
      )
    }
  }

  // Step 4: Remove migration metadata from Stripe
  try {
    await rateLimiters.requestWithRetries(
      stripeClient.serviceName,
      () =>
        stripeClient.updateSubscriptionMetadata(stripeSubscription.id, {
          recurly_to_stripe_migration_status: '',
        }),
      {
        operation: 'updateSubscriptionMetadata',
        stripeSubscriptionId: stripeSubscription.id,
        region: stripeClient.serviceName,
      }
    )
  } catch (err) {
    throw new ReportError(
      'migrated-metadata-removal-failed',
      `Successfully migrated to Stripe but failed to remove metadata: ${err.message}`
    )
  }

  // Step 5: Register analytics mapping
  try {
    AnalyticsManager.registerAccountMapping(
      AccountMappingHelper.generateSubscriptionToStripeMapping(
        mongoSubscription._id,
        stripeSubscription.id,
        stripeClient.serviceName
      )
    )
  } catch (err) {
    throw new ReportError(
      'migrated-analytics-mapping-failed',
      `Successfully migrated to Stripe but failed to register analytics mapping: ${err.message}`
    )
  }

  // Step 6. Send data to customer.io
  if (analyticsId) {
    try {
      const migrationDate = new Date().toISOString().slice(0, 10)
      const needsToUpdateTaxInfo =
        (stripeCustomer.metadata?.taxInfoPending || '').length > 0

      // TODO: request Recurly account and billingInfo to verify if tax info in Stripe is up to date

      CustomerIoHandler.updateUserAttributes(analyticsId, {
        email: mongoUserEmail || stripeCustomer.email,
        stripe_migration: {
          migration_date: migrationDate,
          needs_to_update_tax_id: needsToUpdateTaxInfo,
        },
      })
    } catch (err) {
      throw new ReportError(
        'migrated-customerio-upload-failed',
        `Successfully migrated to Stripe but failed to upload user to customer.io: ${err.message}`
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
