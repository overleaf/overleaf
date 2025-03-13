// @ts-check
import commandLineArgs from 'command-line-args'
import { backupBlob, downloadBlobToDir } from '../lib/backupBlob.mjs'
import withTmpDir from '../../api/controllers/with_tmp_dir.js'
import {
  BlobStore,
  GLOBAL_BLOBS,
  loadGlobalBlobs,
} from '../lib/blob_store/index.js'
import assert from '../lib/assert.js'
import knex from '../lib/knex.js'
import { client } from '../lib/mongodb.js'
import { setTimeout } from 'node:timers/promises'
import fs from 'node:fs'

await loadGlobalBlobs()

/**
 * Gracefully shutdown the process
 * @return {Promise<void>}
 */
async function gracefulShutdown() {
  console.log('Gracefully shutting down')
  await knex.destroy()
  await client.close()
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
 *
 * @param {string} historyId
 * @param {string} hash
 * @return {Promise<void>}
 */
export async function downloadAndBackupBlob(historyId, hash) {
  const blobStore = new BlobStore(historyId)
  const blob = await blobStore.getBlob(hash)
  if (!blob) {
    throw new Error(`Blob ${hash} could not be loaded`)
  }
  await withTmpDir(`blob-${hash}`, async tmpDir => {
    const filePath = await downloadBlobToDir(historyId, blob, tmpDir)
    console.log(`Downloaded blob ${hash} to ${filePath}`)
    await backupBlob(historyId, blob, filePath)
    console.log('Backed up blob')
  })
}

let jobs

const options = commandLineArgs([
  { name: 'historyId', type: String },
  { name: 'hash', type: String },
  { name: 'input', type: String },
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

for (const { historyId, hash } of jobs) {
  try {
    await downloadAndBackupBlob(historyId, hash)
  } catch (error) {
    console.error(error)
    process.exitCode = 1
  }
}
await gracefulShutdown()
