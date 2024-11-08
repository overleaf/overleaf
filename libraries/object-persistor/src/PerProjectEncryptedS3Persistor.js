// @ts-check
const Crypto = require('crypto')
const Stream = require('stream')
const fs = require('fs')
const { promisify } = require('util')
const { WritableBuffer } = require('@overleaf/stream-utils')
const { S3Persistor, SSECOptions } = require('./S3Persistor.js')
const {
  AlreadyWrittenError,
  NoKEKMatchedError,
  NotFoundError,
  NotImplementedError,
  ReadError,
} = require('./Errors')
const logger = require('@overleaf/logger')

const generateKey = promisify(Crypto.generateKey)

/**
 * @typedef {import('aws-sdk').AWSError} AWSError
 */

/**
 * @typedef {Object} Settings
 * @property {boolean} automaticallyRotateDEKEncryption
 * @property {boolean} ignoreErrorsFromDEKReEncryption
 * @property {(bucketName: string, path: string) => {bucketName: string, path: string}} pathToDataEncryptionKeyPath
 * @property {(bucketName: string, path: string) => boolean} pathIsProjectFolder
 * @property {() => Promise<Array<Buffer>>} getKeyEncryptionKeys
 */

/**
 * Helper function to make TS happy when accessing error properties
 * AWSError is not an actual class, so we cannot use instanceof.
 * @param {any} err
 * @return {err is AWSError}
 */
function isAWSError(err) {
  return !!err
}

/**
 * @param {any} err
 * @return {boolean}
 */
function isForbiddenError(err) {
  if (!err || !(err instanceof ReadError || err instanceof NotFoundError)) {
    return false
  }
  const cause = err.cause
  if (!isAWSError(cause)) return false
  return cause.statusCode === 403
}

class PerProjectEncryptedS3Persistor extends S3Persistor {
  /** @type {Settings} */
  #settings
  /** @type {Promise<Array<SSECOptions>>} */
  #availableKeyEncryptionKeysPromise

  /**
   * @param {Settings} settings
   */
  constructor(settings) {
    super(settings)
    this.#settings = settings
    this.#availableKeyEncryptionKeysPromise = this.#settings
      .getKeyEncryptionKeys()
      .then(keysAsBuffer => {
        if (keysAsBuffer.length === 0) throw new Error('no kek provided')
        return keysAsBuffer.map(buffer => new SSECOptions(buffer))
      })
  }

  async ensureKeyEncryptionKeysLoaded() {
    await this.#availableKeyEncryptionKeysPromise
  }

