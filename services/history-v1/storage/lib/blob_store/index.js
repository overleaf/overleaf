'use strict'

const config = require('config')
const fs = require('node:fs')
const isValidUtf8 = require('utf-8-validate')
const { ReadableString } = require('@overleaf/stream-utils')

const core = require('overleaf-editor-core')
const objectPersistor = require('@overleaf/object-persistor')
const OError = require('@overleaf/o-error')
const Blob = core.Blob
const TextOperation = core.TextOperation
const containsNonBmpChars = core.util.containsNonBmpChars

const assert = require('../assert')
const blobHash = require('../blob_hash')
const mongodb = require('../mongodb')
const persistor = require('../persistor')
const projectKey = require('@overleaf/object-persistor/src/ProjectKey.js')
const streams = require('../streams')
const postgresBackend = require('./postgres')
const mongoBackend = require('./mongo')
const logger = require('@overleaf/logger')

/** @import { Readable } from 'stream' */

/** @type {Map<string, { blob: core.Blob, demoted: boolean}>} */
const GLOBAL_BLOBS = new Map()

function makeGlobalKey(hash) {
  return `${hash.slice(0, 2)}/${hash.slice(2, 4)}/${hash.slice(4)}`
}

function makeProjectKey(projectId, hash) {
  return `${projectKey.format(projectId)}/${hash.slice(0, 2)}/${hash.slice(2)}`
}

async function uploadBlob(projectId, blob, stream, opts = {}) {
  const bucket = config.get('blobStore.projectBucket')
  const key = makeProjectKey(projectId, blob.getHash())
  logger.debug({ projectId, blob }, 'uploadBlob started')
  try {
    await persistor.sendStream(bucket, key, stream, {
      contentType: 'application/octet-stream',
      ...opts,
    })
  } finally {
    logger.debug({ projectId, blob }, 'uploadBlob finished')
  }
}

function getBlobLocation(projectId, hash) {
  if (GLOBAL_BLOBS.has(hash)) {
    return {
      bucket: config.get('blobStore.globalBucket'),
      key: makeGlobalKey(hash),
    }
  } else {
    return {
      bucket: config.get('blobStore.projectBucket'),
      key: makeProjectKey(projectId, hash),
    }
  }
}

/**
 * Returns the appropriate backend for the given project id
 *
 * Numeric ids use the Postgres backend.
 * Strings of 24 characters use the Mongo backend.
 */
function getBackend(projectId) {
  if (assert.POSTGRES_ID_REGEXP.test(projectId)) {
    return postgresBackend
  } else if (assert.MONGO_ID_REGEXP.test(projectId)) {
    return mongoBackend
  } else {
    throw new OError('bad project id', { projectId })
  }
}

async function makeBlobForFile(pathname) {
  const { size: byteLength } = await fs.promises.stat(pathname)
  const hash = await blobHash.fromStream(
    byteLength,
    fs.createReadStream(pathname)
  )
  return new Blob(hash, byteLength)
}

async function getStringLengthOfFile(byteLength, pathname) {
  // We have to read the file into memory to get its UTF-8 length, so don't
  // bother for files that are too large for us to edit anyway.
  if (byteLength > Blob.MAX_EDITABLE_BYTE_LENGTH_BOUND) {
    return null
  }

  // We need to check if the file contains nonBmp or null characters
  let data = await fs.promises.readFile(pathname)
  if (!isValidUtf8(data)) return null
  data = data.toString()
  if (data.length > TextOperation.MAX_STRING_LENGTH) return null
  if (containsNonBmpChars(data)) return null
  if (data.indexOf('\x00') !== -1) return null
  return data.length
}

async function deleteBlobsInBucket(projectId) {
  const bucket = config.get('blobStore.projectBucket')
  const prefix = `${projectKey.format(projectId)}/`
  logger.debug({ projectId }, 'deleteBlobsInBucket started')
  try {
    await persistor.deleteDirectory(bucket, prefix)
  } finally {
    logger.debug({ projectId }, 'deleteBlobsInBucket finished')
  }
}

async function loadGlobalBlobs() {
  const blobs = await mongodb.globalBlobs.find()
  for await (const blob of blobs) {
    GLOBAL_BLOBS.set(blob._id, {
      blob: new Blob(blob._id, blob.byteLength, blob.stringLength),
      demoted: Boolean(blob.demoted),
    })
  }
}

/**
 * Return metadata for all blobs in the given project
 * @param {Array<string|number>} projectIds
 * @return {Promise<{nBlobs:number, blobs:Map<string,Array<core.Blob>>}>}
 */
