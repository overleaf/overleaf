import fs from 'node:fs'
import minimist from 'minimist'
import { parse } from 'csv'
import Stream from 'node:stream/promises'
import { ObjectId } from '../app/src/infrastructure/mongodb.js'
import { Subscription } from '../app/src/models/Subscription.js'

function usage() {
  console.log(
    'Usage: node add_salesforce_data_to_subscriptions.mjs -f <filename> [options]'
  )
  console.log(
    'Updates the subscriptions collection with external IDs for determining the Salesforce account that goes with the subscription. The file should be a CSV and have columns account_id, v1_id and subscription_id. The account_id column is the Salesforce account ID, the v1_id column is the V1 account ID, and the subscription_id column is the subscription ID.'
  )
  console.log('Options:')
  console.log(
    '  --commit, -c                     Commit changes to the database'
  )
  console.log(
    '  --emptyFieldValue <value>      The value to treat as an empty field (default: NA)'
  )
  console.log(
    '  -f, --filename <filename>      The path to the file to read data from'
  )
  console.log('  -h, --help                     Show this help message')
  console.log('  -v, --verbose                  Produces more detailed logs')
  process.exit(0)
}

const { commit, emptyFieldValue, filename, help, verbose } = minimist(
  process.argv.slice(2),
  {
    string: ['emptyFieldValue', 'filename'],
    boolean: ['commit', 'help', 'verbose'],
    alias: {
      commit: 'c',
      filename: 'f',
      help: 'h',
      verbose: 'v',
    },
    default: {
      commit: false,
      emptyFieldValue: 'NA',
      help: false,
      verbose: false,
    },
  }
)

const SUBSCRIPTION_ID_FIELD = 'subscription_id'
const SALESFORCE_ID_FIELD = 'account_id'
const V1_ID_FIELD = 'v1_id'

if (help) {
  usage()
  process.exit(0)
}

if (!filename) {
  console.error('No filename provided')
  usage()
  process.exit(1)
}

const stats = {
  totalRows: 0,
  subscriptionIDMissing: 0,
  usedV1ID: 0,
  usedSalesforceID: 0,
  processedRows: 0,
  db: {
    errors: 0,
    matched: 0,
    updateAttempted: 0,
    updated: 0,
  },
}

function showStats() {
  console.log('Stats:')
  console.log(`  Total rows: ${stats.totalRows}`)
  console.log(`  Processed rows: ${stats.processedRows}`)
  console.log(`  Skipped (no subscription ID): ${stats.subscriptionIDMissing}`)
  console.log(`  Used V1 ID: ${stats.usedV1ID}`)
  console.log(`  Used Salesforce ID: ${stats.usedSalesforceID}`)
  if (commit) {
    console.log('Database operations:')
    console.log(`  Errors: ${stats.db.errors}`)
    console.log(`  Matched: ${stats.db.matched}`)
    console.log(`  Updated: ${stats.db.updated}`)
    console.log(`  Update attempted: ${stats.db.updateAttempted}`)
  }
}

function pickRelevantColumns(row) {
  const newRow = {
    salesforceId: row[SALESFORCE_ID_FIELD],
  }

  if (row[V1_ID_FIELD] && row[V1_ID_FIELD] !== emptyFieldValue) {
    newRow.v1Id = row[V1_ID_FIELD]
  }

  if (
    row[SUBSCRIPTION_ID_FIELD] &&
    row[SUBSCRIPTION_ID_FIELD] !== emptyFieldValue
  ) {
    newRow.subscriptionId = row[SUBSCRIPTION_ID_FIELD]
  }

  return newRow
}

async function processRows(rows) {
  for await (const row of rows) {
    const { v1Id, salesforceId, subscriptionId } = row

    const update = {}
    if (v1Id) {
      stats.usedV1ID++
      update.v1_id = v1Id
    } else {
      stats.usedSalesforceID++
      update.salesforce_id = salesforceId
    }

    // Useful for logging later.
    const updateString = Object.entries(update).flatMap(([k, v]) => `${k}=${v}`)

    if (commit) {
      try {
        const result = await Subscription.updateOne(
          { _id: new ObjectId(subscriptionId) },
          update,
          { upsert: false }
        )
        if (result.matchedCount) {
          stats.db.matched++
        }
        if (result.modifiedCount) {
          stats.db.updated++
          if (verbose) {
            console.log(
              `Updated subscription ${subscriptionId} to set ${updateString}`
            )
          }
        }
      } catch (error) {
        stats.db.errors++
        if (verbose) {
          console.error(
            `Error updating subscription ${subscriptionId}: ${error}`
          )
        }
      } finally {
        stats.db.updateAttempted++
      }
    } else if (verbose) {
      console.log(`Would set ${updateString} on subscription ${subscriptionId}`)
    }
  }
}

async function main() {
  await Stream.pipeline(
    fs.createReadStream(filename),
    parse({
      columns: true,
      cast: function (value, context) {
        if (context.column === V1_ID_FIELD && value !== emptyFieldValue) {
          return parseInt(value)
        }
        return value
      },
      on_record: function (record, context) {
        stats.totalRows++
        const row = pickRelevantColumns(record)
        // Cannot process records without a Subscription ID
        if (!row.subscriptionId) {
          if (verbose) {
            console.log(
              `No subscription id found for ${row.salesforceId}, skipping...`
            )
          }
          stats.subscriptionIDMissing++
          return null
        }
        stats.processedRows++
        return row
      },
    }),
    processRows
  )
}

if (!commit) {
  console.log('Dry run')
} else {
  console.log('Committing changes to the database')
}

await main()
showStats()
process.exit()
