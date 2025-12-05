// @ts-check
const Crypto = require('node:crypto')
const Stream = require('node:stream')
const fs = require('node:fs')
const { promisify } = require('node:util')
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
const Path = require('node:path')

const generateKey = promisify(Crypto.generateKey)
const hkdf = promisify(Crypto.hkdf)

const AES256_KEY_LENGTH = 32

/**
 * @typedef {Object} Settings
 * @property {boolean} automaticallyRotateDEKEncryption
 * @property {string} dataEncryptionKeyBucketName
 * @property {boolean} ignoreErrorsFromDEKReEncryption
 * @property {(bucketName: string, path: string) => string} pathToProjectFolder
 * @property {() => Promise<Array<RootKeyEncryptionKey>>} getRootKeyEncryptionKeys
 */

/**
 * @typedef {import('./types').ListDirectoryResult} ListDirectoryResult
 */

/**
 * @param {any} err
 * @return {boolean}
 */
function isForbiddenError(err) {
  if (!err || !(err instanceof ReadError || err instanceof NotFoundError)) {
    return false
  }
  // @ts-ignore
  return err?.cause.statusCode === 403 || err?.cause.Code === 'AccessDenied'
}

class RootKeyEncryptionKey {
  /** @type {Buffer} */
  #keyEncryptionKey
  /** @type {Buffer} */
  #salt

  /**
   * @param {Buffer} keyEncryptionKey
   * @param {Buffer} salt
   */
  constructor(keyEncryptionKey, salt) {
    if (keyEncryptionKey.byteLength !== AES256_KEY_LENGTH) {
      throw new Error(`kek is not ${AES256_KEY_LENGTH} bytes long`)
    }
    this.#keyEncryptionKey = keyEncryptionKey
    this.#salt = salt
  }

  /**
   * @param {string} prefix
   * @return {Promise<SSECOptions>}
   */
  async forProject(prefix) {
    return new SSECOptions(
      Buffer.from(
        await hkdf(
          'sha256',
          this.#keyEncryptionKey,
          this.#salt,
          prefix,
          AES256_KEY_LENGTH
        )
      )
    )
  }
}

class PerProjectEncryptedS3Persistor extends S3Persistor {
  /** @type {Settings} */
  #settings
  /** @type {Promise<Array<RootKeyEncryptionKey>>} */
  #availableKeyEncryptionKeysPromise

  /**
   * @param {Settings} settings
   */
  constructor(settings) {
    if (!settings.dataEncryptionKeyBucketName) {
      throw new Error('settings.dataEncryptionKeyBucketName is missing')
    }
    super(settings)
    this.#settings = settings
    this.#availableKeyEncryptionKeysPromise = settings
      .getRootKeyEncryptionKeys()
      .then(rootKEKs => {
        if (rootKEKs.length === 0) throw new Error('no root kek provided')
        return rootKEKs
      })
  }

  async ensureKeyEncryptionKeysLoaded() {
    await this.#availableKeyEncryptionKeysPromise
  }