async function getProjectBlobsBatch(projectIds) {
  const mongoProjects = []
  const postgresProjects = []
  for (const projectId of projectIds) {
    if (typeof projectId === 'number') {
      postgresProjects.push(projectId)
    } else {
      mongoProjects.push(projectId)
    }
  }
  const [
    { nBlobs: nBlobsPostgres, blobs: blobsPostgres },
    { nBlobs: nBlobsMongo, blobs: blobsMongo },
  ] = await Promise.all([
    postgresBackend.getProjectBlobsBatch(postgresProjects),
    mongoBackend.getProjectBlobsBatch(mongoProjects),
  ])
  for (const [id, blobs] of blobsPostgres.entries()) {
    blobsMongo.set(id.toString(), blobs)
  }
  return { nBlobs: nBlobsPostgres + nBlobsMongo, blobs: blobsMongo }
}

/**
 * @classdesc
 * Fetch and store the content of files using content-addressable hashing. The
 * blob store manages both content and metadata (byte and UTF-8 length) for
 * blobs.
 */
class BlobStore {
  /**
   * @constructor
   * @param {string} projectId the project for which we'd like to find blobs
   */
  constructor(projectId) {
    assert.projectId(projectId)
    this.projectId = projectId
    this.backend = getBackend(this.projectId)
  }

  /**
   * Set up the initial data structure for a given project
   */
  async initialize() {
    await this.backend.initialize(this.projectId)
  }

  /**
   * Write a blob, if one does not already exist, with the given UTF-8 encoded
   * string content.
   *
   * @param {string} string
   * @return {Promise.<core.Blob>}
   */
  async putString(string) {
    assert.string(string, 'bad string')
    const hash = blobHash.fromString(string)

    const existingBlob = await this._findBlobBeforeInsert(hash)
    if (existingBlob != null) {
      return existingBlob
    }
    const newBlob = new Blob(hash, Buffer.byteLength(string), string.length)
    // Note: the ReadableString is to work around a bug in the AWS SDK: it won't
    // allow Body to be blank.
    await uploadBlob(this.projectId, newBlob, new ReadableString(string))
    await this.backend.insertBlob(this.projectId, newBlob)
    return newBlob
  }

  /**
   * Write a blob, if one does not already exist, with the given file (usually a
   * temporary file).
   *
   * @param {string} pathname
   * @return {Promise<core.Blob>}
   */
  async putFile(pathname) {
    assert.string(pathname, 'bad pathname')
    const newBlob = await makeBlobForFile(pathname)
    const existingBlob = await this._findBlobBeforeInsert(newBlob.getHash())
    if (existingBlob != null) {
      return existingBlob
    }
    const stringLength = await getStringLengthOfFile(
      newBlob.getByteLength(),
      pathname
    )
    newBlob.setStringLength(stringLength)
    await this.putBlob(pathname, newBlob)
    return newBlob
  }

  /**
   * Write a new blob, the stringLength must have been added already. It should
   * have been checked that the blob does not exist yet. Consider using
   * {@link putFile} instead of this lower-level method.
   *
   * @param {string} pathname
   * @param {core.Blob} finializedBlob
   * @return {Promise<void>}
   */
  async putBlob(pathname, finializedBlob) {
    await uploadBlob(
      this.projectId,
      finializedBlob,
      fs.createReadStream(pathname)
    )
    await this.backend.insertBlob(this.projectId, finializedBlob)
  }

  /**
   * Stores an object as a JSON string in a blob.
   *
   * @param {object} obj
   * @returns {Promise.<core.Blob>}
   */
  async putObject(obj) {
    assert.object(obj, 'bad object')
    const string = JSON.stringify(obj)
    return await this.putString(string)
  }

  /**
   *
   * Fetch a blob's content by its hash as a UTF-8 encoded string.
   *
   * @param {string} hash hexadecimal SHA-1 hash
   * @return {Promise.<string>} promise for the content of the file
   */
  async getString(hash) {
    assert.blobHash(hash, 'bad hash')

    const projectId = this.projectId
    logger.debug({ projectId, hash }, 'getString started')
    try {
      const stream = await this.getStream(hash)
      const buffer = await streams.readStreamToBuffer(stream)
      return buffer.toString()
    } finally {
      logger.debug({ projectId, hash }, 'getString finished')
    }
  }

  /**
   * Fetch a JSON encoded blob by its hash and deserialize it.
   *
   * @template [T=unknown]
   * @param {string} hash hexadecimal SHA-1 hash
   * @return {Promise.<T>} promise for the content of the file
   */
  async getObject(hash) {
    assert.blobHash(hash, 'bad hash')
    const projectId = this.projectId
    logger.debug({ projectId, hash }, 'getObject started')
    try {
      const jsonString = await this.getString(hash)
      const object = JSON.parse(jsonString)
      return object
    } catch (error) {
      // Maybe this is blob is gzipped. Try to gunzip it.
      // TODO: Remove once we've ensured this is not reached
      const stream = await this.getStream(hash)
      const buffer = await streams.gunzipStreamToBuffer(stream)
      const object = JSON.parse(buffer.toString())
      logger.warn('getObject: Gzipped object in BlobStore')
      return object
    } finally {
      logger.debug({ projectId, hash }, 'getObject finished')
    }
  }

