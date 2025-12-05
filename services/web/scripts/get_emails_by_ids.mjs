import { scriptRunner } from './lib/ScriptRunner.mjs'
import fs from 'node:fs'
import readline from 'node:readline'
import minimist from 'minimist'
import {
  db,
  ObjectId,
  READ_PREFERENCE_SECONDARY,
} from '../app/src/infrastructure/mongodb.mjs'

function usage() {
  console.log(
    `
    This script extracts user emails given a list of newline separated IDs, outputs to /tmp/emails.txt

    Usage:
    - Locally:
        docker compose exec web bash
        node scripts/get_emails_by_ids.js [--inputPath=<path>] [--outputPath=<path>] [--batchSize=<number>]
    - On the server:
        rake run:pod[staging,web]
        node scripts/get_emails_by_ids.js [--inputPath=<path>] [--outputPath=<path>] [--batchSize=<number>]
        exit
        kubectl cp web-standalone-prod-XXXXX:/tmp/emails.txt ~/emails.txt

    Options:
    --help                     Show this screen

    --inputPath=<path>         Input file path (default: ids.txt)

    --outputPath=<path>        Output file path (default: /tmp/emails.txt)

    --batchSize=<number>       Number of emails to be fetched in one query
    `
  )
}

function parseArgs() {
  const argv = minimist(process.argv.slice(2), {
    string: ['inputPath', 'outputPath'],
    bool: ['help'],
    number: ['batchSize'],
    default: {
      help: false,
      inputPath: 'ids.txt',
      outputPath: '/tmp/emails.txt',
      batchSize: 1000,
    },
  })

  if (argv.help) {
    usage()
    process.exit(0)
  }

  return argv
}

async function processBatch(idBatch, writeStream) {
  try {
    const cursor = db.users.find(
      {
        _id: { $in: idBatch },
      },
      {
        projection: {
          _id: 0,
          email: 1,
        },
        readPreference: READ_PREFERENCE_SECONDARY,
      }
    )

    for await (const doc of cursor) {
      if (doc.email) {
        writeStream.write(doc.email + '\n')
      }
    }
  } catch (err) {
    console.error('Error processing batch:', err)
  }
}

async function main(trackProgress) {
  const args = parseArgs()

  const readStream = fs.createReadStream(args.inputPath)
  const writeStream = fs.createWriteStream(args.outputPath)
  const rl = readline.createInterface({
    input: readStream,
    crlfDelay: Infinity,
  })

  let idBatch = []

  for await (const line of rl) {
    const id = line.trim()
    if (id) {
      try {
        idBatch.push(new ObjectId(id))
      } catch (e) {
        console.warn(`Skipping invalid ObjectId: ${id}`)
      }
    }

    if (idBatch.length >= args.batchSize) {
      await processBatch(idBatch, writeStream)
      idBatch = []
    }
  }

  if (idBatch.length > 0) {
    await processBatch(idBatch, writeStream)
  }

  writeStream.end()

  console.log(`✅ Success! Found emails written to ${args.outputPath}`)
  await trackProgress('Job finished')
}

try {
  await scriptRunner(main)
  process.exit(0)
} catch (error) {
  console.error(error)
  process.exit(1)
}
