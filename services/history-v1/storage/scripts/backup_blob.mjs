// @ts-check
import commandLineArgs from 'command-line-args'
import {
  backupBlob,
  downloadBlobToDir,
  blobIsBackedUp,
} from '../lib/backupBlob.mjs'
import { backupPersistor, projectBlobsBucket } from '../lib/backupPersistor.mjs'
import withTmpDir from '../../api/controllers/with_tmp_dir.js'
import {
  BlobStore,
  GLOBAL_BLOBS,
  loadGlobalBlobs,
  makeProjectKey,
} from '../lib/blob_store/index.js'
import {
  getBackupStatus,
  unsetBackedUpBlobHashes,
} from '../lib/backup_store/index.js'
import chunkStore from '../lib/chunk_store/index.js'
import assert from '../lib/assert.js'
import knex from '../lib/knex.js'
import { client } from '../lib/mongodb.js'
import redis from '../lib/redis.js'
import { setTimeout } from 'node:timers/promises'
import fs from 'node:fs'
import pLimit from 'p-limit'
import Events from 'node:events'

// Silence warning.
Events.setMaxListeners(20)

await loadGlobalBlobs()

/**
 * Gracefully shutdown the process
 * @return {Promise<void>}
 */
async function gracefulShutdown() {
  console.log('Gracefully shutting down')
  await knex.destroy()
  await client.close()
  await redis.disconnect()
  await setTimeout(100)
  process.exit()
}

/**
 *
 * @param {string} row
 * @return {BackupBlobJob}
 */
function parseCSVRow(row) {
  const [historyId, hash] = row.split(',')
  validateBackedUpBlobJob({ historyId, hash })
  return { historyId, hash }
}

/**
 *
 * @param {BackupBlobJob} job
 */
function validateBackedUpBlobJob(job) {
  assert.projectId(job.historyId)
  assert.blobHash(job.hash)
}

/**
 *
 * @param {string} path
 * @return {Promise<Array<BackupBlobJob>>}
 */
async function readCSV(path) {
  let fh
  /** @type {Array<BackupBlobJob>} */
  const rows = []
  try {
    fh = await fs.promises.open(path, 'r')
  } catch (error) {
    console.error(`Could not open file: ${error}`)
    throw error
  }
  for await (const line of fh.readLines()) {
    try {
      const row = parseCSVRow(line)
      if (GLOBAL_BLOBS.has(row.hash)) {
        console.log(`Skipping global blob: ${line}`)
        continue
      }
      rows.push(row)
    } catch (error) {
      console.error(error instanceof Error ? error.message : error)
      console.log(`Skipping invalid row: ${line}`)
    }
  }
  return rows
}

/**
 * @typedef {Object} BackupBlobJob
 * @property {string} hash
 * @property {string} historyId
 */

/**
 * @param {Object} options
 * @property {string} [options.historyId]
 * @property {string} [options.hash]
 * @property {string} [options.input]
 * @return {Promise<Array<BackupBlobJob>>}
 */
async function initialiseJobs({ historyId, hash, input }) {
  if (input) {
    return await readCSV(input)
  }

  if (!historyId) {
    console.error('historyId is required')
    process.exitCode = 1
    await gracefulShutdown()
  }

  if (!hash) {
    console.error('hash is required')
    process.exitCode = 1
    await gracefulShutdown()
  }

  validateBackedUpBlobJob({ historyId, hash })

  if (GLOBAL_BLOBS.has(hash)) {
    console.error(`Blob ${hash} is a global blob; not backing up`)
    process.exitCode = 1
    await gracefulShutdown()
  }
  return [{ hash, historyId }]
}

/**
 * @typedef {import("@overleaf/object-persistor/src/PerProjectEncryptedS3Persistor").CachedPerProjectEncryptedS3Persistor} CachedPerProjectEncryptedS3Persistor
 */

