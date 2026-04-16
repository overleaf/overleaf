#!/usr/bin/env node

/**
 * This script reads a CSV file (output from migrate_mailchimp_to_cio.mjs or
 * export_active_subscription_users_csv.mjs) and
 * makes batch identify requests to Customer.io using the CDP Analytics node library.
 *
 * Usage:
 *   node scripts/batch_identify_to_cio.mjs --input INPUT-FILE [OPTIONS]
 *
 * Example:
 *   node scripts/batch_identify_to_cio.mjs --input /tmp/customerio_import.csv
 *   CUSTOMER_IO_API_KEY=xxx node scripts/batch_identify_to_cio.mjs --input /tmp/customerio_import.csv --commit
 *
 * Resuming after failure:
 *   CUSTOMER_IO_API_KEY=xxx node scripts/batch_identify_to_cio.mjs --input /tmp/customerio_import.csv --commit --skip 50000
 *
 * Options:
 *   --input, -i PATH       Input CSV file (from migrate_mailchimp_to_cio.mjs) (required)
 *   --commit               Actually send to Customer.io (default is dry-run)
 *   --skip N               Skip the first N rows (for resuming after failure)
 *   --batch-size N         Maximum items per batch (default: 1000)
 *   --help, -h             Show this help message
 *
 * Environment Variables:
 *   CUSTOMER_IO_API_KEY    Customer.io CDP API key (required when using --commit)
 *
 * CSV Input Format (from migrate_mailchimp_to_cio.mjs):
 *   - email: Subscriber email address
 *   - overleafId: Overleaf user ID (from mongo_id)
 *   - created_at: Unix timestamp
 *   - cio_subscription_preferences.topics.<topic_id>: 'true' if subscribed
 *   - labsExperiments: JSON array of experiment names
 *
 * CSV Input Format (from export_active_subscription_users_csv.mjs):
 *   - user_id: Overleaf user ID
 *   - email: Subscriber email address
 *   - plan_type, display_plan_type, pre_migration_plan_type,
 *     pre_migration_display_plan_type, plan_term, ai_plan, ai_plan_term,
 *     next_renewal_date, expiry_date, group_ai_enabled, group_role
 *
 * Rate Limiting:
 *   - Max 3000 requests per 3 seconds (Customer.io limit)
 *   - Progress is logged every 10000 rows for recovery purposes
 *
 * Notes:
 *   - Users are identified by email address (used as userId)
 *   - The library handles batching internally via maxEventsInBatch
 */

import fs, { createReadStream } from 'node:fs'
import * as csv from 'csv'
import minimist from 'minimist'
import { Analytics } from '@customerio/cdp-analytics-node'
import { scriptRunner } from './lib/ScriptRunner.mjs'

const DEFAULT_BATCH_SIZE = 1000
const RATE_LIMIT_REQUESTS = 3000
const RATE_LIMIT_WINDOW_MS = 3000
const PROGRESS_LOG_INTERVAL = 10000

function usage() {
  console.error(`Usage: node scripts/batch_identify_to_cio.mjs --input INPUT-FILE [OPTIONS]

Options:
    --input, -i PATH       Input CSV file (from migrate_mailchimp_to_cio.mjs) (required)
    --commit               Actually send to Customer.io (default is dry-run)
    --skip N               Skip the first N rows (for resuming after failure)
    --batch-size N         Maximum items per batch (default: ${DEFAULT_BATCH_SIZE})
    --help, -h             Show this help message

Environment Variables:
    CUSTOMER_IO_API_KEY    Customer.io CDP API key (required when using --commit)
`)
  process.exit(1)
}

/**
 * Simple rate limiter that enforces max requests per time window
 */
class RateLimiter {
  constructor(maxRequests, windowMs) {
    this.maxRequests = maxRequests
    this.windowMs = windowMs
    this.requests = []
  }

  async waitIfNeeded() {
    const now = Date.now()
    // Remove requests outside the current window
    this.requests = this.requests.filter(t => now - t < this.windowMs)

    if (this.requests.length >= this.maxRequests) {
      // Wait until the oldest request falls outside the window
      const oldestRequest = this.requests[0]
      const waitTime = this.windowMs - (now - oldestRequest) + 10 // +10ms buffer
      await new Promise(resolve => setTimeout(resolve, waitTime))
      // Clean up again after waiting
      this.requests = this.requests.filter(t => Date.now() - t < this.windowMs)
    }

    this.requests.push(Date.now())
  }
}

/**
 * Create a Customer.io Analytics client
 */
