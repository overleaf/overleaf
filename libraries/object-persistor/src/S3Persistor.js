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
const {
  S3Client,
  CreateBucketCommand,
  GetObjectCommand,
  PutObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
  CopyObjectCommand,
} = require('@aws-sdk/client-s3')
const { Upload } = require('@aws-sdk/lib-storage')
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner')
const { NodeHttpHandler } = require('@aws-sdk/node-http-handler')
const { WriteError, ReadError, NotFoundError } = require('./Errors')
const zlib = require('node:zlib')
const { addMd5Middleware } = require('./S3Md5Middleware')

/**
 * @typedef {import('./types').ListDirectoryResult} ListDirectoryResult
 */

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
  /** @type {Map<string, S3Client>} */
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

      /** @type {import('@aws-sdk/client-s3').PutObjectCommandInput} */
      const uploadOptions = {
        Bucket: bucketName,
        Key: key,
        Body: observer,
      }

      if (this.settings.storageClass[bucketName]) {
        uploadOptions.StorageClass = this.settings.storageClass[bucketName]
      }

      if ('sourceMd5' in opts) {
        // we fail straight away to prevent the client from wasting CPU/IO precomputing the hash
        throw new Error(
          'sourceMd5 option is not supported, S3 provides its own integrity protection mechanism'
        )
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

      const upload = new Upload({
        client: this._getClientForBucket(bucketName),
        params: uploadOptions,
        partSize: this.settings.partSize,
      })
      await upload.done()
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

    /** @type {import('@aws-sdk/client-s3').GetObjectCommandInput} */
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

    const abortController = new AbortController()
    let stream, contentEncoding
    try {
      const { Body, ContentEncoding } = await this._getClientForBucket(
        bucketName
      ).send(new GetObjectCommand(params), {
        abortSignal: abortController.signal,
      })
      stream = Body
      contentEncoding = ContentEncoding
    } catch (err) {
      abortController.abort()
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
    // @ts-ignore stream (Body) can be undefined in GetObjectCommand
    pipeline(stream, observer, ...transformer, pass, err => {
      if (err) {
        abortController.abort()
      }
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
      return await getSignedUrl(
        this._getClientForBucket(bucketName),
        new GetObjectCommand({
          Bucket: bucketName,
          Key: key,
        }),
        { expiresIn: expiresSeconds }
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
    const { contents, response } = await this.#listDirectory(
      bucketName,
      key,
      continuationToken
    )
    const objects = contents.map(item => ({ Key: item.Key || '' }))
    if (objects?.length) {
      try {
        await this._getClientForBucket(bucketName).send(
          new DeleteObjectsCommand({
            Bucket: bucketName,
            Delete: {
              Objects: objects,
              Quiet: true,
            },
          })
        )
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
   *
   * @param {string} bucketName
   * @param {string} key
   * @param {string} [continuationToken]
   * @return {Promise<ListDirectoryResult>}
   */
  async #listDirectory(bucketName, key, continuationToken) {
    let response
    const options = { Bucket: bucketName, Prefix: key }
    if (continuationToken) {
      options.ContinuationToken = continuationToken
    }

    try {
      response = await this._getClientForBucket(bucketName).send(
        new ListObjectsV2Command(options)
      )
    } catch (err) {
      throw PersistorHelper.wrapError(
        err,
        'failed to list objects in S3',
        { bucketName, key },
        ReadError
      )
    }

    return { contents: response.Contents ?? [], response }
  }

  /**
   * @param {string} bucketName
   * @param {string} key
   * @param {Object} opts
   * @param {SSECOptions} [opts.ssecOptions]
   * @return {Promise<import('@aws-sdk/client-s3').HeadObjectOutput>}
   */
  async #headObject(bucketName, key, opts = {}) {
    const params = { Bucket: bucketName, Key: key }
    if (opts.ssecOptions) {
      Object.assign(params, opts.ssecOptions.getGetOptions())
    }
    try {
      const client = await this._getClientForBucket(bucketName)
      return await client.send(new HeadObjectCommand(params))
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
      await this._getClientForBucket(bucketName).send(
        new DeleteObjectCommand({ Bucket: bucketName, Key: key })
      )
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
      CopySource: `/${bucketName}/${sourceKey}`,
    }
    if (opts.ssecSrcOptions) {
      Object.assign(params, opts.ssecSrcOptions.getCopyOptions())
    }
    if (opts.ssecOptions) {
      Object.assign(params, opts.ssecOptions.getPutOptions())
    }
    try {
      await this._getClientForBucket(bucketName).send(
        new CopyObjectCommand(params)
      )
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
      const response = await this._getClientForBucket(bucketName).send(
        new ListObjectsV2Command(options)
      )

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
   * @param {string} bucketName
   * @param {string} prefix
   * @return {Promise<Array<string>>}
   */
  async listDirectoryKeys(bucketName, prefix) {
    const keys = []
    let continuationToken

    do {
      const { contents, response } = await this.#listDirectory(
        bucketName,
        prefix,
        continuationToken
      )
      keys.push(...contents.map(item => item.Key || ''))
      continuationToken = response.IsTruncated
        ? response.NextContinuationToken
        : undefined
    } while (continuationToken)

    return keys
  }

  /**
   * @param {string} bucketName
   * @param {string} prefix
   * @return {Promise<Array<{key: string, size: number}>>}
   */
  async listDirectoryStats(bucketName, prefix) {
    const stats = []
    let continuationToken

    do {
      const { contents, response } = await this.#listDirectory(
        bucketName,
        prefix,
        continuationToken
      )
      stats.push(
        ...contents.map(item => ({
          key: item.Key || '',
          size: item.Size ?? -1,
        }))
      )
      continuationToken = response.IsTruncated
        ? response.NextContinuationToken
        : undefined
    } while (continuationToken)

    return stats
  }

  /**
   * @param {string} bucket
   * @return {S3Client}
   * @private
   */
  _getClientForBucket(bucket) {
    /** @type {import('@aws-sdk/client-s3').S3ClientConfig} */
    const clientOptions = {}
    const cacheKey = bucket

    let client = this.#clients.get(cacheKey)
    if (!client) {
      client = new S3Client(
        this._buildClientOptions(
          this.settings.bucketCreds?.[bucket],
          clientOptions
        )
      )
      this.#clients.set(cacheKey, client)

      // Some third-party S3-compatible services (as MinIO) do not support the default checksums
      // for object integrity in `DeleteObjectsCommand`. We add a fallback for those cases.
      // https://github.com/aws/aws-sdk-js-v3/blob/main/supplemental-docs/MD5_FALLBACK.md
      const useMd5Fallback = process.env.DELETE_OBJECTS_MD5_FALLBACK === 'true'
      if (useMd5Fallback) {
        addMd5Middleware(client)
      }
    }

    return client
  }

  /**
   * @param {Object} bucketCredentials
   * @param {import('@aws-sdk/client-s3').S3ClientConfig} clientOptions
   * @return {import('@aws-sdk/client-s3').S3ClientConfig}
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
      // Docs: https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/setting-credentials-node.html
    }

    // region is required since aws sdk v3
    options.region =
      this.settings.region || process.env.AWS_REGION || 'us-east-1'

    let sslEnabled = false
    if (this.settings.endpoint) {
      const endpoint = new URL(this.settings.endpoint)
      options.endpoint = this.settings.endpoint
      sslEnabled = endpoint.protocol === 'https:'
    }

    // path-style access is only used for acceptance tests
    if (this.settings.pathStyle) {
      options.forcePathStyle = true
    }

    // maxRetries has been moved to maxAttempts in aws-sdk v3,
    // we're keeping the existing setting for backwards compatibility
    if (this.settings.maxRetries) {
      options.maxAttempts = this.settings.maxRetries + 1
    }

    const requestHandlerParams = this.settings.httpOptions || {}

    if (sslEnabled && this.settings.ca) {
      const agent = new https.Agent({
        rejectUnauthorized: true,
        ca: this.settings.ca,
      })
      Object.assign(requestHandlerParams, {
        httpAgent: agent,
        httpsAgent: agent,
      })
      options.requestHandler = new NodeHttpHandler({
        httpAgent: agent,
        httpsAgent: agent,
      })
    }

    const requestHandler = this._buildNodeHttpHandler(requestHandlerParams)
    if (requestHandler) {
      options.requestHandler = requestHandler
    }

    return options
  }

  /**
   * @param {import('@aws-sdk/node-http-handler').NodeHttpHandlerOptions & { timeout?: number }} params
   * @private
   */
  _buildNodeHttpHandler(params) {
    const isEmpty = Object.keys(params).length === 0
    if (isEmpty) {
      return
    }
    // ensures backwards compatibility with aws-sdk v2 httpOptions
    if (params.timeout) {
      params.connectionTimeout = params.timeout
      delete params.timeout
    }
    return new NodeHttpHandler(params)
  }

  // test-only
  _createBucket(bucketName) {
    return this._getClientForBucket(bucketName).send(
      new CreateBucketCommand({ Bucket: bucketName })
    )
  }

  // test-only
  _upload(bucketName, uploadOptions) {
    return this._getClientForBucket(bucketName).send(
      new PutObjectCommand(uploadOptions)
    )
  }

  /**
   * @param {import('@aws-sdk/client-s3').HeadObjectOutput} response
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