  /**
   * Fetch a blob by its hash as a stream.
   *
   * Note that, according to the AWS SDK docs, this does not retry after initial
   * failure, so the caller must be prepared to retry on errors, if appropriate.
   *
   * @param {string} hash hexadecimal SHA-1 hash
   * @param {Object} opts
   * @return {Promise.<Readable>} a stream to read the file
   */
  async getStream(hash, opts = {}) {
    assert.blobHash(hash, 'bad hash')

    const { bucket, key } = getBlobLocation(this.projectId, hash)
    try {
      const stream = await persistor.getObjectStream(bucket, key, opts)
      return stream
    } catch (err) {
      if (err instanceof objectPersistor.Errors.NotFoundError) {
        throw new Blob.NotFoundError(hash)
      }
      throw err
    }
  }

  /**
   * Read a blob metadata record by hexadecimal hash.
   *
   * @param {string} hash hexadecimal SHA-1 hash
   * @return {Promise<core.Blob | null>}
   */
  async getBlob(hash) {
    assert.blobHash(hash, 'bad hash')
    const globalBlob = GLOBAL_BLOBS.get(hash)
    if (globalBlob != null) {
      return globalBlob.blob
    }
    const blob = await this.backend.findBlob(this.projectId, hash)
    return blob
  }

  /**
   *
   * @param {Array<string>} hashes
   * @return {Promise<*[]>}
   */
  async getBlobs(hashes) {
    assert.array(hashes, 'bad hashes')
    const nonGlobalHashes = []
    const blobs = []
    for (const hash of hashes) {
      const globalBlob = GLOBAL_BLOBS.get(hash)
      if (globalBlob != null) {
        blobs.push(globalBlob.blob)
      } else {
        nonGlobalHashes.push(hash)
      }
    }
    if (nonGlobalHashes.length === 0) {
      return blobs // to avoid unnecessary database lookup
    }
    const projectBlobs = await this.backend.findBlobs(
      this.projectId,
      nonGlobalHashes
    )
    blobs.push(...projectBlobs)
    return blobs
  }

  /**
   * Retrieve all blobs associated with the project.
   * @returns {Promise<core.Blob[]>} A promise that resolves to an array of blobs.
   */

  async getProjectBlobs() {
    const projectBlobs = await this.backend.getProjectBlobs(this.projectId)
    return projectBlobs
  }

  /**
   * Delete all blobs that belong to the project.
   */
  async deleteBlobs() {
    await Promise.all([
      this.backend.deleteBlobs(this.projectId),
      deleteBlobsInBucket(this.projectId),
    ])
  }

  async _findBlobBeforeInsert(hash) {
    const globalBlob = GLOBAL_BLOBS.get(hash)
    if (globalBlob != null && !globalBlob.demoted) {
      return globalBlob.blob
    }
    const blob = await this.backend.findBlob(this.projectId, hash)
    return blob
  }

  /**
   * Copy an existing sourceBlob in this project to a target project.
   * @param {Blob} sourceBlob
   * @param {string} targetProjectId
   * @return {Promise<void>}
   */
  async copyBlob(sourceBlob, targetProjectId) {
    assert.instance(sourceBlob, Blob, 'bad sourceBlob')
    assert.projectId(targetProjectId, 'bad targetProjectId')
    const hash = sourceBlob.getHash()
    const sourceProjectId = this.projectId
    const { bucket, key: sourceKey } = getBlobLocation(sourceProjectId, hash)
    const destKey = makeProjectKey(targetProjectId, hash)
    const targetBackend = getBackend(targetProjectId)
    logger.debug({ sourceProjectId, targetProjectId, hash }, 'copyBlob started')
    try {
      await persistor.copyObject(bucket, sourceKey, destKey)
      await targetBackend.insertBlob(targetProjectId, sourceBlob)
    } finally {
      logger.debug(
        { sourceProjectId, targetProjectId, hash },
        'copyBlob finished'
      )
    }
  }
}

module.exports = {
  BlobStore,
  getProjectBlobsBatch,
  loadGlobalBlobs,
  makeProjectKey,
  makeGlobalKey,
  makeBlobForFile,
  getStringLengthOfFile,
  GLOBAL_BLOBS,
}