function createCioClient(batchSize) {
  const apiKey = process.env.CUSTOMER_IO_API_KEY

  if (!apiKey) {
    throw new Error(
      'CUSTOMER_IO_API_KEY environment variable is required. ' +
        'Set it to your Customer.io CDP API key.'
    )
  }

  return new Analytics({
    writeKey: apiKey,
    host: 'https://cdp.customer.io',
    maxEventsInBatch: batchSize,
  })
}

/**
 * Convert a CSV row to a Customer.io identify payload
 */
function parseOptionalBoolean(value) {
  if (value == null || value === '') {
    return undefined
  }

  const normalized = String(value).trim().toLowerCase()
  if (normalized === 'true') {
    return true
  }
  if (normalized === 'false') {
    return false
  }

  return undefined
}

function parseOptionalInt(value) {
  if (value == null || value === '') {
    return undefined
  }

  const parsed = parseInt(value, 10)
  return Number.isNaN(parsed) ? undefined : parsed
}

function getFirstDefinedValue(row, columnNames) {
  for (const columnName of columnNames) {
    if (Object.prototype.hasOwnProperty.call(row, columnName)) {
      return row[columnName]
    }
  }

  return undefined
}

function rowToIdentifyPayload(row) {
  const email = getFirstDefinedValue(row, ['email'])
  if (!email) {
    return null
  }

  const traits = {}
  const overleafUserId = getFirstDefinedValue(row, [
    'user_id',
    'userId',
    'overleafId',
  ])

  if (email) {
    traits.email = email
  }

  if (overleafUserId) {
    traits.overleaf_id = overleafUserId
  }

  // Add created_at if present (keep as unix timestamp)
  const createdAtValue = getFirstDefinedValue(row, ['created_at'])
  if (createdAtValue) {
    const createdAt = parseOptionalInt(createdAtValue)
    if (createdAt !== undefined) {
      traits.created_at = createdAt
    }
  }

  // Add subscription status fields when present (from export_active_subscription_users_csv.mjs)
  const stringTraitMappings = [
    {
      columnNames: ['plan_type', 'planType'],
      traitName: 'plan_type',
    },
    {
      columnNames: ['display_plan_type', 'displayPlanType'],
      traitName: 'display_plan_type',
    },
    {
      columnNames: ['pre_migration_plan_type', 'preMigrationPlanType'],
      traitName: 'pre_migration_plan_type',
    },
    {
      columnNames: [
        'pre_migration_display_plan_type',
        'preMigrationDisplayPlanType',
      ],
      traitName: 'pre_migration_display_plan_type',
    },
    {
      columnNames: ['plan_term', 'planTerm', 'plan_term_label'],
      traitName: 'plan_term',
    },
    {
      columnNames: ['ai_plan', 'aiPlan'],
      traitName: 'ai_plan',
    },
    {
      columnNames: ['ai_plan_term', 'aiPlanTerm', 'ai_plan_term_label'],
      traitName: 'ai_plan_term',
    },
    {
      columnNames: ['group_role', 'groupRole'],
      traitName: 'group_role',
    },
  ]

  for (const { columnNames, traitName } of stringTraitMappings) {
    const value = getFirstDefinedValue(row, columnNames)
    if (value) {
      traits[traitName] = value
    }
  }

  const nextRenewalDateValue = getFirstDefinedValue(row, [
    'next_renewal_date',
    'nextRenewalDate',
  ])
  if (nextRenewalDateValue !== undefined) {
    if (nextRenewalDateValue === '') {
      traits.next_renewal_date = ''
    } else {
      const nextRenewalDate = parseOptionalInt(nextRenewalDateValue)
      if (nextRenewalDate !== undefined) {
        traits.next_renewal_date = nextRenewalDate
      }
    }
  }

  const expiryDateValue = getFirstDefinedValue(row, [
    'expiry_date',
    'expiryDate',
  ])
  if (expiryDateValue !== undefined) {
    if (expiryDateValue === '') {
      traits.expiry_date = ''
    } else {
      const expiryDate = parseOptionalInt(expiryDateValue)
      if (expiryDate !== undefined) {
        traits.expiry_date = expiryDate
      }
    }
  }

  const groupAiEnabledValue = getFirstDefinedValue(row, [
    'group_ai_enabled',
    'groupAIEnabled',
  ])
  if (groupAiEnabledValue !== undefined) {
    const groupAiEnabled = parseOptionalBoolean(groupAiEnabledValue)
    if (groupAiEnabled !== undefined) {
      traits.group_ai_enabled = groupAiEnabled
    }
  }

  // Add subscription preferences
  for (const key of Object.keys(row)) {
    if (key.startsWith('cio_subscription_preferences.topics.')) {
      if (row[key] === 'true') {
        traits[key] = true
      }
    }
  }

  // Add labsExperiments if present
  if (row.labsExperiments) {
    try {
      traits.labsExperiments = JSON.parse(row.labsExperiments)
    } catch {
      // If it's not valid JSON, store as-is
      traits.labsExperiments = row.labsExperiments
    }
  }

  return {
    // Prefer stable Overleaf user id when available, otherwise fall back to email
    userId: overleafUserId || email,
    email,
    traits,
  }
}

