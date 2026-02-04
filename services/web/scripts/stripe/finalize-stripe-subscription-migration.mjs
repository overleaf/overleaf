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
 *   --output PATH          Output file path (default: /tmp/migrate_output_<timestamp>.csv)
 *   --commit               Apply changes (without this, runs in dry-run mode)
 *   --throttle DURATION    Minimum time between requests in ms (default: 40)
 *   --help                 Show help message
 *
 * CSV Input Format:
 *   recurly_account_code,target_stripe_account,stripe_customer_id
 *   507f1f77bcf86cd799439011,stripe-uk,cus_1234567890abcdef
 *
 * CSV Output Format:
 *   recurly_account_code,target_stripe_account,stripe_customer_id,previous_recurly_status,previous_recurly_subscription_id,status,note
 *
 * Note: recurly_account_code is the Overleaf user ID (admin_id)
 */

import fs from 'node:fs'
import path from 'node:path'
import { setTimeout } from 'node:timers/promises'
import * as csv from 'csv'
import minimist from 'minimist'
import { z } from '../../app/src/infrastructure/Validation.mjs'
import { scriptRunner } from '../lib/ScriptRunner.mjs'
import {
  getRegionClient,
  convertStripeStatusToSubscriptionState,
} from '../../modules/subscriptions/app/src/StripeClient.mjs'
import RecurlyWrapper from '../../app/src/Features/Subscription/RecurlyWrapper.mjs'
import { Subscription } from '../../app/src/models/Subscription.mjs'
import AnalyticsManager from '../../app/src/Features/Analytics/AnalyticsManager.mjs'
import AccountMappingHelper from '../../app/src/Features/Analytics/AccountMappingHelper.mjs'
import { ReportError } from './helpers.mjs'

const DEFAULT_THROTTLE = 40

const preloadedProductMetadata = new Map()

function usage() {
  console.error(`Usage: node scripts/stripe/finalize-stripe-subscription-migration.mjs [OPTS] [INPUT-FILE]

Options:
    --output PATH          Output file path (default: /tmp/migrate_output_<timestamp>.csv)
    --commit               Apply changes (without this, runs in dry-run mode)
    --throttle DURATION    Minimum time between requests in ms (default: ${DEFAULT_THROTTLE})
    --help                 Show this help message
`)
}

async function main(trackProgress) {
  const opts = parseArgs()
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const outputFile = opts.output ?? `/tmp/migrate_output_${timestamp}.csv`

  await trackProgress('Starting Recurly to Stripe migration cutover')
  await trackProgress(`Run mode: ${opts.commit ? 'COMMIT' : 'DRY RUN'}`)
  await trackProgress(`Throttle: ${opts.throttle}ms between requests`)

  const inputStream = opts.inputFile
    ? fs.createReadStream(opts.inputFile)
    : process.stdin
  const csvReader = getCsvReader(inputStream)
  const csvWriter = getCsvWriter(outputFile)

  await trackProgress('Populating product metadata cache...')
  await preloadProductMetadata('uk')
  await preloadProductMetadata('us')
  await trackProgress('Product metadata cache populated')

  await trackProgress(`Output: ${outputFile}`)

  let processedCount = 0
  let successCount = 0
  let errorCount = 0

  let lastLoopTimestamp = 0
  for await (const input of csvReader) {
    const timeSinceLastLoop = Date.now() - lastLoopTimestamp
    if (timeSinceLastLoop < opts.throttle) {
      await setTimeout(opts.throttle - timeSinceLastLoop)
    }
    lastLoopTimestamp = Date.now()

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
        status: result.status,
        note: result.note,
      })

      if (result.status === 'migrated' || result.status === 'validated') {
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
          status: 'error',
          note: err.message,
        })
      }
    }
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
  const products = await stripeClient.stripe.products.list({
    active: true,
    limit: 100,
  })

  const cache = new Map()
  for (const product of products.data) {
    cache.set(product.id, product.metadata)
  }

  preloadedProductMetadata.set(region, cache)
}

