import recurly from 'recurly'
import Settings from '@overleaf/settings'
import fs from 'node:fs'
import minimist from 'minimist'
import * as csv from 'csv'
import { setTimeout } from 'node:timers/promises'
import { scriptRunner } from '../lib/ScriptRunner.mjs'

const recurlyApiKey = Settings.apis.recurly.apiKey
if (!recurlyApiKey) {
  throw new Error('Recurly API key is not set in the settings')
}
const client = new recurly.Client(recurlyApiKey)

function usage() {
  console.error(
    'Script to update terms and conditions for manually billed Recurly subscriptions'
  )
  console.error('')
  console.error('Usage:')
  console.error(
    '  node scripts/recurly/update_terms_and_conditions_for_manually_billed_users.mjs [options]'
  )
  console.error('')
  console.error('Options:')
  console.error(
    '  --input, -i <file>              Path to CSV file containing subscription IDs (can be exported from Recurly)'
  )
  console.error(
    '  --termsAndConditions, -t <file>  Path to text file containing terms and conditions'
  )
  console.error('')
  console.error('Input format:')
  console.error(
    '  - Subscription IDs CSV: First column contains subscription IDs (header row is skipped)'
  )
  console.error(
    '  - Terms and conditions: Plain text file with the terms and conditions content'
  )
}

function parseArgs() {
  return minimist(process.argv.slice(2), {
    string: ['input', 'termsAndConditions'],
    alias: {
      i: 'input',
      t: 'termsAndConditions',
    },
  })
}

async function updateTermsAndConditionsForSubscription(
  subscriptionId,
  termsAndConditions
) {
  try {
    await client.updateSubscription(`uuid-${subscriptionId}`, {
      terms_and_conditions: termsAndConditions,
    })
  } catch (error) {
    console.error(
      `Error updating subscription ${subscriptionId}: ${error.message}`
    )
  }
}

async function main() {
  const {
    termsAndConditions: termsAndConditionsPath,
    input: inputPath,
    h,
    help,
  } = parseArgs()
  if (help || h || !termsAndConditionsPath || !inputPath) {
    usage()
    process.exit(0)
  }
  const termsAndConditions = fs.readFileSync(termsAndConditionsPath, 'utf8')

  const parser = csv.parse({ columns: true })
  fs.createReadStream(inputPath).pipe(parser)
  let processedCount = 0
  for await (const row of parser) {
    const subscriptionId = row.subscription_id
    await updateTermsAndConditionsForSubscription(
      subscriptionId,
      termsAndConditions
    )
    processedCount++
    if (processedCount % 10 === 0) {
      console.log(`Processed ${processedCount} subscriptions`)
    }
    await setTimeout(1000)
  }
  console.log(`Processed ${processedCount} subscriptions in total`)
}

try {
  await scriptRunner(main)
  process.exit(0)
} catch (error) {
  console.error(error)
  process.exit(1)
}
