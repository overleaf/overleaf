import Settings from '@overleaf/settings'
import recurly from 'recurly'
import fs from 'node:fs'
import { setTimeout } from 'node:timers/promises'
import minimist from 'minimist'
import * as csv from 'csv'
import Stream from 'node:stream/promises'
import { scriptRunner } from '../lib/ScriptRunner.mjs'

const recurlyApiKey = Settings.apis.recurly.apiKey
if (!recurlyApiKey) {
  throw new Error('Recurly API key is not set in the settings')
}
const client = new recurly.Client(recurlyApiKey)

function usage() {
  console.error(
    'Script to retrieve details of manually billed users from Recurly'
  )
  console.error('')
  console.error('Usage:')
  console.error(
    '  node scripts/recurly/get_manually_billed_users_details.mjs [options]'
  )
  console.error('')
  console.error('Options:')
  console.error(
    '  --input, -i <file>   Path to CSV file containing subscription_id, period_end, currency (can be exported from Recurly)'
  )
  console.error('  --output, -o <file>  Path to output CSV file')
  console.error('')
  console.error('Input format:')
  console.error(
    '  CSV file with the following columns: subscription_id, period_end, currency (header row is skipped)'
  )
}

function parseArgs() {
  return minimist(process.argv.slice(2), {
    alias: { i: 'input', o: 'output' },
    string: ['input', 'output'],
  })
}

async function enrichRow(row) {
  const account = await client.getAccount(`code-${row.account_code}`)
  return {
    ...row,
    email: account.email,
    first_name: account.firstName,
    last_name: account.lastName,
    cc_emails: account.ccEmails,
  }
}

async function main() {
  const { input: inputPath, output: outputPath, h, help } = parseArgs()
  if (help || h || !inputPath || !outputPath) {
    usage()
    process.exit(0)
  }

  let processedCount = 0
  await Stream.pipeline([
    fs.createReadStream(inputPath),
    csv.parse({ columns: true }),
    async function* (rows) {
      for await (const row of rows) {
        try {
          yield await enrichRow(row)
        } catch (error) {
          console.error(`Error processing subscription ${row.subscription_id}`)
        }
        processedCount++
        if (processedCount % 1 === 0) {
          console.log(`Processed ${processedCount} subscriptions`)
        }
        await setTimeout(1000)
      }
    },
    csv.stringify({
      header: true,
      columns: {
        subscription_id: 'subscription_id',
        current_period_ends_at: 'period_end',
        currency: 'currency',
        email: 'email',
        first_name: 'first_name',
        last_name: 'last_name',
        cc_emails: 'cc_emails',
      },
    }),
    fs.createWriteStream(outputPath),
  ])
  console.log(`Processed ${processedCount} subscriptions in total`)
}

try {
  await scriptRunner(main)
  process.exit(0)
} catch (error) {
  console.error(error)
  process.exit(1)
}
