// @ts-check
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
import path from 'node:path'
import projectKey from '@overleaf/object-persistor/src/ProjectKey.js'
import streams from './streams.js'
import objectPersistor from '@overleaf/object-persistor'
import { getEndDateForRPO } from '../../backupVerifier/utils.mjs'

/**
 * @typedef {import("@overleaf/object-persistor/src/PerProjectEncryptedS3Persistor.js").CachedPerProjectEncryptedS3Persistor} CachedPerProjectEncryptedS3Persistor
 */

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
        throw new BackupCorruptedMissingBlobError('missing blob', {
          path,
          hash,
        })
      }
      throw err
    }
    const backupHash = await blobHash.fromStream(blob.getByteLength(), stream)
    if (backupHash !== hash) {
      throw new BackupCorruptedInvalidBlobError(
        'hash mismatch for backed up blob',
        {
          path,
          hash,
          backupHash,
        }
      )
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
export async function loadChunk(
  historyId,
  startVersion,
  backupPersistorForProject
) {
  const key = path.join(
    projectKey.format(historyId),
    projectKey.pad(startVersion)
  )
  try {
    const buf = await streams.gunzipStreamToBuffer(
      await backupPersistorForProject.getObjectStream(chunksBucket, key)
    )
    return JSON.parse(buf.toString('utf-8'))
  } catch (err) {
    if (err instanceof objectPersistor.Errors.NotFoundError) {
      throw new Chunk.NotPersistedError(historyId)
    }
    if (err instanceof Error) {
      throw OError.tag(err, 'Failed to load chunk', { historyId, startVersion })
    }
    throw err
  }
}

/**
 * @param {string} historyId
 * @param {Date} endTimestamp
 */
export async function verifyProject(historyId, endTimestamp) {
  const backend = chunkStore.getBackend(historyId)
  const [first, last] = await Promise.all([
    backend.getChunkForVersion(historyId, 0),
    backend.getChunkForTimestamp(historyId, endTimestamp),
  ])

  const chunksRecordsToVerify = [
    {
      chunkId: first.id,
      chunkLabel: 'first',
      ...first,
    },
  ]
  if (first.startVersion !== last.startVersion) {
    chunksRecordsToVerify.push({
      chunkId: last.id,
      chunkLabel: 'last before RPO',
      ...last,
    })
  }

  const projectCache = await getProjectPersistor(historyId)
  const chunks = await Promise.all(
    chunksRecordsToVerify.map(async chunk => {
      try {
        const chunkContents = await loadChunk(
          historyId,
          chunk.startVersion,
          projectCache
        )
        // filter the raw changes to only those that are <= endTimestamp
        // to simulate the state of the project at endTimestamp
        chunkContents.changes = chunkContents.changes.filter(
          change => new Date(change.timestamp) <= endTimestamp
        )
        return History.fromRaw(chunkContents)
      } catch (err) {
        if (err instanceof Chunk.NotPersistedError) {
          throw new BackupRPOViolationChunkNotBackedUpError(
            'BackupRPOviolation: chunk not backed up',
            chunk
          )
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
export class BackupCorruptedMissingBlobError extends BackupCorruptedError {}
export class BackupCorruptedInvalidBlobError extends BackupCorruptedError {}
export class BackupRPOViolationChunkNotBackedUpError extends OError {}