/** @type {Map<string, Promise<CachedPerProjectEncryptedS3Persistor>>} */
const persistorCache = new Map()

/**
 * @param {string} historyId
 * @returns {Promise<CachedPerProjectEncryptedS3Persistor>}
 */
function getPersistor(historyId) {
  let persistorPromise = persistorCache.get(historyId)
  if (!persistorPromise) {
    persistorPromise = backupPersistor.forProject(
      projectBlobsBucket,
      makeProjectKey(historyId, '')
    )
    persistorCache.set(historyId, persistorPromise)
  }
  return persistorPromise
}

// Track processed objects to handle input csv files with duplicate entries
const processedObjects = new Set()

/**
 *
 * @param {string} historyId
 * @param {string} hash
 * @return {Promise<void>}
 */
export async function downloadAndBackupBlob(historyId, hash) {
  const key = `${historyId}:${hash}`
  if (processedObjects.has(key)) {
    console.log(`${historyId} ${hash} skipping previously processed blob`)
    return
  } else {
    processedObjects.add(key)
  }
  const backend = chunkStore.getBackend(historyId)
  const projectId = await backend.resolveHistoryIdToMongoProjectId(historyId)
  // Check whether the project still exists
  try {
    await getBackupStatus(projectId)
  } catch (err) {
    if (err instanceof Error && err.message === 'Project not found') {
      console.log(`${historyId} ${hash} project not found (expired)`)
      return
    } else if (err instanceof Error && err.message === 'Project deleted') {
      console.log(`${historyId} ${hash} project deleted but not expired`)
      // continue and allow backing up blob for a deleted project in case it is undeleted in future
    } else {
      throw err
    }
  }
  // Force clearning of any backed up blob record
  if (options.clear) {
    await unsetBackedUpBlobHashes(projectId, [hash])
  } else if (await blobIsBackedUp(projectId, hash)) {
    // Check if the blob is already backed up
    console.log(`${historyId} ${hash} already backed up`)
    return
  }
  const persistor = await getPersistor(historyId)
  const blobStore = new BlobStore(historyId)
  const blob = await blobStore.getBlob(hash)
  if (!blob) {
    throw new Error(`Blob ${hash} could not be loaded for history ${historyId}`)
  }
  await withTmpDir(`blob-${historyId}-${hash}`, async tmpDir => {
    const filePath = await downloadBlobToDir(historyId, blob, tmpDir)
    console.log(`${historyId} ${hash} Downloaded blob ${filePath}`)
    const status = await backupBlob(historyId, blob, filePath, persistor)
    console.log(`${historyId} ${hash} Blob`, status ?? 'backed up')
  })
}

let jobs

const options = commandLineArgs([
  { name: 'historyId', type: String },
  { name: 'hash', type: String },
  { name: 'input', type: String },
  { name: 'concurrency', alias: 'c', type: Number, defaultValue: 1 },
  { name: 'clear', type: Boolean },
])

try {
  jobs = await initialiseJobs(options)
} catch (error) {
  console.error(error)
  await gracefulShutdown()
}

if (!Array.isArray(jobs)) {
  // This is mostly to satisfy typescript
  process.exitCode = 1
  await gracefulShutdown()
  process.exit(1)
}

const limit = pLimit(options.concurrency)
let successCount = 0
let failedCount = 0
const totalJobs = jobs.length

/**
 * @param {string} historyId
 * @param {string} hash
 */
async function runJob(historyId, hash) {
  try {
    await downloadAndBackupBlob(historyId, hash)
    successCount++
  } catch (error) {
    console.error(`${historyId} ${hash} Error:`, error)
    process.exitCode = 1
    failedCount++
  }
}

const promises = jobs.map(({ historyId, hash }) =>
  limit(runJob, historyId, hash)
)
await Promise.all(promises)
console.log(
  `Backup complete: ${successCount} succeeded, ${failedCount} failed, ${totalJobs} total`
)
await gracefulShutdown()