/**
 * Create a CSV parser stream
 */
function createCsvParser(inputPath) {
  return createReadStream(inputPath).pipe(
    csv.parse({
      columns: true,
      skip_empty_lines: true,
      relax_column_count: true,
    })
  )
}

/**
 * Main script function
 */
function main() {
  const argv = minimist(process.argv.slice(2), {
    string: ['input', 'batch-size', 'skip'],
    boolean: ['commit', 'help'],
    alias: {
      i: 'input',
      h: 'help',
    },
  })

  if (argv.help) {
    usage()
  }

  const inputPath = argv.input
  const commit = argv.commit
  const dryRun = !commit
  const batchSize = parseInt(argv['batch-size'], 10) || DEFAULT_BATCH_SIZE
  const skipRows = parseInt(argv.skip, 10) || 0

  if (!inputPath) {
    console.error('Error: --input is required')
    usage()
  }

  if (!fs.existsSync(inputPath)) {
    console.error(`Error: Input file not found: ${inputPath}`)
    process.exit(1)
  }

  if (commit && !process.env.CUSTOMER_IO_API_KEY) {
    console.error(
      'Error: CUSTOMER_IO_API_KEY environment variable is required when using --commit'
    )
    process.exit(1)
  }

  scriptRunner(
    async trackProgress => {
      await trackProgress('Starting batch identify to Customer.io...')
      await trackProgress(`Input: ${inputPath}`)
      await trackProgress(`Batch size limit: ${batchSize}`)
      if (skipRows > 0) {
        await trackProgress(`Skipping first ${skipRows} rows`)
      }
      if (dryRun) {
        await trackProgress('DRY RUN MODE - no requests will be sent')
      }

      const rateLimiter = new RateLimiter(
        RATE_LIMIT_REQUESTS,
        RATE_LIMIT_WINDOW_MS
      )
      const client = dryRun ? null : createCioClient(batchSize)

      // Listen to the 'error' event
      if (!dryRun) {
        client.on('error', err => {
          console.error('cdp-analytics-node error occurred:')
          console.error('Code:', err.code)
          console.error('Reason:', err.reason)
          if (err.ctx) {
            console.error('Context:', err.ctx)
          }
        })
      }

      let rowNumber = 0
      let processedCount = 0
      let skippedCount = 0
      let lastProgressLog = 0
      let loggedFirstIdentifyPayload = false

      const parser = createCsvParser(inputPath)

      try {
        for await (const row of parser) {
          rowNumber++

          // Skip rows if resuming
          if (rowNumber <= skipRows) {
            continue
          }

          const payload = rowToIdentifyPayload(row)
          if (!payload) {
            skippedCount++
            continue
          }

          if (dryRun && !loggedFirstIdentifyPayload) {
            await trackProgress(
              `First identify payload (dry run): ${JSON.stringify(payload)}`
            )
            loggedFirstIdentifyPayload = true
          }

          if (!dryRun) {
            await rateLimiter.waitIfNeeded()
            client.identify(payload)
          }

          processedCount++

          // Log progress periodically
          if (processedCount - lastProgressLog >= PROGRESS_LOG_INTERVAL) {
            await trackProgress(
              `Progress: row ${rowNumber}, sent ${processedCount} requests (${skippedCount} skipped)`
            )
            lastProgressLog = processedCount
          }
        }
      } catch (error) {
        await trackProgress(
          `ERROR at row ${rowNumber}: ${error.message}. Resume with --skip ${rowNumber - 1}`
        )
        throw error
      }

      if (!dryRun && client) {
        await trackProgress('Flushing remaining requests...')
        await client.closeAndFlush()
      }

      await trackProgress(
        `Completed: processed ${processedCount} rows (${skippedCount} skipped due to missing email)`
      )
      if (dryRun) {
        await trackProgress(
          `DRY RUN complete - would have sent ${processedCount} identify requests`
        )
      }
      process.exit(0)
    },
    { inputPath, dryRun, batchSize, skipRows }
  ).catch(err => {
    console.error(err)
    process.exit(1)
  })
}

main()
