// @ts-check
import config from 'config'
import OError from '@overleaf/o-error'
import chunkStore from '../lib/chunk_store/index.js'
import {
  backupPersistor,
  chunksBucket,
  projectBlobsBucket,
} from './backupPersistor.mjs'
import { Blob, Chunk, History } from 'overleaf-editor-core'
import { BlobStore, GLOBAL_BLOBS, makeProjectKey } from './blob_store/index.js'
import blobHash from './blob_hash.js'
import { NotFoundError } from '@overleaf/object-persistor/src/Errors.js'
import logger from '@overleaf/logger'
import { text } from 'node:stream/consumers'
import { createGunzip } from 'node:zlib'
import path from 'node:path'
import projectKey from './project_key.js'

const RPO = parseInt(config.get('backupRPOInMS'), 10)

/**
 * @typedef {import("@overleaf/object-persistor/src/PerProjectEncryptedS3Persistor.js").CachedPerProjectEncryptedS3Persistor} CachedPerProjectEncryptedS3Persistor
 */

/**
 * @return {Date}
 */
export function getEndDateForRPO() {
  return new Date(Date.now() - RPO)
}

/**
 * @param {string} historyId
 * @param {string} hash
 */
export async function verifyBlob(historyId, hash) {
  return await verifyBlobs(historyId, [hash])
}

/**
 *
 * @param {string} historyId
 * @return {Promise<CachedPerProjectEncryptedS3Persistor>}
 */
async function getProjectPersistor(historyId) {
  try {
    return await backupPersistor.forProjectRO(
      projectBlobsBucket,
      makeProjectKey(historyId, '')
    )
  } catch (err) {
    if (err instanceof NotFoundError) {
      throw new BackupCorruptedError('dek does not exist', {}, err)
    }
    throw err
  }
}

/**
 * @param {string} historyId
 * @param {Array<string>} hashes
 * @param {CachedPerProjectEncryptedS3Persistor} [projectCache]
 */
export async function verifyBlobs(historyId, hashes, projectCache) {
  if (hashes.length === 0) throw new Error('bug: empty hashes')

  if (!projectCache) {
    projectCache = await getProjectPersistor(historyId)
  }
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
        throw new BackupCorruptedError('missing blob', { path, hash })
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

/**
 * @param {string} historyId
 * @param {Date} [endTimestamp]
 */
export async function verifyProjectWithErrorContext(
  historyId,
  endTimestamp = getEndDateForRPO()
) {
  try {
    await verifyProject(historyId, endTimestamp)
  } catch (err) {
    // @ts-ignore err is Error instance
    throw OError.tag(err, 'verifyProject', { historyId, endTimestamp })
  }
}

/**
 *
 * @param {string} historyId
 * @param {number} startVersion
 * @param {CachedPerProjectEncryptedS3Persistor} backupPersistorForProject
 * @return {Promise<any>}
 */
async function loadChunk(historyId, startVersion, backupPersistorForProject) {
  const key = path.join(
    projectKey.format(historyId),
    projectKey.pad(startVersion)
  )
  const backupChunkStream = await backupPersistorForProject.getObjectStream(
    chunksBucket,
    key
  )
  const raw = await text(backupChunkStream.pipe(createGunzip()))
  return JSON.parse(raw)
}

/**
 * @param {string} historyId
 * @param {Date} endTimestamp
 */
export async function verifyProject(historyId, endTimestamp) {
  const backend = chunkStore.getBackend(historyId)
  const [first, last] = await Promise.all([
    backend.getFirstChunkBeforeTimestamp(historyId, endTimestamp),
    backend.getLastActiveChunkBeforeTimestamp(historyId, endTimestamp),
  ])

  const chunksRecordsToVerify = [
    {
      chunkId: first.id,
      chunkLabel: 'first',
    },
  ]
  if (first.startVersion !== last.startVersion) {
    chunksRecordsToVerify.push({
      chunkId: last.id,
      chunkLabel: 'last before RPO',
    })
  }

  const projectCache = await getProjectPersistor(historyId)

  const chunks = await Promise.all(
    chunksRecordsToVerify.map(async chunk => {
      try {
        return History.fromRaw(
          await loadChunk(historyId, chunk.startVersion, projectCache)
        )
      } catch (err) {
        if (err instanceof Chunk.NotPersistedError) {
          throw new BackupRPOViolationError('backup RPO violation', chunk)
        }
        throw err
      }
    })
  )
  const seenBlobs = new Set()
  const blobsToVerify = []
  for (const chunk of chunks) {
    /** @type {Set<string>} */
    const chunkBlobs = new Set()
    chunk.findBlobHashes(chunkBlobs)
    let hasAddedBlobFromThisChunk = false
    for (const blobHash of chunkBlobs) {
      if (seenBlobs.has(blobHash)) continue // old blob
      if (GLOBAL_BLOBS.has(blobHash)) continue // global blob
      seenBlobs.add(blobHash)
      if (!hasAddedBlobFromThisChunk) {
        blobsToVerify.push(blobHash)
        hasAddedBlobFromThisChunk = true
      }
    }
  }
  if (blobsToVerify.length === 0) {
    logger.debug(
      {
        historyId,
        chunksRecordsToVerify: chunksRecordsToVerify.map(c => c.chunkId),
      },
      'chunks contain no blobs to verify'
    )
    return
  }
  await verifyBlobs(historyId, blobsToVerify, projectCache)
}

export class BackupCorruptedError extends OError {}
export class BackupRPOViolationError extends OError {}

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
