// @ts-check
import path from 'node:path'
import projectKey from './project_key.js'
import {
  chunksBucket,
  backupPersistor,
  projectBlobsBucket,
} from './backupPersistor.mjs'
import archiver from 'archiver'
import { Chunk, History } from 'overleaf-editor-core'
import { GLOBAL_BLOBS, makeProjectKey } from './blob_store/index.js'
import streams from './streams.js'
import objectPersistor from '@overleaf/object-persistor'
import OError from '@overleaf/o-error'
import chunkStore from './chunk_store/index.js'
import { loadChunk } from './backupVerifier.mjs'
import logger from '@overleaf/logger'

/**
 * @typedef {(import('@overleaf/object-persistor/src/PerProjectEncryptedS3Persistor.js').CachedPerProjectEncryptedS3Persistor)} CachedPerProjectEncryptedS3Persistor
 */

/**
 * @typedef {(import('archiver').Archiver)} Archiver
 */

/**
 * @typedef {(import('overleaf-editor-core').FileMap)} FileMap
 */

/**
 *
 * @param historyId
 * @return {Promise<CachedPerProjectEncryptedS3Persistor>}
 */
async function getProjectPersistor(historyId) {
  return await backupPersistor.forProjectRO(
    projectBlobsBucket,
    makeProjectKey(historyId, '')
  )
}

/**
 *
 * @param persistor
 * @param {string} key
 * @return {Promise<{chunkData: any, buffer: Buffer}>}
 */
async function loadChunkByKey(persistor, key) {
  try {
    const buf = await streams.gunzipStreamToBuffer(
      await persistor.getObjectStream(chunksBucket, key)
    )
    return { chunkData: JSON.parse(buf.toString('utf-8')), buffer: buf }
  } catch (err) {
    if (err instanceof objectPersistor.Errors.NotFoundError) {
      throw new Chunk.NotPersistedError('chunk not found')
    }
    if (err instanceof Error) {
      throw OError.tag(err, 'Failed to load chunk', { key })
    }
    throw err
  }
}

/**
 *
 * @param {string} historyId
 * @param {string} hash
 * @param {CachedPerProjectEncryptedS3Persistor} persistor
 * @return {Promise<NodeJS.ReadableStream>}
 */
async function fetchBlob(historyId, hash, persistor) {
  const path = makeProjectKey(historyId, hash)
  return await persistor.getObjectStream(projectBlobsBucket, path, {
    autoGunzip: true,
  })
}

/**
 *
 * @param {History} history
 * @param {Archiver} archive
 * @param {CachedPerProjectEncryptedS3Persistor} projectCache
 * @param {string} historyId
 * @param {string} [prefix] Should include trailing slash (if length > 0)
 * @returns {Promise<void>}
 */
async function addChunkToArchive(
  history,
  archive,
  projectCache,
  historyId,
  prefix = ''
) {
  const chunkBlobs = new Set()
  history.findBlobHashes(chunkBlobs)
  const files = getBlobMap(history, chunkBlobs)

  logger.debug({ chunkBlobs, files }, 'Adding blobs to archive')

  for (const chunkBlob of chunkBlobs) {
    if (GLOBAL_BLOBS.has(chunkBlob)) {
      logger.debug('Skipping global blob:', chunkBlob)
      continue
    }
    const blobStream = await fetchBlob(historyId, chunkBlob, projectCache)

    let name = chunkBlob

    if (files.has(chunkBlob)) {
      name = files.get(chunkBlob)
    } else {
      logger.debug('Blob not found in file map:', chunkBlob)
    }

    archive.append(blobStream, {
      name: `${prefix}${name}`,
    })
  }
}

/**
 *
 * @param {string} historyId
 * @return {Promise<number>}
 */
async function findStartVersionOfLatestChunk(historyId) {
  const backend = chunkStore.getBackend(historyId)
  const chunk = await backend.getLatestChunk(historyId, { readOnly: true })
  if (!chunk) {
    throw new Error('Latest chunk could not be loaded')
  }
  return chunk.startVersion
}

/**
 *
 * @param {History} history
 * @param {Set<string>} chunkBlobs
 * @return {Map<string, string>}
 */
function getBlobMap(history, chunkBlobs) {
  const files = new Map()

  history.changes.forEach(change => {
    change.operations.forEach(operation => {
      if (operation.getFile) {
        const file = operation.getFile()
        if (chunkBlobs.has(file.data.hash)) {
          files.set(file.data.hash, operation.pathname)
        }
      }
    })
  })
  return files
}

/**
 * Restore a project from the latest snapshot
 *
 * There is an assumption that the database backup has been restored.
 *
 * @param {Archiver} archive
 * @param {string} historyId
 * @return {Promise<void>}
 */
export async function archiveLatestChunk(archive, historyId) {
  const projectCache = await getProjectPersistor(historyId)

  const startVersion = await findStartVersionOfLatestChunk(historyId)

  const backedUpChunkRaw = await loadChunk(
    historyId,
    startVersion,
    projectCache
  )

  const backedUpChunk = History.fromRaw(backedUpChunkRaw)

  await addChunkToArchive(backedUpChunk, archive, projectCache, historyId)

  return archive
}

/**
 * Download raw files from the backup.
 *
 * This can work without the database being backed up.
 *
 * It will split the project into chunks per directory and download the blobs alongside the chunk.
 *
 * @param {Archiver} archive
 * @param {string} historyId
 * @return {Promise<void>}
 */
export async function archiveRawProject(archive, historyId) {
  const projectCache = await getProjectPersistor(historyId)

  const key = path.join(projectKey.format(historyId), projectKey.pad(0))

  const { contents: chunks } = await projectCache.listDirectory(
    chunksBucket,
    key
  )

  if (chunks.length === 0) {
    throw new Error('No chunks found')
  }

  for (const chunkRecord of chunks) {
    logger.debug({ key: chunkRecord.Key }, 'Processing chunk')
    if (!chunkRecord.Key) {
      continue
    }
    const chunkId = chunkRecord.Key.split('/').pop()
    const { chunkData, buffer } = await loadChunkByKey(
      projectCache,
      chunkRecord.Key
    )

    archive.append(buffer, {
      name: `${historyId}/chunks/${chunkId}/chunk.json`,
    })

    const chunk = History.fromRaw(chunkData)

    await addChunkToArchive(
      chunk,
      archive,
      projectCache,
      historyId,
      `${historyId}/chunks/${chunkId}/`
    )
  }
}
