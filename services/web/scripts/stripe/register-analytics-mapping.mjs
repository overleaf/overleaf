#!/usr/bin/env node

/**
 * This script registers analytics account mapping for subscriptions migrated to Stripe.
 *
 * // TODO: delete this when the migration is complete
 *
 * Usage:
 *   node scripts/stripe/register-analytics-mapping.mjs [OPTS] [INPUT-FILE]
 *
 * Options:
 *   --output PATH          Output file path (default: /tmp/register_output_<timestamp>.csv)
 *   --commit               Apply changes (without this, runs in dry-run mode)
 *   --help                 Show help message
 *
 * CSV Input Format:
 *   recurly_account_code,target_stripe_account,stripe_customer_id
 *   507f1f77bcf86cd799439011,stripe-uk,cus_1234567890abcdef
 *
 * CSV Output Format:
 *   recurly_account_code,target_stripe_account,stripe_customer_id,status,note
 */

import fs from 'node:fs'
import path from 'node:path'
import * as csv from 'csv'
import minimist from 'minimist'
import { z } from '../../app/src/infrastructure/Validation.mjs'
import { scriptRunner } from '../lib/ScriptRunner.mjs'
import { Subscription } from '../../app/src/models/Subscription.mjs'
import AnalyticsManager from '../../app/src/Features/Analytics/AnalyticsManager.mjs'
import AccountMappingHelper from '../../app/src/Features/Analytics/AccountMappingHelper.mjs'
import { ReportError } from './helpers.mjs'

function usage() {
  console.error(`Usage: node scripts/stripe/register-analytics-mapping.mjs [OPTS] [INPUT-FILE]

Options:
    --output PATH          Output file path (default: /tmp/register_output_<timestamp>.csv)
    --commit               Apply changes (without this, runs in dry-run mode)
    --help                 Show this help message
`)
}

async function main(trackProgress) {
  const opts = parseArgs()
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const outputFile = opts.output ?? `/tmp/register_output_${timestamp}.csv`

  await trackProgress('Starting analytics mapping registration')
  await trackProgress(`Run mode: ${opts.commit ? 'COMMIT' : 'DRY RUN'}`)

  const inputStream = opts.inputFile
    ? fs.createReadStream(opts.inputFile)
    : process.stdin
  const csvReader = getCsvReader(inputStream)
  const csvWriter = getCsvWriter(outputFile)

  await trackProgress(`Output: ${outputFile}`)

  let processedCount = 0
  let successCount = 0
  let errorCount = 0

  for await (const input of csvReader) {
    processedCount++

    try {
      const result = await processRow(input, opts.commit)

      csvWriter.write({
        recurly_account_code: input.recurly_account_code,
        target_stripe_account: input.target_stripe_account,
        stripe_customer_id: input.stripe_customer_id,
        status: result.status,
        note: result.note,
      })

      if (result.status === 'registered' || result.status === 'dry-run') {
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
  }

  await trackProgress(`✅ Total processed: ${processedCount}`)
  if (opts.commit) {
    await trackProgress(`✅ Successfully registered: ${successCount}`)
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

async function processRow(input, commit) {
  const {
    recurly_account_code: accountCode,
    target_stripe_account: targetStripeAccount,
  } = input

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

  // 2. Check if migrated to Stripe
  if (!mongoSubscription.paymentProvider?.service?.includes('stripe')) {
    throw new ReportError('not-stripe', 'Subscription not using Stripe')
  }

  const subscriptionId = mongoSubscription.paymentProvider.subscriptionId
  if (!subscriptionId) {
    throw new ReportError(
      'no-subscription-id',
      'No Stripe subscription ID in Mongo'
    )
  }

  // 3. Register analytics mapping
  if (commit) {
    AnalyticsManager.registerAccountMapping(
      AccountMappingHelper.generateSubscriptionToStripeMapping(
        mongoSubscription._id,
        subscriptionId,
        targetStripeAccount
      )
    )
    return {
      status: 'registered',
      note: 'Analytics mapping registered',
    }
  } else {
    return {
      status: 'dry-run',
      note: 'DRY RUN: Would register analytics mapping',
    }
  }
}

function parseArgs() {
  const args = minimist(process.argv.slice(2), {
    string: ['output'],
    boolean: ['commit', 'help'],
    default: { commit: false },
  })

  if (args.help) {
    usage()
    process.exit(0)
  }

  const inputFile = args._[0]
  const paramsSchema = z.object({
    output: z.string().optional(),
    commit: z.boolean(),
    inputFile: z.string().optional(),
  })

  try {
    return paramsSchema.parse({
      output: args.output,
      commit: args.commit,
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
