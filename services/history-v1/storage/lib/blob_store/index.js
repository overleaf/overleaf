'use strict'

const config = require('config')
const fs = require('fs')
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
const projectKey = require('../project_key')
const streams = require('../streams')
const postgresBackend = require('./postgres')
const mongoBackend = require('./mongo')

const GLOBAL_BLOBS = new Map()

function makeGlobalKey(hash) {
  return `${hash.slice(0, 2)}/${hash.slice(2, 4)}/${hash.slice(4)}`
}

function makeProjectKey(projectId, hash) {
  return `${projectKey.format(projectId)}/${hash.slice(0, 2)}/${hash.slice(2)}`
}

async function uploadBlob(projectId, blob, stream) {
  const bucket = config.get('blobStore.projectBucket')
  const key = makeProjectKey(projectId, blob.getHash())
  await persistor.sendStream(bucket, key, stream, {
    contentType: 'application/octet-stream',
  })
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
  async function getByteLengthOfFile() {
    const stat = await fs.promises.stat(pathname)
    return stat.size
  }

  async function getHashOfFile(blob) {
    const stream = fs.createReadStream(pathname)
    const hash = await blobHash.fromStream(blob.getByteLength(), stream)
    return hash
  }

  const blob = new Blob()
  const byteLength = await getByteLengthOfFile()
  blob.setByteLength(byteLength)
  const hash = await getHashOfFile(blob)
  blob.setHash(hash)
  return blob
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
  await persistor.deleteDirectory(bucket, prefix)
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
   * @return {Promise.<Blob>}
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
   * @return {Promise.<Blob>}
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
    await uploadBlob(this.projectId, newBlob, fs.createReadStream(pathname))
    await this.backend.insertBlob(this.projectId, newBlob)
    return newBlob
  }

  /**
   * Fetch a blob's content by its hash as a UTF-8 encoded string.
   *
   * @param {string} hash hexadecimal SHA-1 hash
   * @return {Promise.<string>} promise for the content of the file
   */
  async getString(hash) {
    assert.blobHash(hash, 'bad hash')

    const stream = await this.getStream(hash)
    const buffer = await streams.readStreamToBuffer(stream)
    return buffer.toString()
  }

  /**
   * Fetch a blob by its hash as a stream.
   *
   * Note that, according to the AWS SDK docs, this does not retry after initial
   * failure, so the caller must be prepared to retry on errors, if appropriate.
   *
   * @param {string} hash hexadecimal SHA-1 hash
   * @return {stream} a stream to read the file
   */
  async getStream(hash) {
    assert.blobHash(hash, 'bad hash')

    const { bucket, key } = getBlobLocation(this.projectId, hash)
    try {
      const stream = await persistor.getObjectStream(bucket, key)
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
   * @return {Promise.<Blob?>}
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
    const projectBlobs = await this.backend.findBlobs(
      this.projectId,
      nonGlobalHashes
    )
    blobs.push(...projectBlobs)
    return blobs
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
}

module.exports = { BlobStore, loadGlobalBlobs }
