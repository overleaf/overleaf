// @ts-check
const http = require('node:http')
const https = require('node:https')
if (http.globalAgent.maxSockets < 300) {
  http.globalAgent.maxSockets = 300
}
if (https.globalAgent.maxSockets < 300) {
  https.globalAgent.maxSockets = 300
}

const Crypto = require('node:crypto')
const Metrics = require('@overleaf/metrics')
const AbstractPersistor = require('./AbstractPersistor')
const PersistorHelper = require('./PersistorHelper')

const { pipeline, PassThrough } = require('node:stream')
const fs = require('node:fs')
const S3 = require('aws-sdk/clients/s3')
const { URL } = require('node:url')
const { WriteError, ReadError, NotFoundError } = require('./Errors')
const zlib = require('node:zlib')

/**
 * Wrapper with private fields to avoid revealing them on console, JSON.stringify or similar.
 */
class SSECOptions {
  #keyAsBuffer
  #keyMD5

  /**
   * @param {Buffer} keyAsBuffer
   */
  constructor(keyAsBuffer) {
    this.#keyAsBuffer = keyAsBuffer
    this.#keyMD5 = Crypto.createHash('md5').update(keyAsBuffer).digest('base64')
  }

  getPutOptions() {
    return {
      SSECustomerKey: this.#keyAsBuffer,
      SSECustomerKeyMD5: this.#keyMD5,
      SSECustomerAlgorithm: 'AES256',
    }
  }

  getGetOptions() {
    return {
      SSECustomerKey: this.#keyAsBuffer,
      SSECustomerKeyMD5: this.#keyMD5,
      SSECustomerAlgorithm: 'AES256',
    }
  }

  getCopyOptions() {
    return {
      CopySourceSSECustomerKey: this.#keyAsBuffer,
      CopySourceSSECustomerKeyMD5: this.#keyMD5,
      CopySourceSSECustomerAlgorithm: 'AES256',
    }
  }
}

class S3Persistor extends AbstractPersistor {
  /** @type {Map<string, S3>} */
  #clients = new Map()

  constructor(settings = {}) {
    super()

    settings.storageClass = settings.storageClass || {}
    this.settings = settings
  }

  /**
   * @param {string} bucketName
   * @param {string} key
   * @param {string} fsPath
   * @return {Promise<void>}
   */
  async sendFile(bucketName, key, fsPath) {
    await this.sendStream(bucketName, key, fs.createReadStream(fsPath))
  }

  /**
   * @param {string} bucketName
   * @param {string} key
   * @param {NodeJS.ReadableStream} readStream
   * @param {Object} opts
   * @param {string} [opts.contentType]
   * @param {string} [opts.contentEncoding]
   * @param {number} [opts.contentLength]
   * @param {'*'} [opts.ifNoneMatch]
   * @param {SSECOptions} [opts.ssecOptions]
   * @param {string} [opts.sourceMd5]
   * @return {Promise<void>}
   */
  async sendStream(bucketName, key, readStream, opts = {}) {
    try {
      const observeOptions = {
        metric: 's3.egress', // egress from us to S3
        bucket: bucketName,
      }

      const observer = new PersistorHelper.ObserverStream(observeOptions)
      // observer will catch errors, clean up and log a warning
      pipeline(readStream, observer, () => {})

      /** @type {S3.PutObjectRequest} */
      const uploadOptions = {
        Bucket: bucketName,
        Key: key,
        Body: observer,
      }

      if (this.settings.storageClass[bucketName]) {
        uploadOptions.StorageClass = this.settings.storageClass[bucketName]
      }

      if (opts.contentType) {
        uploadOptions.ContentType = opts.contentType
      }
      if (opts.contentEncoding) {
        uploadOptions.ContentEncoding = opts.contentEncoding
      }
      if (opts.contentLength) {
        uploadOptions.ContentLength = opts.contentLength
      }
      if (opts.ifNoneMatch === '*') {
        uploadOptions.IfNoneMatch = '*'
      }
      if (opts.ssecOptions) {
        Object.assign(uploadOptions, opts.ssecOptions.getPutOptions())
      }

      // if we have an md5 hash, pass this to S3 to verify the upload - otherwise
      // we rely on the S3 client's checksum calculation to validate the upload
      let computeChecksums = false
      if (opts.sourceMd5) {
        uploadOptions.ContentMD5 = PersistorHelper.hexToBase64(opts.sourceMd5)
      } else {
        computeChecksums = true
      }

      if (this.settings.disableMultiPartUpload) {
        await this._getClientForBucket(bucketName, computeChecksums)
          .putObject(uploadOptions)
          .promise()
      } else {
        await this._getClientForBucket(bucketName, computeChecksums)
          .upload(uploadOptions, { partSize: this.settings.partSize })
          .promise()
      }
    } catch (err) {
      throw PersistorHelper.wrapError(
        err,
        'upload to S3 failed',
        { bucketName, key, ifNoneMatch: opts.ifNoneMatch },
        WriteError
      )
    }
  }

