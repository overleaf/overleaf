// @ts-check
import { ObjectId } from 'mongodb'
import knex from '../lib/knex.js'
import {
  batchedUpdate,
  objectIdFromInput,
  READ_PREFERENCE_SECONDARY,
} from '@overleaf/mongo-utils/batchedUpdate.js'
import {
  GLOBAL_BLOBS,
  loadGlobalBlobs,
  makeProjectKey,
} from '../lib/blob_store/index.js'
import {
  backedUpBlobs as backedUpBlobsCollection,
  db,
  client,
} from '../lib/mongodb.js'
import redis from '../lib/redis.js'
import commandLineArgs from 'command-line-args'
import fs from 'node:fs'

const projectsCollection = db.collection('projects')

// Enable caching for ObjectId.toString()
ObjectId.cacheHexString = true

function parseArgs() {
  const PUBLIC_LAUNCH_DATE = new Date('2012-01-01T00:00:00Z')
  const args = commandLineArgs([
    {
      name: 'BATCH_RANGE_START',
      type: String,
      defaultValue: PUBLIC_LAUNCH_DATE.toISOString(),
    },
    {
      name: 'BATCH_RANGE_END',
      type: String,
      defaultValue: new Date().toISOString(),
    },
    {
      name: 'output',
      type: String,
      alias: 'o',
    },
  ])
  const BATCH_RANGE_START = objectIdFromInput(
    args['BATCH_RANGE_START']
  ).toString()
  const BATCH_RANGE_END = objectIdFromInput(args['BATCH_RANGE_END']).toString()
  if (!args['output']) {
    throw new Error('missing --output')
  }
  const OUTPUT_STREAM = fs.createWriteStream(args['output'])

  return {
    BATCH_RANGE_START,
    BATCH_RANGE_END,
    OUTPUT_STREAM,
  }
}

const { BATCH_RANGE_START, BATCH_RANGE_END, OUTPUT_STREAM } = parseArgs()

// We need to handle the start and end differently as ids of deleted projects are created at time of deletion.
if (process.env.BATCH_RANGE_START || process.env.BATCH_RANGE_END) {
  throw new Error('use --BATCH_RANGE_START and --BATCH_RANGE_END')
}

let gracefulShutdownInitiated = false

process.on('SIGINT', handleSignal)
process.on('SIGTERM', handleSignal)

function handleSignal() {
  gracefulShutdownInitiated = true
  console.warn('graceful shutdown initiated, draining queue')
}

async function processBatch(batch) {
  if (gracefulShutdownInitiated) {
    throw new Error('graceful shutdown: aborting batch processing')
  }

  const N = batch.length
  const firstId = batch[0]._id
  const lastId = batch[N - 1]._id
  const projectCursor = await projectsCollection.find(
    { _id: { $gte: firstId, $lte: lastId } },
    {
      projection: { _id: 1, 'overleaf.history.id': 1, lastUpdated: 1 },
      readPreference: READ_PREFERENCE_SECONDARY,
    }
  )
  const projectMap = new Map()
  for await (const project of projectCursor) {
    projectMap.set(project._id.toString(), project)
  }
  for (const project of batch) {
    const projectId = project._id.toString()
    const projectRecord = projectMap.get(projectId)
    if (!projectRecord) {
      console.error(`project not found: ${projectId}`)
      continue
    }
    if (!projectRecord.overleaf?.history?.id) {
      console.error(`project missing history: ${projectId}`)
      continue
    }
    const historyId = projectRecord.overleaf.history.id.toString()
    const prefix = `${projectId},${projectRecord.lastUpdated.toISOString()},`
    const hashes = project.blobs.map(blob => blob.toString('hex'))
    const projectBlobHashes = hashes.filter(hash => !GLOBAL_BLOBS.has(hash))
    if (projectBlobHashes.length < hashes.length) {
      console.warn(
        `project ${projectId} has ${hashes.length - projectBlobHashes.length} global blobs`
      )
    }
    const rows = projectBlobHashes.map(
      hash => prefix + makeProjectKey(historyId, hash) + '\n'
    )
    OUTPUT_STREAM.write(rows.join(''))
  }
}

async function main() {
  await loadGlobalBlobs()
  OUTPUT_STREAM.write('projectId,lastUpdated,path\n')
  await batchedUpdate(
    backedUpBlobsCollection,
    {},
    processBatch,
    {},
    {},
    { BATCH_RANGE_START, BATCH_RANGE_END }
  )
}

main()
  .then(() => console.log('Done.'))
  .catch(err => {
    console.error('Error:', err)
    process.exitCode = 1
  })
  .finally(() => {
    knex.destroy().catch(err => {
      console.error('Error closing Postgres connection:', err)
    })
    client.close().catch(err => console.error('Error closing MongoDB:', err))
    redis.disconnect().catch(err => {
      console.error('Error disconnecting Redis:', err)
    })
  })
