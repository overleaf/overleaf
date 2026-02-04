#!/usr/bin/env node

/**
 * This script bulk cancels active Stripe subscriptions immediately without proration.
 *
 * NOTE: this will email customers to inform them of the cancellation unless you turn off
 * the cancellation automation in Stripe beforehand: https://dashboard.stripe.com/<account>/revenue-recovery/automations
 *
 * Usage:
 *   node scripts/stripe/bulk-cancel-subscriptions.mjs [OPTS] [INPUT-FILE]
 *
 * Options:
 *   --output PATH          Output file path (default: /tmp/bulk_cancel_output_<timestamp>.csv)
 *                          Use '-' to write to stdout
 *   --commit               Apply changes (without this flag, runs in dry-run mode)
 *   --throttle DURATION    Minimum time (in ms) between subscriptions processed (default: 100)
 *   --help                 Show a help message
 *
 * CSV Input Format:
 *   The CSV must have the following columns:
 *   - stripe_customer_id: Stripe customer id
 *   - target_stripe_account: Either 'stripe-uk' or 'stripe-us'
 *
 * Output:
 *   Writes a CSV with columns:
 *   - stripe_customer_id: The customer id processed
 *   - target_stripe_account: The Stripe account
 *   - subscription_id: The subscription id that was cancelled (if found)
 *   - status: Result status (cancelled, validated, no-subscription, already-cancelled, or error)
 *   - note: Additional information about the status
 */

import fs from 'node:fs'
import path from 'node:path'
import { setTimeout } from 'node:timers/promises'
import * as csv from 'csv'
import minimist from 'minimist'
import { scriptRunner } from '../lib/ScriptRunner.mjs'
import { getRegionClient } from '../../modules/subscriptions/app/src/StripeClient.mjs'
import { ReportError } from './helpers.mjs'

const DEFAULT_THROTTLE = 40

function usage() {
  console.error(`Usage: node scripts/stripe/bulk-cancel-subscriptions.mjs [OPTS] [INPUT-FILE]

Options:
    --output PATH          Output file path (default: /tmp/bulk_cancel_output_<timestamp>.csv)
                           Use '-' to write to stdout
    --commit               Apply changes (without this, runs in dry-run mode)
    --throttle DURATION    Minimum time between requests in ms (default: ${DEFAULT_THROTTLE})
    --help                 Show this help message
`)
}

async function main(trackProgress) {
  const opts = parseArgs()
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const outputFile = opts.output ?? `/tmp/bulk_cancel_output_${timestamp}.csv`

  await trackProgress('Starting bulk subscription cancellation for Stripe')
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
      const result = await processCancellation(input, opts.commit)

      csvWriter.write({
        stripe_customer_id: input.stripe_customer_id,
        target_stripe_account: input.target_stripe_account,
        subscription_id: result.subscriptionId || '',
        status: result.status,
        note:
          result.note || (opts.commit ? '' : 'dry run - no changes applied'),
      })

      if (result.status === 'cancelled' || result.status === 'validated') {
        successCount++
      } else {
        errorCount++
      }

      if (processedCount % 10 === 0) {
        await trackProgress(
          `Processed ${processedCount} customers (${successCount} ${opts.commit ? 'cancelled' : 'validated'}, ${errorCount} errors)`
        )
      }
    } catch (err) {
      errorCount++
      if (err instanceof ReportError) {
        csvWriter.write({
          stripe_customer_id: input.stripe_customer_id,
          target_stripe_account: input.target_stripe_account,
          subscription_id: '',
          status: err.status,
          note: err.message,
        })
      } else {
        csvWriter.write({
          stripe_customer_id: input.stripe_customer_id,
          target_stripe_account: input.target_stripe_account,
          subscription_id: '',
          status: 'error',
          note: err.message,
        })
        await trackProgress(
          `Error processing ${input.stripe_customer_id}: ${err.message}`
        )
      }
    }
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
    string: ['output', 'throttle'],
    boolean: ['commit', 'help'],
    default: {
      throttle: DEFAULT_THROTTLE.toString(),
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

  const throttle = parseInt(args.throttle, 10)
  if (isNaN(throttle) || throttle < 0) {
    console.error('Error: --throttle must be a non-negative integer')
    usage()
    process.exit(1)
  }

  return {
    output: args.output,
    commit: args.commit,
    throttle,
    inputFile: args._[0],
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
      columns: [
        'stripe_customer_id',
        'target_stripe_account',
        'subscription_id',
        'status',
        'note',
      ],
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
    columns: [
      'stripe_customer_id',
      'target_stripe_account',
      'subscription_id',
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

async function processCancellation(input, commit) {
  const {
    stripe_customer_id: customerId,
    target_stripe_account: targetStripeAccount,
  } = input

  // get Stripe client for the target account (strip 'stripe-' prefix if present)
  const region = targetStripeAccount.replace(/^stripe-/, '')
  const stripeClient = getRegionClient(region)

  // fetch customer with subscriptions
  let customer
  try {
    customer = await stripeClient.getCustomerById(customerId, ['subscriptions'])
  } catch (err) {
    throw new ReportError(
      'customer-not-found',
      `Customer not found: ${err.message}`
    )
  }

  // check for active subscriptions
  if (!customer.subscriptions || customer.subscriptions.data.length === 0) {
    throw new ReportError('no-subscriptions', 'Customer has no subscriptions')
  }

  // find the subscription with migration metadata
  const migrationSubscription = customer.subscriptions.data.find(
    sub => sub.metadata?.recurly_to_stripe_migration_status === 'in_progress'
  )
  if (!migrationSubscription) {
    throw new ReportError(
      'no-migration-subscription',
      'Could not find a subscription with migration metadata to cancel'
    )
  }

  // in dry-run mode, just validate
  if (!commit) {
    return {
      status: 'validated',
      note: 'Subscription can be cancelled',
      subscriptionId: migrationSubscription.id,
    }
  }

  // cancel the subscription immediately
  try {
    await stripeClient.terminateSubscription(migrationSubscription.id)

    return {
      status: 'cancelled',
      note: `Cancelled subscription ${migrationSubscription.id}`,
      subscriptionId: migrationSubscription.id,
    }
  } catch (err) {
    throw new ReportError(
      'cancellation-failed',
      `Failed to cancel subscription: ${err.message}`
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