  /**
   * @param {string} bucketName
   * @param {string} key
   * @param {Object} [opts]
   * @param {number} [opts.start]
   * @param {number} [opts.end]
   * @param {boolean} [opts.autoGunzip]
   * @param {SSECOptions} [opts.ssecOptions]
   * @return {Promise<NodeJS.ReadableStream>}
   */
  async getObjectStream(bucketName, key, opts) {
    opts = opts || {}

    const params = {
      Bucket: bucketName,
      Key: key,
    }
    if (opts.start != null && opts.end != null) {
      params.Range = `bytes=${opts.start}-${opts.end}`
    }
    if (opts.ssecOptions) {
      Object.assign(params, opts.ssecOptions.getGetOptions())
    }
    const observer = new PersistorHelper.ObserverStream({
      metric: 's3.ingress', // ingress from S3 to us
      bucket: bucketName,
    })

    const req = this._getClientForBucket(bucketName).getObject(params)
    const stream = req.createReadStream()

    let contentEncoding
    try {
      await new Promise((resolve, reject) => {
        req.on('httpHeaders', (statusCode, headers) => {
          switch (statusCode) {
            case 200: // full response
            case 206: // partial response
              contentEncoding = headers['content-encoding']
              return resolve(undefined)
            case 403: // AccessDenied
              return // handled by stream.on('error') handler below
            case 404: // NoSuchKey
              return reject(new NotFoundError('not found'))
            default:
            // handled by stream.on('error') handler below
          }
        })
        // The AWS SDK is forwarding any errors from the request to the stream.
        // The AWS SDK is emitting additional errors on the stream ahead of starting to stream.
        stream.on('error', reject)
        // The AWS SDK is kicking off the request in the next event loop cycle.
      })
    } catch (err) {
      throw PersistorHelper.wrapError(
        err,
        'error reading file from S3',
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
    pipeline(stream, observer, ...transformer, pass, err => {
      if (err) req.abort()
    })
    return pass
  }

  /**
   * @param {string} bucketName
   * @param {string} key
   * @return {Promise<string>}
   */
  async getRedirectUrl(bucketName, key) {
    const expiresSeconds = Math.round(this.settings.signedUrlExpiryInMs / 1000)
    try {
      return await this._getClientForBucket(bucketName).getSignedUrlPromise(
        'getObject',
        {
          Bucket: bucketName,
          Key: key,
          Expires: expiresSeconds,
        }
      )
    } catch (err) {
      throw PersistorHelper.wrapError(
        err,
        'error generating signed url for S3 file',
        { bucketName, key },
        ReadError
      )
    }
  }

  /**
   * @param {string} bucketName
   * @param {string} key
   * @param {string} [continuationToken]
   * @return {Promise<void>}
   */
  async deleteDirectory(bucketName, key, continuationToken) {
    let response
    const options = { Bucket: bucketName, Prefix: key }
    if (continuationToken) {
      options.ContinuationToken = continuationToken
    }

    try {
      response = await this._getClientForBucket(bucketName)
        .listObjectsV2(options)
        .promise()
    } catch (err) {
      throw PersistorHelper.wrapError(
        err,
        'failed to list objects in S3',
        { bucketName, key },
        ReadError
      )
    }

    const objects = response.Contents?.map(item => ({ Key: item.Key || '' }))
    if (objects?.length) {
      try {
        await this._getClientForBucket(bucketName)
          .deleteObjects({
            Bucket: bucketName,
            Delete: {
              Objects: objects,
              Quiet: true,
            },
          })
          .promise()
      } catch (err) {
        throw PersistorHelper.wrapError(
          err,
          'failed to delete objects in S3',
          { bucketName, key },
          WriteError
        )
      }
    }

    if (response.IsTruncated) {
      await this.deleteDirectory(
        bucketName,
        key,
        response.NextContinuationToken
      )
    }
  }

  /**
   * @param {string} bucketName
   * @param {string} key
   * @param {Object} opts
   * @param {SSECOptions} [opts.ssecOptions]
   * @return {Promise<S3.HeadObjectOutput>}
   */
  async #headObject(bucketName, key, opts = {}) {
    const params = { Bucket: bucketName, Key: key }
    if (opts.ssecOptions) {
      Object.assign(params, opts.ssecOptions.getGetOptions())
    }
    try {
      return await this._getClientForBucket(bucketName)
        .headObject(params)
        .promise()
    } catch (err) {
      throw PersistorHelper.wrapError(
        err,
        'error getting size of s3 object',
        { bucketName, key },
        ReadError
      )
    }
  }

  /**
   * @param {string} bucketName
   * @param {string} key
   * @param {Object} opts
   * @param {SSECOptions} [opts.ssecOptions]
   * @return {Promise<number>}
   */
  async getObjectSize(bucketName, key, opts = {}) {
    const response = await this.#headObject(bucketName, key, opts)
    return response.ContentLength || 0
  }

  /**
   * @param {string} bucketName
   * @param {string} key
   * @param {Object} opts
   * @param {SSECOptions} [opts.ssecOptions]
   * @return {Promise<string | undefined>}
   */
  async getObjectStorageClass(bucketName, key, opts = {}) {
    const response = await this.#headObject(bucketName, key, opts)
    return response.StorageClass
  }

  /**
   * @param {string} bucketName
   * @param {string} key
   * @param {Object} opts
   * @param {SSECOptions} [opts.ssecOptions]
   * @param {boolean} [opts.etagIsNotMD5]
   * @return {Promise<string>}
   */
  async getObjectMd5Hash(bucketName, key, opts = {}) {
    try {
      if (!opts.etagIsNotMD5) {
        const response = await this.#headObject(bucketName, key, opts)
        const md5 = S3Persistor._md5FromResponse(response)
        if (md5) {
          return md5
        }
      }
      // etag is not in md5 format
      Metrics.inc('s3.md5Download')
      return await PersistorHelper.calculateStreamMd5(
        await this.getObjectStream(bucketName, key, opts)
      )
    } catch (err) {
      throw PersistorHelper.wrapError(
        err,
        'error getting hash of s3 object',
        { bucketName, key },
        ReadError
      )
    }
  }

  /**
   * @param {string} bucketName
   * @param {string} key
   * @return {Promise<void>}
   */
  async deleteObject(bucketName, key) {
    try {
      await this._getClientForBucket(bucketName)
        .deleteObject({ Bucket: bucketName, Key: key })
        .promise()
    } catch (err) {
      // s3 does not give us a NotFoundError here
      throw PersistorHelper.wrapError(
        err,
        'failed to delete file in S3',
        { bucketName, key },
        WriteError
      )
    }
  }

  /**
   * @param {string} bucketName
   * @param {string} sourceKey
   * @param {string} destKey
   * @param {Object} opts
   * @param {SSECOptions} [opts.ssecSrcOptions]
   * @param {SSECOptions} [opts.ssecOptions]
   * @return {Promise<void>}
   */
  async copyObject(bucketName, sourceKey, destKey, opts = {}) {
    const params = {
      Bucket: bucketName,
      Key: destKey,
      CopySource: `${bucketName}/${sourceKey}`,
    }
    if (opts.ssecSrcOptions) {
      Object.assign(params, opts.ssecSrcOptions.getCopyOptions())
    }
    if (opts.ssecOptions) {
      Object.assign(params, opts.ssecOptions.getPutOptions())
    }
    try {
      await this._getClientForBucket(bucketName).copyObject(params).promise()
    } catch (err) {
      throw PersistorHelper.wrapError(
        err,
        'failed to copy file in S3',
        params,
        WriteError
      )
    }
  }

  /**
   * @param {string} bucketName
   * @param {string} key
   * @param {Object} opts
   * @param {SSECOptions} [opts.ssecOptions]
   * @return {Promise<boolean>}
   */
  async checkIfObjectExists(bucketName, key, opts) {
    try {
      await this.getObjectSize(bucketName, key, opts)
      return true
    } catch (err) {
      if (err instanceof NotFoundError) {
        return false
      }
      throw PersistorHelper.wrapError(
        err,
        'error checking whether S3 object exists',
        { bucketName, key },
        ReadError
      )
    }
  }

  /**
   * @param {string} bucketName
   * @param {string} key
   * @param {string} [continuationToken]
   * @return {Promise<number>}
   */
  async directorySize(bucketName, key, continuationToken) {
    try {
      const options = {
        Bucket: bucketName,
        Prefix: key,
      }
      if (continuationToken) {
        options.ContinuationToken = continuationToken
      }
      const response = await this._getClientForBucket(bucketName)
        .listObjectsV2(options)
        .promise()

      const size =
        response.Contents?.reduce((acc, item) => (item.Size || 0) + acc, 0) || 0
      if (response.IsTruncated) {
        return (
          size +
          (await this.directorySize(
            bucketName,
            key,
            response.NextContinuationToken
          ))
        )
      }
      return size
    } catch (err) {
      throw PersistorHelper.wrapError(
        err,
        'error getting directory size in S3',
        { bucketName, key },
        ReadError
      )
    }
  }

  /**
   * @param {string} bucket
   * @param {boolean} computeChecksums
   * @return {S3}
   * @private
   */
  _getClientForBucket(bucket, computeChecksums = false) {
    /** @type {S3.Types.ClientConfiguration} */
    const clientOptions = {}
    const cacheKey = `${bucket}:${computeChecksums}`
    if (computeChecksums) {
      clientOptions.computeChecksums = true
    }
    let client = this.#clients.get(cacheKey)
    if (!client) {
      client = new S3(
        this._buildClientOptions(
          this.settings.bucketCreds?.[bucket],
          clientOptions
        )
      )
      this.#clients.set(cacheKey, client)
    }
    return client
  }

  /**
   * @param {Object} bucketCredentials
   * @param {S3.Types.ClientConfiguration} clientOptions
   * @return {S3.Types.ClientConfiguration}
   * @private
   */
  _buildClientOptions(bucketCredentials, clientOptions) {
    const options = clientOptions || {}

    if (bucketCredentials) {
      options.credentials = {
        accessKeyId: bucketCredentials.auth_key,
        secretAccessKey: bucketCredentials.auth_secret,
      }
    } else if (this.settings.key) {
      options.credentials = {
        accessKeyId: this.settings.key,
        secretAccessKey: this.settings.secret,
      }
    } else {
      // Use the default credentials provider (process.env -> SSP -> ini -> IAM)
      // Docs: https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/CredentialProviderChain.html#defaultProviders-property
    }

    if (this.settings.endpoint) {
      const endpoint = new URL(this.settings.endpoint)
      options.endpoint = this.settings.endpoint
      options.sslEnabled = endpoint.protocol === 'https:'
    }

    // path-style access is only used for acceptance tests
    if (this.settings.pathStyle) {
      options.s3ForcePathStyle = true
    }

    for (const opt of ['httpOptions', 'maxRetries', 'region']) {
      if (this.settings[opt]) {
        options[opt] = this.settings[opt]
      }
    }

    if (options.sslEnabled && this.settings.ca && !options.httpOptions?.agent) {
      options.httpOptions = options.httpOptions || {}
      options.httpOptions.agent = new https.Agent({
        rejectUnauthorized: true,
        ca: this.settings.ca,
      })
    }

    return options
  }

  /**
   * @param {S3.HeadObjectOutput} response
   * @return {string|null}
   * @private
   */
  static _md5FromResponse(response) {
    const md5 = (response.ETag || '').replace(/[ "]/g, '')
    if (!md5.match(/^[a-f0-9]{32}$/)) {
      return null
    }

    return md5
  }
}

module.exports = {
  S3Persistor,
  SSECOptions,
}
