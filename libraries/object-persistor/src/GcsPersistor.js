const fs = require('fs')
const { promisify } = require('util')
const Stream = require('stream')
const { Storage } = require('@google-cloud/storage')
const { WriteError, ReadError, NotFoundError } = require('./Errors')
const asyncPool = require('tiny-async-pool')
const AbstractPersistor = require('./AbstractPersistor')
const PersistorHelper = require('./PersistorHelper')

const pipeline = promisify(Stream.pipeline)

module.exports = class GcsPersistor extends AbstractPersistor {
  constructor(settings) {
    super()

    this.settings = settings

    // endpoint settings will be null by default except for tests
    // that's OK - GCS uses the locally-configured service account by default
    this.storage = new Storage(this.settings.endpoint)
    // workaround for broken uploads with custom endpoints:
    // https://github.com/googleapis/nodejs-storage/issues/898
    if (this.settings.endpoint && this.settings.endpoint.apiEndpoint) {
      this.storage.interceptors.push({
        request: (reqOpts) => {
          const url = new URL(reqOpts.uri)
          url.host = this.settings.endpoint.apiEndpoint
          if (this.settings.endpoint.apiScheme) {
            url.protocol = this.settings.endpoint.apiScheme
          }
          reqOpts.uri = url.toString()
          return reqOpts
        }
      })
    }
  }

  async sendFile(bucketName, key, fsPath) {
    return this.sendStream(bucketName, key, fs.createReadStream(fsPath))
  }

  async sendStream(bucketName, key, readStream, opts = {}) {
    try {
      // egress from us to gcs
      const observeOptions = {
        metric: 'gcs.egress',
        Metrics: this.settings.Metrics
      }

      let sourceMd5 = opts.sourceMd5
      if (!sourceMd5) {
        // if there is no supplied md5 hash, we calculate the hash as the data passes through
        observeOptions.hash = 'md5'
      }

      const observer = new PersistorHelper.ObserverStream(observeOptions)

      const writeOptions = {
        // disabling of resumable uploads is recommended by Google:
        resumable: false
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

      const uploadStream = this.storage
        .bucket(bucketName)
        .file(key)
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
        { bucketName, key },
        WriteError
      )
    }
  }

  async getObjectStream(bucketName, key, opts = {}) {
    const stream = this.storage
      .bucket(bucketName)
      .file(key)
      .createReadStream({ decompress: false, ...opts })

    // ingress to us from gcs
    const observer = new PersistorHelper.ObserverStream({
      metric: 'gcs.ingress',
      Metrics: this.settings.Metrics
    })

    try {
      // wait for the pipeline to be ready, to catch non-200s
      await PersistorHelper.getReadyPipeline(stream, observer)
      return observer
    } catch (err) {
      throw PersistorHelper.wrapError(
        err,
        'error reading file from GCS',
        { bucketName, key, opts },
        ReadError
      )
    }
  }

  async getRedirectUrl(bucketName, key) {
    if (this.settings.unsignedUrls) {
      // Construct a direct URL to the object download endpoint
      // (see https://cloud.google.com/storage/docs/request-endpoints#json-api)
      const apiScheme = this.settings.endpoint.apiScheme || 'https://'
      const apiEndpoint =
        this.settings.endpoint.apiEndpoint || 'storage.googleapis.com'
      return `${apiScheme}://${apiEndpoint}/download/storage/v1/b/${bucketName}/o/${key}?alt=media`
    }
    try {
      const [url] = await this.storage
        .bucket(bucketName)
        .file(key)
        .getSignedUrl({
          action: 'read',
          expires: Date.now() + this.settings.signedUrlExpiryInMs
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
      return metadata.size
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
    try {
      const [files] = await this.storage
        .bucket(bucketName)
        .getFiles({ directory: key })

      if (Array.isArray(files) && files.length > 0) {
        await asyncPool(
          this.settings.deleteConcurrency,
          files,
          async (file) => {
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
  }

  async directorySize(bucketName, key) {
    let files

    try {
      const [response] = await this.storage
        .bucket(bucketName)
        .getFiles({ directory: key })
      files = response
    } catch (err) {
      throw PersistorHelper.wrapError(
        err,
        'failed to list objects in GCS',
        { bucketName, key },
        ReadError
      )
    }

    return files.reduce((acc, file) => Number(file.metadata.size) + acc, 0)
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
