const http = require('http')
const https = require('https')
if (http.globalAgent.maxSockets < 300) {
  http.globalAgent.maxSockets = 300
}
if (https.globalAgent.maxSockets < 300) {
  https.globalAgent.maxSockets = 300
}

const AbstractPersistor = require('./AbstractPersistor')
const PersistorHelper = require('./PersistorHelper')

const { pipeline, PassThrough } = require('stream')
const fs = require('fs')
const S3 = require('aws-sdk/clients/s3')
const { URL } = require('url')
const {
  WriteError,
  ReadError,
  NotFoundError,
  SettingsError,
} = require('./Errors')

module.exports = class S3Persistor extends AbstractPersistor {
  constructor(settings = {}) {
    super()

    this.settings = settings
  }

  async sendFile(bucketName, key, fsPath) {
    return this.sendStream(bucketName, key, fs.createReadStream(fsPath))
  }

  async sendStream(bucketName, key, readStream, opts = {}) {
    try {
      // egress from us to S3
      const observeOptions = {
        metric: 's3.egress',
        Metrics: this.settings.Metrics,
      }

      const observer = new PersistorHelper.ObserverStream(observeOptions)
      // observer will catch errors, clean up and log a warning
      pipeline(readStream, observer, () => {})

      // if we have an md5 hash, pass this to S3 to verify the upload
      const uploadOptions = {
        Bucket: bucketName,
        Key: key,
        Body: observer,
      }

      if (opts.contentType) {
        uploadOptions.ContentType = opts.contentType
      }
      if (opts.contentEncoding) {
        uploadOptions.ContentEncoding = opts.contentEncoding
      }

      // if we have an md5 hash, pass this to S3 to verify the upload - otherwise
      // we rely on the S3 client's checksum calculation to validate the upload
      const clientOptions = {}
      if (opts.sourceMd5) {
        uploadOptions.ContentMD5 = PersistorHelper.hexToBase64(opts.sourceMd5)
      } else {
        clientOptions.computeChecksums = true
      }

      await this._getClientForBucket(bucketName, clientOptions)
        .upload(uploadOptions, { partSize: this.settings.partSize })
        .promise()
    } catch (err) {
      throw PersistorHelper.wrapError(
        err,
        'upload to S3 failed',
        { bucketName, key },
        WriteError
      )
    }
  }

  async getObjectStream(bucketName, key, opts) {
    opts = opts || {}

    const params = {
      Bucket: bucketName,
      Key: key,
    }
    if (opts.start != null && opts.end != null) {
      params.Range = `bytes=${opts.start}-${opts.end}`
    }

    const req = this._getClientForBucket(bucketName).getObject(params)
    const stream = req.createReadStream()

    try {
      await new Promise((resolve, reject) => {
        req.on('httpHeaders', statusCode => {
          switch (statusCode) {
            case 200: // full response
            case 206: // partial response
              return resolve()
            case 403: // AccessDenied is handled the same as NoSuchKey
            case 404: // NoSuchKey
              return reject(new NotFoundError())
            default:
              return reject(new Error('non success status: ' + statusCode))
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

    // ingress from S3 to us
    const observer = new PersistorHelper.ObserverStream({
      metric: 's3.ingress',
      Metrics: this.settings.Metrics,
    })

    const pass = new PassThrough()
    pipeline(stream, observer, pass, err => {
      if (err) req.abort()
    })
    return pass
  }

  async getRedirectUrl(bucketName, key) {
    const expiresSeconds = Math.round(this.settings.signedUrlExpiryInMs / 1000)
    try {
      const url = await this._getClientForBucket(
        bucketName
      ).getSignedUrlPromise('getObject', {
        Bucket: bucketName,
        Key: key,
        Expires: expiresSeconds,
      })
      return url
    } catch (err) {
      throw PersistorHelper.wrapError(
        err,
        'error generating signed url for S3 file',
        { bucketName, key },
        ReadError
      )
    }
  }

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

    const objects = response.Contents.map(item => ({ Key: item.Key }))
    if (objects.length) {
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

  async getObjectSize(bucketName, key) {
    try {
      const response = await this._getClientForBucket(bucketName)
        .headObject({ Bucket: bucketName, Key: key })
        .promise()
      return response.ContentLength
    } catch (err) {
      throw PersistorHelper.wrapError(
        err,
        'error getting size of s3 object',
        { bucketName, key },
        ReadError
      )
    }
  }

  async getObjectMd5Hash(bucketName, key) {
    try {
      const response = await this._getClientForBucket(bucketName)
        .headObject({ Bucket: bucketName, Key: key })
        .promise()
      const md5 = S3Persistor._md5FromResponse(response)
      if (md5) {
        return md5
      }
      // etag is not in md5 format
      if (this.settings.Metrics) {
        this.settings.Metrics.inc('s3.md5Download')
      }
      return PersistorHelper.calculateStreamMd5(
        await this.getObjectStream(bucketName, key)
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

  async copyObject(bucketName, sourceKey, destKey) {
    const params = {
      Bucket: bucketName,
      Key: destKey,
      CopySource: `${bucketName}/${sourceKey}`,
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

  async checkIfObjectExists(bucketName, key) {
    try {
      await this.getObjectSize(bucketName, key)
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

      const size = response.Contents.reduce((acc, item) => item.Size + acc, 0)
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

  _getClientForBucket(bucket, clientOptions) {
    if (this.settings.bucketCreds && this.settings.bucketCreds[bucket]) {
      return new S3(
        this._buildClientOptions(
          this.settings.bucketCreds[bucket],
          clientOptions
        )
      )
    }

    // no specific credentials for the bucket
    if (this.settings.key) {
      return new S3(this._buildClientOptions(null, clientOptions))
    }

    throw new SettingsError(
      'no bucket-specific or default credentials provided',
      { bucket }
    )
  }

  _buildClientOptions(bucketCredentials, clientOptions) {
    const options = clientOptions || {}

    if (bucketCredentials) {
      options.credentials = {
        accessKeyId: bucketCredentials.auth_key,
        secretAccessKey: bucketCredentials.auth_secret,
      }
    } else {
      options.credentials = {
        accessKeyId: this.settings.key,
        secretAccessKey: this.settings.secret,
      }
    }

    if (this.settings.endpoint) {
      const endpoint = new URL(this.settings.endpoint)
      options.endpoint = this.settings.endpoint
      options.sslEnabled = endpoint.protocol === 'https'
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

    return options
  }

  static _md5FromResponse(response) {
    const md5 = (response.ETag || '').replace(/[ "]/g, '')
    if (!md5.match(/^[a-f0-9]{32}$/)) {
      return null
    }

    return md5
  }
}