async function processMigration(input, commit) {
  const {
    recurly_account_code: accountCode,
    target_stripe_account: targetStripeAccount,
    stripe_customer_id: stripeCustomerId,
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
    stripeCustomer = await stripeClient.getCustomerById(stripeCustomerId, [
      'subscriptions',
    ])
    if (
      !stripeCustomer.subscriptions ||
      stripeCustomer.subscriptions.data.length === 0
    ) {
      throw new ReportError(
        'no-stripe-subscription',
        'No Stripe subscriptions found for customer'
      )
    }
    // find the subscription with migration metadata
    stripeSubscription = stripeCustomer.subscriptions.data.find(
      sub => sub.metadata?.recurly_to_stripe_migration_status === 'in_progress'
    )
    if (!stripeSubscription) {
      throw new ReportError(
        'no-stripe-subscription',
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
    recurlySubscription = await RecurlyWrapper.promises.getSubscription(
      previousRecurlySubscriptionId,
      {}
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
    return {
      status: 'changes-detected',
      note: `Changes found: ${changes.join('; ')}`,
      previousRecurlyStatus,
      previousRecurlySubscriptionId,
      email: stripeCustomer.email,
    }
  }

  // 7. If commit mode, perform migration
  if (commit) {
    await performCutover(
      mongoSubscription,
      stripeSubscription,
      recurlySubscription,
      stripeClient,
      stripeCustomer
    )
    return {
      status: 'migrated',
      note: 'Successfully migrated to Stripe',
      previousRecurlyStatus,
      previousRecurlySubscriptionId,
      email: stripeCustomer.email,
    }
  } else {
    return {
      status: 'validated',
      note: 'DRY RUN: Ready to migrate',
      previousRecurlyStatus,
      previousRecurlySubscriptionId,
      email: stripeCustomer.email,
    }
  }
}

// TODO: add other plan codes as needed
const RECURLY_PLAN_CODE_TO_STRIPE_PLAN_CODE = {
  student_free_trial_7_days: 'student',
  collaborator_free_trial_7_days: 'collaborator',
  student: 'student',
  collaborator: 'collaborator',
  'collaborator-annual': 'collaborator-annual',
  'collaborator-annual_free_trial_7_days': 'collaborator-annual',
  professional_free_trial_7_days: 'professional',
  professional: 'professional',
  'professional-annual': 'professional-annual',
  'student-annual': 'student-annual',
}

function detectChanges(recurlySubscription, stripeSubscription, region) {
  const changes = []

  // Extract item codes from Recurly subscription (excluding additional-license
  // add-on, which is not a separate add-on in Stripe)
  const planCode = recurlySubscription.plan.plan_code
  const recurlyItemCodes = JSON.stringify(
    [
      RECURLY_PLAN_CODE_TO_STRIPE_PLAN_CODE[planCode] || planCode,
      ...(recurlySubscription.subscription_add_ons || [])
        .filter(addOn => addOn.add_on_code !== 'additional-license')
        .map(addOn => addOn.add_on_code),
    ].sort()
  )

  // Extract item codes from Stripe subscription
  const cache = preloadedProductMetadata.get(region)
  const stripeItemCodes = JSON.stringify(
    stripeSubscription.items.data
      .map(item => {
        const productMetadata = cache.get(item.price.product)
        return productMetadata?.planCode || productMetadata?.addOnCode || null
      })
      .filter(code => code !== null)
      .sort()
  )

  // Compare item codes
  if (recurlyItemCodes !== stripeItemCodes) {
    changes.push(
      `Items: Recurly=[${recurlyItemCodes}], Stripe=[${stripeItemCodes}]`
    )
  }

  // TODO: compare quantities for each item, taking additional-license add-ons into account

  // Compare states
  const recurlyState = recurlySubscription.state
  const stripeState = convertStripeStatusToSubscriptionState(stripeSubscription)
  if (recurlyState !== stripeState) {
    changes.push(`State: Recurly=${recurlyState}, Stripe=${stripeState}`)
  }

  // Verify no changes have been scheduled in Recurly
  if (recurlySubscription.pending_subscription != null) {
    changes.push('Pending change now exists in Recurly subscription')
  }

  return changes
}

async function performCutover(
  mongoSubscription,
  stripeSubscription,
  recurlySubscription,
  stripeClient,
  stripeCustomer
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

  await mongoSubscription.save()

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
      await RecurlyWrapper.promises.apiRequest({
        url: `subscriptions/${recurlySubscription.uuid}/postpone`,
        qs: { bulk: true, next_bill_date: postponedDate },
        method: 'PUT',
      })
    } catch (err) {
      throw new Error(`Failed to postpone Recurly billing: ${err.message}`)
    }
  }

  // Step 4: Remove migration metadata from Stripe
  try {
    await stripeClient.updateSubscriptionMetadata(stripeSubscription.id, {
      recurly_to_stripe_migration_status: '',
    })
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
      'analytics-mapping-failed',
      `Successfully migrated to Stripe but failed to register analytics mapping: ${err.message}`
    )
  }

  // Step 6. Remap customer metadata (if needed) in Stripe
  if (
    stripeCustomer.metadata != null &&
    stripeCustomer.metadata.recurlyAccountCode != null &&
    stripeCustomer.metadata.userId == null
  ) {
    try {
      await stripeClient.updateCustomerMetadata(stripeCustomer.id, {
        recurlyAccountCode: '',
        userId: adminUserId,
      })
    } catch (err) {
      throw new ReportError(
        'customer-metadata-removal-failed',
        `Successfully migrated to Stripe and registered analytics mapping but failed to remove customer metadata: ${err.message}`
      )
    }
  }
}

function parseArgs() {
  const args = minimist(process.argv.slice(2), {
    string: ['output'],
    number: ['throttle'],
    boolean: ['commit', 'help'],
    default: { commit: false, throttle: DEFAULT_THROTTLE },
  })

  if (args.help) {
    usage()
    process.exit(0)
  }

  const inputFile = args._[0]
  const paramsSchema = z.object({
    output: z.string().optional(),
    commit: z.boolean(),
    throttle: z.number().int().positive(),
    inputFile: z.string().optional(),
  })

  try {
    return paramsSchema.parse({
      output: args.output,
      commit: args.commit,
      throttle: args.throttle,
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
