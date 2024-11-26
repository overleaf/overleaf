// @ts-check
import config from 'config'
import OError from '@overleaf/o-error'
import { backupPersistor, projectBlobsBucket } from './backupPersistor.mjs'
import { Blob } from 'overleaf-editor-core'
import { BlobStore, makeProjectKey } from './blob_store/index.js'
import blobHash from './blob_hash.js'
import { NotFoundError } from '@overleaf/object-persistor/src/Errors.js'

/**
 * @typedef {import("@overleaf/object-persistor/src/PerProjectEncryptedS3Persistor").CachedPerProjectEncryptedS3Persistor} CachedPerProjectEncryptedS3Persistor
 */

/**
 * @param {string} historyId
 * @param {string} hash
 */
export async function verifyBlob(historyId, hash) {
  return await verifyBlobs(historyId, [hash])
}

/**
 * @param {string} historyId
 * @param {Array<string>} hashes
 */
export async function verifyBlobs(historyId, hashes) {
  let projectCache
  try {
    projectCache = await backupPersistor.forProjectRO(
      projectBlobsBucket,
      makeProjectKey(historyId, '')
    )
  } catch (err) {
    if (err instanceof NotFoundError) {
      throw new BackupCorruptedError('dek does not exist', {}, err)
    }
    throw err
  }
  await verifyBlobsWithCache(historyId, projectCache, hashes)
}

/**
 * @param {string} historyId
 * @param {CachedPerProjectEncryptedS3Persistor} projectCache
 * @param {Array<string>} hashes
 */
export async function verifyBlobsWithCache(historyId, projectCache, hashes) {
  if (hashes.length === 0) throw new Error('bug: empty hashes')
  const blobStore = new BlobStore(historyId)
  for (const hash of hashes) {
    const path = makeProjectKey(historyId, hash)
    const blob = await blobStore.getBlob(hash)
    if (!blob) throw new Blob.NotFoundError(hash)
    let stream
    try {
      stream = await projectCache.getObjectStream(projectBlobsBucket, path, {
        autoGunzip: true,
      })
    } catch (err) {
      if (err instanceof NotFoundError) {
        throw new BackupCorruptedError('missing blob')
      }
      throw err
    }
    const backupHash = await blobHash.fromStream(blob.getByteLength(), stream)
    if (backupHash !== hash) {
      throw new BackupCorruptedError('hash mismatch for backed up blob', {
        path,
        hash,
        backupHash,
      })
    }
  }
}

export class BackupCorruptedError extends OError {}

export async function healthCheck() {
  /** @type {Array<string>} */
  const HEALTH_CHECK_BLOBS = JSON.parse(config.get('healthCheckBlobs'))
  if (HEALTH_CHECK_BLOBS.length !== 2) {
    throw new Error('expected 2 healthCheckBlobs')
  }
  if (!HEALTH_CHECK_BLOBS.some(path => path.split('/')[0].length === 24)) {
    throw new Error('expected mongo id in healthCheckBlobs')
  }
  if (!HEALTH_CHECK_BLOBS.some(path => path.split('/')[0].length < 24)) {
    throw new Error('expected postgres id in healthCheckBlobs')
  }
  if (HEALTH_CHECK_BLOBS.some(path => path.split('/')[1]?.length !== 40)) {
    throw new Error('expected hash in healthCheckBlobs')
  }

  for (const path of HEALTH_CHECK_BLOBS) {
    const [historyId, hash] = path.split('/')
    await verifyBlob(historyId, hash)
  }
}
