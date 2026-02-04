// @ts-check
import path from 'node:path'
import projectKey from '@overleaf/object-persistor/src/ProjectKey.js'
import {
  chunksBucket,
  backupPersistor,
  projectBlobsBucket,
  globalBlobsBucket as backupGlobalBlobsBucket,
} from './backupPersistor.mjs'
import core, { Chunk, History } from 'overleaf-editor-core'
import {
  GLOBAL_BLOBS,
  makeProjectKey,
  getStringLengthOfFile,
  makeGlobalKey,
} from './blob_store/index.js'
import streams from './streams.js'
import objectPersistor from '@overleaf/object-persistor'
import OError from '@overleaf/o-error'
import chunkStore from './chunk_store/index.js'
import logger from '@overleaf/logger'
import fs from 'node:fs'
import { pipeline } from 'node:stream/promises'
import withTmpDir from '../../api/controllers/with_tmp_dir.js'
import { loadChunk } from './backupVerifier.mjs'
import globalBlobPersistor from './persistor.js'
import config from 'config'
import { NoKEKMatchedError } from '@overleaf/object-persistor/src/Errors.js'

const globalBlobsBucket = config.get('blobStore.globalBucket')

class BackupBlobStore {
  /**
   *
   * @param {string} historyId
   * @param {string} tmp
   * @param {CachedPerProjectEncryptedS3Persistor} persistor
   * @param {boolean} useBackupGlobalBlobs
   */
  constructor(historyId, tmp, persistor, useBackupGlobalBlobs) {
    this.historyId = historyId
    this.tmp = tmp
    this.blobs = new Map()
    this.persistor = persistor
    this.useBackupGlobalBlobs = useBackupGlobalBlobs
  }

  /**
   * Required for BlobStore interface - not supported.
   *
   * @template T
   * @param {string} hash
   * @return {Promise<T>}
   */
  async getObject(hash) {
    try {
      const stream = await this.getStream(hash)
      const buffer = await streams.readStreamToBuffer(stream)
      return JSON.parse(buffer.toString())
    } catch (err) {
      logger.warn({ err, hash }, 'Failed to fetch chunk blob')
      throw err
    }
  }

  /**
   *
   * @param {Set<string>} hashes
   * @return {Promise<void>}
   */
  async fetchBlobs(hashes) {
    for await (const hash of hashes) {
      if (this.blobs.has(hash)) return
      const path = `${this.tmp}/${hash}`
      /** @type {core.Blob} */
      let blob
      /** @type {NodeJS.ReadableStream} */
      let blobStream
      if (GLOBAL_BLOBS.has(hash)) {
        try {
          const blobData = await this.fetchGlobalBlob(hash)
          await pipeline(blobData.stream, fs.createWriteStream(path))
          blob = blobData.blob
        } catch (err) {
          logger.warn({ hash, err }, 'Failed to fetch global blob')
          continue
        }
      } else {
        try {
          blobStream = await fetchBlob(this.historyId, hash, this.persistor)
          await pipeline(blobStream, fs.createWriteStream(path))
          blob = await this.makeBlob(hash, path)
        } catch (err) {
          logger.warn({ err, hash }, 'Failed to fetch chunk blob')
          continue
        }
      }

      this.blobs.set(hash, blob)
    }
  }

  /**
   *
   * @param {string} hash
   * @return {Promise<{ blob: core.Blob, stream: NodeJS.ReadableStream }>}
   */
  async fetchGlobalBlob(hash) {
    const globalBlob = GLOBAL_BLOBS.get(hash)
    if (!globalBlob) {
      throw new Error('blob does not exist or is not a global blob')
    }
    let stream

    const key = makeGlobalKey(hash)

    if (this.useBackupGlobalBlobs) {
      stream = await this.persistor.getObjectStream(
        backupGlobalBlobsBucket,
        key
      )
    } else {
      stream = await globalBlobPersistor.getObjectStream(globalBlobsBucket, key)
    }
    return { blob: globalBlob.blob, stream }
  }

  /**
   *
   * @param {string} hash
   * @param {string} pathname
   * @return {Promise<core.Blob>}
   */
  async makeBlob(hash, pathname) {
    const stat = await fs.promises.stat(pathname)
    const byteLength = stat.size
    const stringLength = await getStringLengthOfFile(byteLength, pathname)
    if (stringLength) {
      return new core.Blob(hash, byteLength, stringLength)
    }
    return new core.Blob(hash, byteLength)
  }

  /**
   *
   * @param {string} hash
   * @return {Promise<string>}
   */
  async getString(hash) {
    const stream = await this.getStream(hash)
    const buffer = await streams.readStreamToBuffer(stream)
    return buffer.toString()
  }

  /**
   *
   * @param {string} hash
   * @return {Promise<fs.ReadStream>}
   */
  async getStream(hash) {
    return fs.createReadStream(this.getBlobPathname(hash))
  }

  /**
   *
   * @param {string} hash
   * @return {Promise<core.Blob>}
   */
  async getBlob(hash) {
    return this.blobs.get(hash)
  }

