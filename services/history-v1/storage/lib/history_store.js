'use strict'

const BPromise = require('bluebird')
const core = require('overleaf-editor-core')

const config = require('config')
const path = require('path')

const OError = require('@overleaf/o-error')
const objectPersistor = require('@overleaf/object-persistor')

const assert = require('./assert')
const persistor = require('./persistor')
const projectKey = require('./project_key')
const streams = require('./streams')

const Chunk = core.Chunk

const BUCKET = config.get('chunkStore.bucket')

class LoadError extends OError {
  constructor(projectId, chunkId) {
    super('HistoryStore: failed to load chunk history', { projectId, chunkId })
    this.projectId = projectId
    this.chunkId = chunkId
  }
}
HistoryStore.LoadError = LoadError

class StoreError extends OError {
  constructor(projectId, chunkId) {
    super('HistoryStore: failed to store chunk history', { projectId, chunkId })
    this.projectId = projectId
    this.chunkId = chunkId
  }
}
HistoryStore.StoreError = StoreError

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
function HistoryStore() {}

/**
 * Load the raw object for a History.
 *
 * @param {number} projectId
 * @param {number} chunkId
 * @return {Promise.<Object>}
 */
HistoryStore.prototype.loadRaw = function historyStoreLoadRaw(
  projectId,
  chunkId
) {
  assert.projectId(projectId, 'bad projectId')
  assert.chunkId(chunkId, 'bad chunkId')

  const key = getKey(projectId, chunkId)

  return BPromise.resolve()
    .then(() => persistor.getObjectStream(BUCKET, key))
    .then(streams.gunzipStreamToBuffer)
    .then(buffer => JSON.parse(buffer))
    .catch(err => {
      if (err instanceof objectPersistor.Errors.NotFoundError) {
        throw new Chunk.NotPersistedError(projectId)
      }
      throw new HistoryStore.LoadError(projectId, chunkId).withCause(err)
    })
}

/**
 * Compress and store a {@link History}.
 *
 * @param {number} projectId
 * @param {number} chunkId
 * @param {Object} rawHistory
 * @return {Promise}
 */
HistoryStore.prototype.storeRaw = function historyStoreStoreRaw(
  projectId,
  chunkId,
  rawHistory
) {
  assert.projectId(projectId, 'bad projectId')
  assert.chunkId(chunkId, 'bad chunkId')
  assert.object(rawHistory, 'bad rawHistory')

  const key = getKey(projectId, chunkId)
  const stream = streams.gzipStringToStream(JSON.stringify(rawHistory))

  return BPromise.resolve()
    .then(() =>
      persistor.sendStream(BUCKET, key, stream, {
        contentType: 'application/json',
        contentEncoding: 'gzip',
      })
    )
    .catch(err => {
      throw new HistoryStore.StoreError(projectId, chunkId).withCause(err)
    })
}

/**
 * Delete multiple chunks from bucket. Expects an Array of objects with
 * projectId and chunkId properties
 * @param {Array} chunks
 * @return {Promise}
 */
HistoryStore.prototype.deleteChunks = function historyDeleteChunks(chunks) {
  return BPromise.all(
    chunks.map(chunk => {
      const key = getKey(chunk.projectId, chunk.chunkId)
      return persistor.deleteObject(BUCKET, key)
    })
  )
}

module.exports = new HistoryStore()
