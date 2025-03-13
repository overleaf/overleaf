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
 * @return {Promise<{hash: string, historyId: string}>}
 */
async function fetchOptions() {
  const { historyId, hash } = commandLineArgs([
    { name: 'historyId', type: String },
    { name: 'hash', type: String },
  ])

  if (!historyId) {
    console.error('historyId is required')
    process.exitCode = 1
    await gracefulShutdown()
  }

  assert.projectId(historyId)

  if (!hash) {
    console.error('hash is required')
    process.exitCode = 1
    await gracefulShutdown()
  }

  assert.blobHash(hash)

  await loadGlobalBlobs()

  if (GLOBAL_BLOBS.has(hash)) {
    console.error(`Blob ${hash} is a global blob; not backing up`)
    process.exitCode = 1
    await gracefulShutdown()
  }
  return { hash, historyId }
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

let options

try {
  options = await fetchOptions()
} catch (error) {
  console.error(error)
  await gracefulShutdown()
}

if (!options) {
  // This is mostly to satisfy typescript
  process.exitCode = 1
  await gracefulShutdown()
  process.exit(1)
}

try {
  const { hash, historyId } = options
  await downloadAndBackupBlob(historyId, hash)
} catch (error) {
  console.error(error)
  process.exitCode = 1
} finally {
  await gracefulShutdown()
}