  async #getCurrentKeyEncryptionKey() {
    const available = await this.#availableKeyEncryptionKeysPromise
    return available[0]
  }

  /**
   * @param {string} bucketName
   * @param {string} path
   */
  async getDataEncryptionKeySize(bucketName, path) {
    const dekPath = this.#settings.pathToDataEncryptionKeyPath(bucketName, path)
    for (const ssecOptions of await this.#availableKeyEncryptionKeysPromise) {
      try {
        return await super.getObjectSize(dekPath.bucketName, dekPath.path, {
          ssecOptions,
        })
      } catch (err) {
        if (isForbiddenError(err)) continue
        throw err
      }
    }
    throw new NoKEKMatchedError('no kek matched')
  }

  /**
   * @param {string} bucketName
   * @param {string} path
   * @return {Promise<CachedPerProjectEncryptedS3Persistor>}
   */
  async forProject(bucketName, path) {
    return new CachedPerProjectEncryptedS3Persistor(
      this,
      await this.#getDataEncryptionKeyOptions(bucketName, path)
    )
  }

  /**
   * @param {string} bucketName
   * @param {string} path
   * @return {Promise<void>}
   */
  async generateDataEncryptionKey(bucketName, path) {
    await this.#generateDataEncryptionKeyOptions(bucketName, path)
  }

  /**
   * @param {string} bucketName
   * @param {string} path
   * @return {Promise<SSECOptions>}
   */
  async #generateDataEncryptionKeyOptions(bucketName, path) {
    const dataEncryptionKey = (
      await generateKey('aes', { length: 256 })
    ).export()
    const dekPath = this.#settings.pathToDataEncryptionKeyPath(bucketName, path)
    await super.sendStream(
      dekPath.bucketName,
      dekPath.path,
      Stream.Readable.from([dataEncryptionKey]),
      {
        // Do not overwrite any objects if already created
        ifNoneMatch: '*',
        ssecOptions: await this.#getCurrentKeyEncryptionKey(),
      }
    )
    return new SSECOptions(dataEncryptionKey)
  }

  /**
   * @param {string} bucketName
   * @param {string} path
   * @return {Promise<SSECOptions>}
   */
  async #getExistingDataEncryptionKeyOptions(bucketName, path) {
    const dekPath = this.#settings.pathToDataEncryptionKeyPath(bucketName, path)
    let res
    let kekIndex = 0
    for (const ssecOptions of await this.#availableKeyEncryptionKeysPromise) {
      try {
        res = await super.getObjectStream(dekPath.bucketName, dekPath.path, {
          ssecOptions,
        })
      } catch (err) {
        if (isForbiddenError(err)) {
          kekIndex++
          continue
        }
        throw err
      }
    }
    if (!res) throw new NoKEKMatchedError('no kek matched')
    const buf = new WritableBuffer()
    await Stream.promises.pipeline(res, buf)

    if (kekIndex !== 0 && this.#settings.automaticallyRotateDEKEncryption) {
      try {
        await super.sendStream(
          dekPath.bucketName,
          dekPath.path,
          Stream.Readable.from([buf.getContents()]),
          { ssecOptions: await this.#getCurrentKeyEncryptionKey() }
        )
      } catch (err) {
        if (this.#settings.ignoreErrorsFromDEKReEncryption) {
          logger.warn({ err, ...dekPath }, 'failed to persist re-encrypted DEK')
        } else {
          throw err
        }
      }
    }

    return new SSECOptions(buf.getContents())
  }

  /**
   * @param {string} bucketName
   * @param {string} path
   * @return {Promise<SSECOptions>}
   */
  async #getDataEncryptionKeyOptions(bucketName, path) {
    try {
      return await this.#getExistingDataEncryptionKeyOptions(bucketName, path)
    } catch (err) {
      if (err instanceof NotFoundError) {
        try {
          return await this.#generateDataEncryptionKeyOptions(bucketName, path)
        } catch (err2) {
          if (err2 instanceof AlreadyWrittenError) {
            // Concurrent initial write
            return await this.#getExistingDataEncryptionKeyOptions(
              bucketName,
              path
            )
          }
          throw err2
        }
      }
      throw err
    }
  }

  async sendStream(bucketName, path, sourceStream, opts = {}) {
    const ssecOptions =
      opts.ssecOptions ||
      (await this.#getDataEncryptionKeyOptions(bucketName, path))
    return await super.sendStream(bucketName, path, sourceStream, {
      ...opts,
      ssecOptions,
    })
  }

  async getObjectStream(bucketName, path, opts = {}) {
    const ssecOptions =
      opts.ssecOptions ||
      (await this.#getExistingDataEncryptionKeyOptions(bucketName, path))
    return await super.getObjectStream(bucketName, path, {
      ...opts,
      ssecOptions,
    })
  }

  async getObjectSize(bucketName, path, opts = {}) {
    const ssecOptions =
      opts.ssecOptions ||
      (await this.#getExistingDataEncryptionKeyOptions(bucketName, path))
    return await super.getObjectSize(bucketName, path, { ...opts, ssecOptions })
  }

  async directorySize(bucketName, path, continuationToken) {
    // Note: Listing a bucket does not require SSE-C credentials.
    return await super.directorySize(bucketName, path, continuationToken)
  }

  async deleteDirectory(bucketName, path, continuationToken) {
    // Note: Listing/Deleting a prefix does not require SSE-C credentials.
    await super.deleteDirectory(bucketName, path, continuationToken)
    if (this.#settings.pathIsProjectFolder(bucketName, path)) {
      const dekPath = this.#settings.pathToDataEncryptionKeyPath(
        bucketName,
        path
      )
      await super.deleteObject(dekPath.bucketName, dekPath.path)
    }
  }

  async getObjectMd5Hash(bucketName, path, opts = {}) {
    // The ETag in object metadata is not the MD5 content hash, skip the HEAD request.
    opts = { ...opts, etagIsNotMD5: true }
    return await super.getObjectMd5Hash(bucketName, path, opts)
  }

  async copyObject(bucketName, sourcePath, destinationPath, opts = {}) {
    const ssecOptions =
      opts.ssecOptions ||
      (await this.#getDataEncryptionKeyOptions(bucketName, destinationPath))
    const ssecSrcOptions =
      opts.ssecSrcOptions ||
      (await this.#getExistingDataEncryptionKeyOptions(bucketName, sourcePath))
    return await super.copyObject(bucketName, sourcePath, destinationPath, {
      ...opts,
      ssecOptions,
      ssecSrcOptions,
    })
  }

  /**
   * @param {string} bucketName
   * @param {string} path
   * @return {Promise<string>}
   */
  async getRedirectUrl(bucketName, path) {
    throw new NotImplementedError('signed links are not supported with SSE-C')
  }
}

/**
 * Helper class for batch updates to avoid repeated fetching of the project path.
 *
 * A general "cache" for project keys is another alternative. For now, use a helper class.
 */
class CachedPerProjectEncryptedS3Persistor {
  /** @type SSECOptions */
  #projectKeyOptions
  /** @type PerProjectEncryptedS3Persistor */
  #parent

  /**
   * @param {PerProjectEncryptedS3Persistor} parent
   * @param {SSECOptions} projectKeyOptions
   */
  constructor(parent, projectKeyOptions) {
    this.#parent = parent
    this.#projectKeyOptions = projectKeyOptions
  }

  /**
   * @param {string} bucketName
   * @param {string} path
   * @param {string} fsPath
   */
  async sendFile(bucketName, path, fsPath) {
    return await this.sendStream(bucketName, path, fs.createReadStream(fsPath))
  }

  /**
   * @param {string} bucketName
   * @param {string} path
   * @param {NodeJS.ReadableStream} sourceStream
   * @param {Object} opts
   * @param {string} [opts.contentType]
   * @param {string} [opts.contentEncoding]
   * @param {'*'} [opts.ifNoneMatch]
   * @param {SSECOptions} [opts.ssecOptions]
   * @param {string} [opts.sourceMd5]
   * @return {Promise<void>}
   */
  async sendStream(bucketName, path, sourceStream, opts = {}) {
    return await this.#parent.sendStream(bucketName, path, sourceStream, {
      ...opts,
      ssecOptions: this.#projectKeyOptions,
    })
  }

  /**
   * @param {string} bucketName
   * @param {string} path
   * @param {Object} opts
   * @param {number} [opts.start]
   * @param {number} [opts.end]
   * @param {string} [opts.contentEncoding]
   * @param {SSECOptions} [opts.ssecOptions]
   * @return {Promise<NodeJS.ReadableStream>}
   */
  async getObjectStream(bucketName, path, opts = {}) {
    return await this.#parent.getObjectStream(bucketName, path, {
      ...opts,
      ssecOptions: this.#projectKeyOptions,
    })
  }
}

module.exports = PerProjectEncryptedS3Persistor
