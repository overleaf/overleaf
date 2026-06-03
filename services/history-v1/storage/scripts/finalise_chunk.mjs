// Finalise the current chunk for a project and start a new empty chunk
// whose starting snapshot is the end snapshot of the (now-closed) current
// chunk.
//
// This is intended as a recovery tool for projects whose current chunk has
// become corrupted in such a way that further changes can no longer be
// persisted, but where the end snapshot of the current chunk can still be
// computed.

import logger from '@overleaf/logger'
import commandLineArgs from 'command-line-args'
import { Change, Chunk, History, NoOperation } from 'overleaf-editor-core'
import * as redis from '../lib/redis.js'
import knex from '../lib/knex.js'
import knexReadOnly from '../lib/knex_read_only.js'
import { client as mongoClient } from '../lib/mongodb.js'
import chunkStore from '../lib/chunk_store/index.js'
import redisBackend from '../lib/chunk_store/redis.js'
import { loadGlobalBlobs } from '../lib/blob_store/index.js'
import { fileURLToPath } from 'node:url'
import { EventEmitter } from 'node:events'

EventEmitter.defaultMaxListeners = 20

logger.initialize('finalise-chunk')

const optionDefinitions = [
  { name: 'historyId', type: String },
  { name: 'dry-run', alias: 'd', type: Boolean },
]
const options = commandLineArgs(optionDefinitions)
const HISTORY_ID = options.historyId
const DRY_RUN = options['dry-run'] || false

if (!HISTORY_ID) {
  console.error('Usage: finalise_chunk.mjs --historyId <id> [--dry-run]')
  process.exit(2)
}

async function finaliseCurrentChunk(historyId) {
  // Validates the history id and selects the backend (postgres or mongo).
  chunkStore.getBackend(historyId)

  await loadGlobalBlobs()

  const currentChunk = await chunkStore.loadLatest(historyId, {
    persistedOnly: true,
  })
  const startVersion = currentChunk.getStartVersion()
  const endVersion = currentChunk.getEndVersion()
  const numChanges = currentChunk.getChanges().length

  logger.info(
    { historyId, startVersion, endVersion, numChanges },
    'loaded current chunk'
  )

  if (endVersion === startVersion) {
    throw new Error(
      `current chunk for history ${historyId} is already empty (no changes); refusing to create another empty chunk`
    )
  }

  let nonPersistedChanges
  try {
    nonPersistedChanges = await redisBackend.getNonPersistedChanges(
      historyId,
      endVersion
    )
  } catch (err) {
    throw new Error(
      `unable to read non-persisted changes from redis for history ${historyId}: ${err.message}`
    )
  }
  if (nonPersistedChanges.length > 0) {
    throw new Error(
      `history ${historyId} has ${nonPersistedChanges.length} non-persisted change(s) in redis; persist or expire them before running this script`
    )
  }

  const endSnapshot = currentChunk.getSnapshot().clone()
  endSnapshot.applyAll(currentChunk.getChanges())

  // The chunks table has a unique constraint on (doc_id, end_version), so the
  // new chunk cannot share an end_version with the chunk we are closing. Add a
  // single NoOperation change to bump end_version by 1 without mutating the
  // snapshot.
  const recoveryChange = new Change([new NoOperation()], new Date(), [])
  const newChunk = new Chunk(
    new History(endSnapshot, [recoveryChange]),
    endVersion
  )

  if (DRY_RUN) {
    logger.info(
      { historyId, endVersion },
      'dry run: would close current chunk and create new empty chunk'
    )
    return
  }

  await chunkStore.create(historyId, newChunk)

  logger.info(
    { historyId, endVersion },
    'closed current chunk and created new empty chunk'
  )
}

async function main() {
  try {
    await finaliseCurrentChunk(HISTORY_ID)
  } catch (err) {
    logger.fatal({ err, historyId: HISTORY_ID }, 'failed to finalise chunk')
    process.exitCode = 1
  } finally {
    await redis.disconnect()
    await mongoClient.close()
    await knex.destroy()
    await knexReadOnly.destroy()
  }
}

const currentScriptPath = fileURLToPath(import.meta.url)
if (process.argv[1] === currentScriptPath) {
  main()
}

export { finaliseCurrentChunk }
