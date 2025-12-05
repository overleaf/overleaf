const fs = require('node:fs')
const { pipeline } = require('node:stream/promises')
const { PassThrough } = require('node:stream')
const { Storage, IdempotencyStrategy } = require('@google-cloud/storage')
const {
  WriteError,
  ReadError,
  NotFoundError,
  NotImplementedError,
} = require('./Errors')
const asyncPool = require('tiny-async-pool')
const AbstractPersistor = require('./AbstractPersistor')
const PersistorHelper = require('./PersistorHelper')
const Logger = require('@overleaf/logger')
const zlib = require('node:zlib')

module.exports = class GcsPersistor extends AbstractPersistor {
  constructor(settings) {
    if (settings.storageClass) {
      throw new NotImplementedError(
        'Use default bucket class for GCS instead of settings.storageClass'
      )
    }

    super()
    this.settings = settings

    // endpoint settings will be null by default except for tests
    // that's OK - GCS uses the locally-configured service account by default
    const storageOptions = {}
    if (this.settings.endpoint) {
      storageOptions.projectId = this.settings.endpoint.projectId
      storageOptions.apiEndpoint = this.settings.endpoint.apiEndpoint
    }
    storageOptions.retryOptions = { ...this.settings.retryOptions }
    if (storageOptions.retryOptions) {
      if (storageOptions.retryOptions.idempotencyStrategy) {
        const value =
          IdempotencyStrategy[this.settings.retryOptions.idempotencyStrategy]
        if (value === undefined) {
          throw new Error(
            'Unrecognised value for retryOptions.idempotencyStrategy'
          )
        }
        Logger.info(
          `Setting retryOptions.idempotencyStrategy to ${storageOptions.retryOptions.idempotencyStrategy} (${value})`
        )
        storageOptions.retryOptions.idempotencyStrategy = value
      }
    }

    this.storage = new Storage(storageOptions)
  }

  async sendFile(bucketName, key, fsPath) {
    return await this.sendStream(bucketName, key, fs.createReadStream(fsPath))
  }

  async sendStream(bucketName, key, readStream, opts = {}) {
    try {
      const observeOptions = {
        metric: 'gcs.egress', // egress from us to GCS
        bucket: bucketName,
      }

      let sourceMd5 = opts.sourceMd5
      if (!sourceMd5) {
        // if there is no supplied md5 hash, we calculate the hash as the data passes through
        observeOptions.hash = 'md5'
      }

      const observer = new PersistorHelper.ObserverStream(observeOptions)

      const writeOptions = {
        // disabling of resumable uploads is recommended by Google:
        resumable: false,
      }

      if (sourceMd5) {
        writeOptions.validation = 'md5'
        writeOptions.metadata = writeOptions.metadata || {}
        writeOptions.metadata.md5Hash = PersistorHelper.hexToBase64(sourceMd5)
      }
      if (opts.contentType) {
        writeOptions.metadata = writeOptions.metadata || {}
        writeOptions.metadata.contentType = opts.contentType
      }
      if (opts.contentEncoding) {
        writeOptions.metadata = writeOptions.metadata || {}
        writeOptions.metadata.contentEncoding = opts.contentEncoding
      }
      const fileOptions = {}
      if (opts.ifNoneMatch === '*') {
        fileOptions.generation = 0
      }

      const uploadStream = this.storage
        .bucket(bucketName)
        .file(key, fileOptions)
        .createWriteStream(writeOptions)

      await pipeline(readStream, observer, uploadStream)

      // if we didn't have an md5 hash, we should compare our computed one with Google's
      // as we couldn't tell GCS about it beforehand
      if (!sourceMd5) {
        sourceMd5 = observer.getHash()
        // throws on mismatch
        await PersistorHelper.verifyMd5(this, bucketName, key, sourceMd5)
      }
    } catch (err) {
      throw PersistorHelper.wrapError(
        err,
        'upload to GCS failed',
        { bucketName, key, ifNoneMatch: opts.ifNoneMatch },
        WriteError
      )
    }
  }

  async getObjectStream(bucketName, key, opts = {}) {
    const observer = new PersistorHelper.ObserverStream({
      metric: 'gcs.ingress', // ingress to us from GCS
      bucket: bucketName,
    })
    const stream = this.storage
      .bucket(bucketName)
      .file(key)
      .createReadStream({ decompress: false, ...opts })

    let contentEncoding
    try {
      await new Promise((resolve, reject) => {
        stream.on('response', res => {
          switch (res.statusCode) {
            case 200: // full response
            case 206: // partial response
              contentEncoding = res.headers['content-encoding']
              return resolve()
            case 404:
              return reject(new NotFoundError())
            default:
              return reject(new Error('non success status: ' + res.statusCode))
          }
        })
        stream.on('error', reject)
        stream.read(0) // kick off request
      })
    } catch (err) {
      throw PersistorHelper.wrapError(
        err,
        'error reading file from GCS',
        { bucketName, key, opts },
        ReadError
      )
    }
    // Return a PassThrough stream with a minimal interface. It will buffer until the caller starts reading. It will emit errors from the source stream (Stream.pipeline passes errors along).
    const pass = new PassThrough()
    const transformer = []
    if (contentEncoding === 'gzip' && opts.autoGunzip) {
      transformer.push(zlib.createGunzip())
    }
    pipeline(stream, observer, ...transformer, pass).catch(() => {})
    return pass
  }

  async getRedirectUrl(bucketName, key) {
    if (this.settings.unsignedUrls) {
      // Construct a direct URL to the object download endpoint
      // (see https://cloud.google.com/storage/docs/request-endpoints#json-api)
      const apiEndpoint =
        this.settings.endpoint.apiEndpoint || 'https://storage.googleapis.com'
      return `${apiEndpoint}/download/storage/v1/b/${bucketName}/o/${key}?alt=media`
    }
    try {
      const [url] = await this.storage
        .bucket(bucketName)
        .file(key)
        .getSignedUrl({
          action: 'read',
          expires: Date.now() + this.settings.signedUrlExpiryInMs,
        })
      return url
    } catch (err) {
      throw PersistorHelper.wrapError(
        err,
        'error generating signed url for GCS file',
        { bucketName, key },
        ReadError
      )
    }
  }

  async getObjectSize(bucketName, key) {
    try {
      const [metadata] = await this.storage
        .bucket(bucketName)
        .file(key)
        .getMetadata()
      return parseInt(metadata.size, 10)
    } catch (err) {
      throw PersistorHelper.wrapError(
        err,
        'error getting size of GCS object',
        { bucketName, key },
        ReadError
      )
    }
  }

  async getObjectMd5Hash(bucketName, key) {
    try {
      const [metadata] = await this.storage
        .bucket(bucketName)
        .file(key)
        .getMetadata()
      return PersistorHelper.base64ToHex(metadata.md5Hash)
    } catch (err) {
      throw PersistorHelper.wrapError(
        err,
        'error getting hash of GCS object',
        { bucketName, key },
        ReadError
      )
    }
  }

  async deleteObject(bucketName, key) {
    try {
      const file = this.storage.bucket(bucketName).file(key)

      if (this.settings.deletedBucketSuffix) {
        await file.copy(
          this.storage
            .bucket(`${bucketName}${this.settings.deletedBucketSuffix}`)
            .file(`${key}-${new Date().toISOString()}`)
        )
      }
      if (this.settings.unlockBeforeDelete) {
        await file.setMetadata({ eventBasedHold: false })
      }
      await file.delete()
    } catch (err) {
      // ignore 404s: it's fine if the file doesn't exist.
      if (err.code === 404) {
        return
      }
      throw PersistorHelper.wrapError(
        err,
        'error deleting GCS object',
        { bucketName, key },
        WriteError
      )
    }
  }

  async deleteDirectory(bucketName, key) {
    const prefix = ensurePrefixIsDirectory(key)
    let query = { prefix, autoPaginate: false }
    do {
      try {
        const [files, nextQuery] = await this.storage
          .bucket(bucketName)
          .getFiles(query)
        // iterate over paginated results using the nextQuery returned by getFiles
        query = nextQuery
        if (Array.isArray(files) && files.length > 0) {
          await asyncPool(
            this.settings.deleteConcurrency,
            files,
            async file => {
              await this.deleteObject(bucketName, file.name)
            }
          )
        }
      } catch (err) {
        const error = PersistorHelper.wrapError(
          err,
          'failed to delete directory in GCS',
          { bucketName, key },
          WriteError
        )
        if (error instanceof NotFoundError) {
          return
        }
        throw error
      }
    } while (query)
  }

  async #listDirectory(bucketName, prefix) {
    try {
      const [response] = await this.storage
        .bucket(bucketName)
        .getFiles({ prefix })
      return response
    } catch (err) {
      throw PersistorHelper.wrapError(
        err,
        'failed to list objects in GCS',
        { bucketName, prefix },
        ReadError
      )
    }
  }

  async directorySize(bucketName, key) {
    const prefix = ensurePrefixIsDirectory(key)
    const files = await this.#listDirectory(bucketName, prefix)

    return files.reduce(
      (acc, file) => parseInt(file.metadata.size, 10) + acc,
      0
    )
  }

  async listDirectoryKeys(bucketName, prefix) {
    const files = await this.#listDirectory(
      bucketName,
      ensurePrefixIsDirectory(prefix)
    )
    return files.map(file => file.name)
  }

  async listDirectoryStats(bucketName, prefix) {
    const files = await this.#listDirectory(
      bucketName,
      ensurePrefixIsDirectory(prefix)
    )
    return files.map(file => ({
      key: file.name,
      size: parseInt(file.metadata.size, 10),
    }))
  }

  async checkIfObjectExists(bucketName, key) {
    try {
      const [response] = await this.storage
        .bucket(bucketName)
        .file(key)
        .exists()
      return response
    } catch (err) {
      throw PersistorHelper.wrapError(
        err,
        'error checking if file exists in GCS',
        { bucketName, key },
        ReadError
      )
    }
  }

  async copyObject(bucketName, sourceKey, destKey) {
    try {
      const src = this.storage.bucket(bucketName).file(sourceKey)
      const dest = this.storage.bucket(bucketName).file(destKey)
      await src.copy(dest)
    } catch (err) {
      // fake-gcs-server has a bug that returns an invalid response when the file does not exist
      if (err.message === 'Cannot parse response as JSON: not found\n') {
        err.code = 404
      }
      throw PersistorHelper.wrapError(
        err,
        'failed to copy file in GCS',
        { bucketName, sourceKey, destKey },
        WriteError
      )
    }
  }
}

function ensurePrefixIsDirectory(key) {
  return key === '' || key.endsWith('/') ? key : `${key}/`
}