  /**
   * @param {string} bucketName
   * @param {string} path
   * @return {{dekPath: string, projectFolder: string}}
   */
  #buildProjectPaths(bucketName, path) {
    const projectFolder = this.#settings.pathToProjectFolder(bucketName, path)
    const dekPath = Path.join(projectFolder, 'dek')
    return { projectFolder, dekPath }
  }

  /**
   * @param {string} projectFolder
   * @return {Promise<SSECOptions>}
   */
  async #getCurrentKeyEncryptionKey(projectFolder) {
    const [currentRootKEK] = await this.#availableKeyEncryptionKeysPromise
    return await currentRootKEK.forProject(projectFolder)
  }

  /**
   * @param {string} bucketName
   * @param {string} path
   */
  async getDataEncryptionKeySize(bucketName, path) {
    const { projectFolder, dekPath } = this.#buildProjectPaths(bucketName, path)
    for (const rootKEK of await this.#availableKeyEncryptionKeysPromise) {
      const ssecOptions = await rootKEK.forProject(projectFolder)
      try {
        return await super.getObjectSize(
          this.#settings.dataEncryptionKeyBucketName,
          dekPath,
          { ssecOptions }
        )
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
   * @return {Promise<CachedPerProjectEncryptedS3Persistor>}
   */
  async forProjectRO(bucketName, path) {
    return new CachedPerProjectEncryptedS3Persistor(
      this,
      await this.#getExistingDataEncryptionKeyOptions(bucketName, path)
    )
  }

  /**
   * @param {string} bucketName
   * @param {string} path
   * @return {Promise<CachedPerProjectEncryptedS3Persistor>}
   */
  async generateDataEncryptionKey(bucketName, path) {
    return new CachedPerProjectEncryptedS3Persistor(
      this,
      await this.#generateDataEncryptionKeyOptions(bucketName, path)
    )
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
    const { projectFolder, dekPath } = this.#buildProjectPaths(bucketName, path)
    await super.sendStream(
      this.#settings.dataEncryptionKeyBucketName,
      dekPath,
      Stream.Readable.from([dataEncryptionKey]),
      {
        // Do not overwrite any objects if already created
        ifNoneMatch: '*',
        ssecOptions: await this.#getCurrentKeyEncryptionKey(projectFolder),
        contentLength: 32,
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
    const { projectFolder, dekPath } = this.#buildProjectPaths(bucketName, path)
    let res
    let kekIndex = 0
    for (const rootKEK of await this.#availableKeyEncryptionKeysPromise) {
      const ssecOptions = await rootKEK.forProject(projectFolder)
      try {
        res = await super.getObjectStream(
          this.#settings.dataEncryptionKeyBucketName,
          dekPath,
          { ssecOptions }
        )
        break
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
      const ssecOptions = await this.#getCurrentKeyEncryptionKey(projectFolder)
      try {
        await super.sendStream(
          this.#settings.dataEncryptionKeyBucketName,
          dekPath,
          Stream.Readable.from([buf.getContents()]),
          { ssecOptions }
        )
      } catch (err) {
        if (this.#settings.ignoreErrorsFromDEKReEncryption) {
          logger.warn({ err, dekPath }, 'failed to persist re-encrypted DEK')
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

  async getObjectStorageClass(bucketName, path, opts = {}) {
    const ssecOptions =
      opts.ssecOptions ||
      (await this.#getExistingDataEncryptionKeyOptions(bucketName, path))
    return await super.getObjectStorageClass(bucketName, path, {
      ...opts,
      ssecOptions,
    })
  }

  async directorySize(bucketName, path, continuationToken) {
    // Note: Listing a bucket does not require SSE-C credentials.
    return await super.directorySize(bucketName, path, continuationToken)
  }

  async deleteDirectory(bucketName, path, continuationToken) {
    // Let [Settings.pathToProjectFolder] validate the project path before deleting things.
    const { projectFolder, dekPath } = this.#buildProjectPaths(bucketName, path)
    // Note: Listing/Deleting a prefix does not require SSE-C credentials.
    await super.deleteDirectory(bucketName, path, continuationToken)
    if (projectFolder === path) {
      await super.deleteObject(
        this.#settings.dataEncryptionKeyBucketName,
        dekPath
      )
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
  /** @type SSECOptions  */
  #projectKeyOptions
  /** @type PerProjectEncryptedS3Persistor  */
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
   *
   * @param {string} bucketName
   * @param {string} path
   * @return {Promise<number>}
   */
  async getObjectSize(bucketName, path) {
    return await this.#parent.getObjectSize(bucketName, path)
  }

  /**
   *
   * @param {string} bucketName
   * @param {string} path
   * @return {Promise<string[]>}
   */
  async listDirectoryKeys(bucketName, path) {
    return await this.#parent.listDirectoryKeys(bucketName, path)
  }

  /**
   *
   * @param {string} bucketName
   * @param {string} path
   * @return {Promise<Array<{key: string, size: number}>>}
   */
  async listDirectoryStats(bucketName, path) {
    return await this.#parent.listDirectoryStats(bucketName, path)
  }

  /**
   * @param {string} bucketName
   * @param {string} path
   * @param {NodeJS.ReadableStream} sourceStream
   * @param {Object} opts
   * @param {string} [opts.contentType]
   * @param {string} [opts.contentEncoding]
   * @param {number} [opts.contentLength]
   * @param {'*'} [opts.ifNoneMatch]
   * @param {SSECOptions} [opts.ssecOptions]
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
   * @param {boolean} [opts.autoGunzip]
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

module.exports = {
  PerProjectEncryptedS3Persistor,
  CachedPerProjectEncryptedS3Persistor,
  RootKeyEncryptionKey,
}
