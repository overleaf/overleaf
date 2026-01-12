// @ts-check
'use strict'

const core = require('overleaf-editor-core')

const config = require('config')
const path = require('node:path')
const Stream = require('node:stream')
const { promisify } = require('node:util')
const zlib = require('node:zlib')

const OError = require('@overleaf/o-error')
const objectPersistor = require('@overleaf/object-persistor')
const logger = require('@overleaf/logger')

const assert = require('./assert')
const persistor = require('./persistor')
const projectKey = require('@overleaf/object-persistor/src/ProjectKey.js')
const streams = require('./streams')

const Chunk = core.Chunk

const gzip = promisify(zlib.gzip)
const gunzip = promisify(zlib.gunzip)

class LoadError extends OError {
  /**
   * @param {string} projectId
   * @param {string} chunkId
   * @param {any} cause
   */
  constructor(projectId, chunkId, cause) {
    super(
      'HistoryStore: failed to load chunk history',
      { projectId, chunkId },
      cause
    )
    this.projectId = projectId
    this.chunkId = chunkId
  }
}

class StoreError extends OError {
  /**
   * @param {string} projectId
   * @param {string} chunkId
   * @param {any} cause
   */
  constructor(projectId, chunkId, cause) {
    super(
      'HistoryStore: failed to store chunk history',
      { projectId, chunkId },
      cause
    )
    this.projectId = projectId
    this.chunkId = chunkId
  }
}

/**
 * @param {string} projectId
 * @param {string} chunkId
 * @return {string}
 */
function getKey(projectId, chunkId) {
  return path.join(projectKey.format(projectId), projectKey.pad(chunkId))
}

/**
 * Store and retreive raw {@link History} objects from bucket. Mainly used via the
 * {@link ChunkStore}.
 *
 * Histories are stored as gzipped JSON blobs, keyed on the project ID and the
 * ID of the Chunk that owns the history. The project ID is currently redundant,
 * but I think it might help in future if we have to shard on project ID, and
 * it gives us some chance of reconstructing histories even if there is a
 * problem with the chunk metadata in the database.
 *
 * @class
 */
class HistoryStore {
  #persistor
  #bucket
  constructor(persistor, bucket) {
    this.#persistor = persistor
    this.#bucket = bucket
  }

  /**
   * Load the raw object for a History.
   *
   * @param {string} projectId
   * @param {string} chunkId
   * @return {Promise<import('overleaf-editor-core/lib/types').RawHistory>}
   */
  async loadRaw(projectId, chunkId) {
    assert.projectId(projectId, 'bad projectId')
    assert.chunkId(chunkId, 'bad chunkId')

    const key = getKey(projectId, chunkId)

    logger.debug({ projectId, chunkId }, 'loadRaw started')
    try {
      const buf = await streams.gunzipStreamToBuffer(
        await this.#persistor.getObjectStream(this.#bucket, key)
      )
      return JSON.parse(buf.toString('utf-8'))
    } catch (err) {
      if (err instanceof objectPersistor.Errors.NotFoundError) {
        throw new Chunk.NotPersistedError(projectId)
      }
      throw new LoadError(projectId, chunkId, err)
    } finally {
      logger.debug({ projectId, chunkId }, 'loadRaw finished')
    }
  }

  async loadRawWithBuffer(projectId, chunkId) {
    assert.projectId(projectId, 'bad projectId')
    assert.chunkId(chunkId, 'bad chunkId')

    const key = getKey(projectId, chunkId)

    logger.debug({ projectId, chunkId }, 'loadBuffer started')
    try {
      const buf = await streams.readStreamToBuffer(
        await this.#persistor.getObjectStream(this.#bucket, key)
      )
      const unzipped = await gunzip(buf)
      return {
        buffer: buf,
        raw: JSON.parse(unzipped.toString('utf-8')),
      }
    } catch (err) {
      if (err instanceof objectPersistor.Errors.NotFoundError) {
        throw new Chunk.NotPersistedError(projectId)
      }
      throw new LoadError(projectId, chunkId, err)
    } finally {
      logger.debug({ projectId, chunkId }, 'loadBuffer finished')
    }
  }

  /**
   * Compress and store a {@link History}.
   *
   * @param {string} projectId
   * @param {string} chunkId
   * @param {import('overleaf-editor-core/lib/types').RawHistory} rawHistory
   */
  async storeRaw(projectId, chunkId, rawHistory) {
    assert.projectId(projectId, 'bad projectId')
    assert.chunkId(chunkId, 'bad chunkId')
    assert.object(rawHistory, 'bad rawHistory')

    const key = getKey(projectId, chunkId)

    logger.debug({ projectId, chunkId }, 'storeRaw started')

    const buf = await gzip(JSON.stringify(rawHistory))
    try {
      await this.#persistor.sendStream(
        this.#bucket,
        key,
        Stream.Readable.from([buf]),
        {
          contentType: 'application/json',
          contentEncoding: 'gzip',
          contentLength: buf.byteLength,
        }
      )
    } catch (err) {
      throw new StoreError(projectId, chunkId, err)
    } finally {
      logger.debug({ projectId, chunkId }, 'storeRaw finished')
    }
  }

  /**
   * Delete multiple chunks from bucket. Expects an Array of objects with
   * projectId and chunkId properties
   * @param {Array<{projectId: string,chunkId:string}>} chunks
   */
  async deleteChunks(chunks) {
    logger.debug({ chunks }, 'deleteChunks started')
    try {
      await Promise.all(
        chunks.map(chunk => {
          const key = getKey(chunk.projectId, chunk.chunkId)
          return this.#persistor.deleteObject(this.#bucket, key)
        })
      )
    } finally {
      logger.debug({ chunks }, 'deleteChunks finished')
    }
  }
}

module.exports = {
  HistoryStore,
  historyStore: new HistoryStore(persistor, config.get('chunkStore.bucket')),
}