  /**
   *
   * @param {string} hash
   * @return {string}
   */
  getBlobPathname(hash) {
    return path.join(this.tmp, hash)
  }
}

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
  try {
    return await backupPersistor.forProjectRO(
      projectBlobsBucket,
      makeProjectKey(historyId, '')
    )
  } catch (error) {
    if (error instanceof NoKEKMatchedError) {
      logger.info({}, 'no kek matched')
    }
    throw new BackupPersistorError(
      'Failed to get project persistor',
      { historyId },
      error instanceof Error ? error : undefined
    )
  }
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
 * @typedef {object} AddChunkOptions
 * @property {string} [prefix] Should include trailing slash (if length > 0)
 * @property {boolean} [useBackupGlobalBlobs]
 */

/**
 *
 * @param {History} history
 * @param {Archiver} archive
 * @param {CachedPerProjectEncryptedS3Persistor} projectCache
 * @param {string} historyId
 * @param {AddChunkOptions} [options]
 * @returns {Promise<void>}
 */
async function addChunkToArchive(
  history,
  archive,
  projectCache,
  historyId,
  { prefix = '', useBackupGlobalBlobs = false } = {}
) {
  const chunkBlobs = new Set()
  history.findBlobHashes(chunkBlobs)

  await withTmpDir('recovery-blob-', async tmpDir => {
    const blobStore = new BackupBlobStore(
      historyId,
      tmpDir,
      projectCache,
      useBackupGlobalBlobs
    )
    await blobStore.fetchBlobs(chunkBlobs)

    await history.loadFiles('lazy', blobStore)

    const snapshot = history.getSnapshot()
    snapshot.applyAll(history.getChanges())

    const filePaths = snapshot.getFilePathnames()

    if (filePaths.length === 0) {
      logger.warn(
        { historyId, projectVersion: snapshot.projectVersion },
        'No files found in snapshot backup'
      )
    }
    for (const filePath of filePaths) {
      /** @type {core.File | null | undefined} */
      const file = snapshot.getFile(filePath)
      if (!file) {
        logger.error({ filePath }, 'File not found in snapshot')
        continue
      }

      try {
        await file.load('eager', blobStore)
      } catch (err) {
        logger.error(
          { filePath, err },
          'Failed to load file from snapshot, skipping'
        )
        continue
      }

      const hash = file.getHash()

      /** @type {string | fs.ReadStream | null | undefined} */
      let content = file.getContent({ filterTrackedDeletes: true })

      if (content === null) {
        if (!hash) {
          logger.error({ filePath }, 'File does not have a hash')
          continue
        }
        const blob = await blobStore.getBlob(hash)
        if (!blob) {
          logger.error({ filePath }, 'Blob not found in blob store')
          continue
        }
        content = await blobStore.getStream(hash)
      }
      archive.append(content, {
        name: `${prefix}${filePath}`,
      })
    }
  })
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
 * Restore a project from the latest snapshot
 *
 * There is an assumption that the database backup has been restored.
 *
 * @param {Archiver} archive
 * @param {string} historyId
 * @param {boolean} [useBackupGlobalBlobs]
 * @return {Promise<void>}
 */
export async function archiveLatestChunk(
  archive,
  historyId,
  useBackupGlobalBlobs = false
) {
  logger.info({ historyId, useBackupGlobalBlobs }, 'Archiving latest chunk')

  const projectCache = await getProjectPersistor(historyId)

  const startVersion = await findStartVersionOfLatestChunk(historyId)

  const backedUpChunkRaw = await loadChunk(
    historyId,
    startVersion,
    projectCache
  )

  const backedUpChunk = History.fromRaw(backedUpChunkRaw)

  await addChunkToArchive(backedUpChunk, archive, projectCache, historyId, {
    useBackupGlobalBlobs,
  })

  return archive
}

/**
 * Fetches all raw blobs from the project and adds them to the archive.
 *
 * @param {string} historyId
 * @param {Archiver} archive
 * @param {CachedPerProjectEncryptedS3Persistor} projectCache
 * @return {Promise<void>}
 */
async function addRawBlobsToArchive(historyId, archive, projectCache) {
  const blobKeys = await projectCache.listDirectoryKeys(
    projectBlobsBucket,
    projectKey.format(historyId)
  )
  for (const key of blobKeys) {
    try {
      const stream = await projectCache.getObjectStream(
        projectBlobsBucket,
        key,
        { autoGunzip: true }
      )
      archive.append(stream, {
        name: path.join(historyId, 'blobs', key),
      })
    } catch (err) {
      logger.warn({ err, path: key }, 'Failed to append blob to archive')
    }
  }
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
 * @param {boolean} [useBackupGlobalBlobs]
 * @return {Promise<void>}
 */
export async function archiveRawProject(
  archive,
  historyId,
  useBackupGlobalBlobs = false
) {
  const projectCache = await getProjectPersistor(historyId)

  const chunkKeys = await projectCache.listDirectoryKeys(
    chunksBucket,
    projectKey.format(historyId)
  )

  if (chunkKeys.length === 0) {
    throw new Error('No chunks found')
  }

  for (const key of chunkKeys) {
    const chunkId = key.split('/').pop()
    logger.debug({ chunkId, key }, 'Processing chunk')

    const { buffer } = await loadChunkByKey(projectCache, key)

    archive.append(buffer, {
      name: `${historyId}/chunks/${chunkId}/chunk.json`,
    })
  }
  await addRawBlobsToArchive(historyId, archive, projectCache)
}

export class BackupPersistorError extends OError {}
