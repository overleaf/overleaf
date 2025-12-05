#!/usr/bin/env node
/* eslint-disable camelcase */

import { scriptRunner } from './lib/ScriptRunner.mjs'
import fs from 'node:fs'
import minimist from 'minimist'
import {
  db,
  ObjectId,
  READ_PREFERENCE_SECONDARY,
} from '../app/src/infrastructure/mongodb.mjs'
// https://github.com/import-js/eslint-plugin-import/issues/1810
// eslint-disable-next-line import/no-unresolved
import * as csv from 'csv/sync'

function usage() {
  console.log(
    `
    This script enriches price and subscription data with user emails and first names, given a csv containing user IDs, outputs to /tmp/output.csv

    Usage:
    - Locally:
        docker compose exec web bash
        node scripts/add_marketing_details_to_csv.mjs [--input=<path>] [--output=<path>] [--batchSize=<number>]
    - On the server:
        rake run:pod[staging,web]
        node scripts/add_marketing_details_to_csv.mjs [--input=<path>] [--output=<path>] [--batchSize=<number>]
        exit
        kubectl cp web-standalone-prod-XXXXX:/tmp/output.csv ~/output.csv

    Options:
    --help                     Show this screen

    --input=<path>             Input file path (default: input.csv)

    --output=<path>            Output file path (default: /tmp/output.csv)

    --batchSize=<number>       Number of users to be fetched in one query
    `
  )
}

function parseArgs() {
  const result = minimist(process.argv.slice(2), {
    string: ['input', 'output'],
    bool: ['help'],
    number: ['batchSize'],
    default: {
      help: false,
      input: 'input.csv',
      output: '/tmp/output.csv',
      batchSize: 1000,
    },
  })

  if (result.help) {
    usage()
    process.exit(0)
  }

  return result
}

async function processBatch(trackProgress, idBatch) {
  const result = {}
  try {
    const cursor = db.users.find(
      {
        _id: { $in: idBatch },
      },
      {
        projection: {
          _id: 1,
          first_name: 1,
          email: 1,
        },
        readPreference: READ_PREFERENCE_SECONDARY,
      }
    )

    for await (const doc of cursor) {
      result[doc._id.toString()] = {
        email: doc.email,
        first_name: doc.first_name,
      }
    }
  } catch (err) {
    await trackProgress(`ERROR Processing batch: ${err}`)
  }
  return result
}

async function enrichRecords(trackProgress, records, users) {
  const result = []

  for (const record of records) {
    const user = users[record.user_id]
    let email = ''
    let first_name = ''
    if (user) {
      if (user.email === '' || user.first_name === '') {
        await trackProgress(`WARNING Incomplete data for: ${record.user_id}`)
      }
      email = user.email
      first_name = user.first_name
    } else {
      await trackProgress(`WARNING Didn't find: ${record.user_id}`)
    }
    result.push({
      ...record,
      email,
      first_name,
    })
  }

  return result
}

async function main(trackProgress) {
  const args = parseArgs()
  const input = fs.readFileSync(args.input, 'utf8')
  const records = csv.parse(input, { columns: true, skipEmptyLines: true })
  await trackProgress(`INFO Starting to process ${records.length} records`)

  let objectIdBatch = []
  let recordBatch = []
  const outputRecords = []
  for (const record of records) {
    try {
      objectIdBatch.push(new ObjectId(record.user_id))
      recordBatch.push(record)
    } catch (e) {
      await trackProgress(`ERROR Skipping invalid user ID: ${record.user_id}`)
      outputRecords.push({ ...record, email: '', first_name: '' })
    }
    if (objectIdBatch.length >= args.batchSize) {
      const users = await processBatch(trackProgress, objectIdBatch)
      const enriched = await enrichRecords(trackProgress, recordBatch, users)
      outputRecords.push(...enriched)

      objectIdBatch = []
      recordBatch = []
    }
  }

  if (objectIdBatch.length > 0) {
    const users = await processBatch(trackProgress, objectIdBatch)
    const enriched = await enrichRecords(trackProgress, recordBatch, users)
    outputRecords.push(...enriched)
  }

  const output = csv.stringify(outputRecords, { header: true })
  fs.writeFileSync(args.output, output)
  await trackProgress(
    `INFO Finished processing of ${outputRecords.length} records`
  )
}

try {
  await scriptRunner(main)
  process.exit(0)
} catch (error) {
  console.error(error)
  process.exit(1)
}
