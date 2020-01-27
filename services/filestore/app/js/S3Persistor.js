const http = require('http')
const https = require('https')
http.globalAgent.maxSockets = 300
https.globalAgent.maxSockets = 300

const settings = require('settings-sharelatex')
const metrics = require('metrics-sharelatex')
const logger = require('logger-sharelatex')

const Minipass = require('minipass')
const meter = require('stream-meter')
const crypto = require('crypto')
const fs = require('fs')
const S3 = require('aws-sdk/clients/s3')
const { URL } = require('url')
const { callbackify } = require('util')
const {
  WriteError,
  ReadError,
  NotFoundError,
  SettingsError
} = require('./Errors')

module.exports = {
  sendFile: callbackify(sendFile),
  sendStream: callbackify(sendStream),
  getFileStream: callbackify(getFileStream),
  getFileMd5Hash: callbackify(getFileMd5Hash),
  deleteDirectory: callbackify(deleteDirectory),
  getFileSize: callbackify(getFileSize),
  deleteFile: callbackify(deleteFile),
  copyFile: callbackify(copyFile),
  checkIfFileExists: callbackify(checkIfFileExists),
  directorySize: callbackify(directorySize),
  promises: {
    sendFile,
    sendStream,
    getFileStream,
    getFileMd5Hash,
    deleteDirectory,
    getFileSize,
    deleteFile,
    copyFile,
    checkIfFileExists,
    directorySize
  }
}

function hexToBase64(hex) {
  return Buffer.from(hex, 'hex').toString('base64')
}

async function sendFile(bucketName, key, fsPath) {
  let readStream
  try {
    readStream = fs.createReadStream(fsPath)
  } catch (err) {
    throw _wrapError(
      err,
      'error reading file from disk',
      { bucketName, key, fsPath },
      ReadError
    )
  }
  return sendStream(bucketName, key, readStream)
}

async function sendStream(bucketName, key, readStream, sourceMd5) {
  try {
    // if there is no supplied md5 hash, we calculate the hash as the data passes through
    const passthroughStream = new Minipass()
    let hashPromise
    let b64Hash

    if (sourceMd5) {
      b64Hash = hexToBase64(sourceMd5)
    } else {
      const hash = crypto.createHash('md5')
      hash.setEncoding('hex')
      passthroughStream.pipe(hash)
      hashPromise = new Promise((resolve, reject) => {
        passthroughStream.on('end', () => {
          hash.end()
          resolve(hash.read())
        })
        passthroughStream.on('error', err => {
          reject(err)
        })
      })
    }

    const meteredStream = meter()
    passthroughStream.pipe(meteredStream)
    meteredStream.on('finish', () => {
      metrics.count('s3.egress', meteredStream.bytes)
    })

    // pipe the readstream through minipass, which can write to both the metered
    // stream (which goes on to S3) and the md5 generator if necessary
    // - we do this last so that a listener streams does not consume data meant
    // for both destinations
    readStream.pipe(passthroughStream)

    // if we have an md5 hash, pass this to S3 to verify the upload
    const uploadOptions = {
      Bucket: bucketName,
      Key: key,
      Body: meteredStream
    }
    if (b64Hash) {
      uploadOptions.ContentMD5 = b64Hash
    }

    const response = await _getClientForBucket(bucketName)
      .upload(uploadOptions)
      .promise()
    const destMd5 = _md5FromResponse(response)

    // if we didn't have an md5 hash, compare our computed one with S3's
    if (hashPromise) {
      sourceMd5 = await hashPromise

      if (sourceMd5 !== destMd5) {
        try {
          await deleteFile(bucketName, key)
        } catch (err) {
          logger.warn(err, 'error deleting file for invalid upload')
        }

        throw new WriteError({
          message: 'source and destination hashes do not match',
          info: {
            sourceMd5,
            destMd5,
            bucketName,
            key
          }
        })
      }
    }
  } catch (err) {
    throw _wrapError(
      err,
      'upload to S3 failed',
      { bucketName, key },
      WriteError
    )
  }
}

async function getFileStream(bucketName, key, opts) {
  opts = opts || {}

  const params = {
    Bucket: bucketName,
    Key: key
  }
  if (opts.start != null && opts.end != null) {
    params.Range = `bytes=${opts.start}-${opts.end}`
  }

  return new Promise((resolve, reject) => {
    const stream = _getClientForBucket(bucketName)
      .getObject(params)
      .createReadStream()

    const meteredStream = meter()
    meteredStream.on('finish', () => {
      metrics.count('s3.ingress', meteredStream.bytes)
    })

    const onStreamReady = function() {
      stream.removeListener('readable', onStreamReady)
      resolve(stream.pipe(meteredStream))
    }
    stream.on('readable', onStreamReady)
    stream.on('error', err => {
      reject(_wrapError(err, 'error reading from S3', params, ReadError))
    })
  })
}

async function deleteDirectory(bucketName, key) {
  let response

  try {
    response = await _getClientForBucket(bucketName)
      .listObjects({ Bucket: bucketName, Prefix: key })
      .promise()
  } catch (err) {
    throw _wrapError(
      err,
      'failed to list objects in S3',
      { bucketName, key },
      ReadError
    )
  }

  const objects = response.Contents.map(item => ({ Key: item.Key }))
  if (objects.length) {
    try {
      await _getClientForBucket(bucketName)
        .deleteObjects({
          Bucket: bucketName,
          Delete: {
            Objects: objects,
            Quiet: true
          }
        })
        .promise()
    } catch (err) {
      throw _wrapError(
        err,
        'failed to delete objects in S3',
        { bucketName, key },
        WriteError
      )
    }
  }
}

async function getFileSize(bucketName, key) {
  try {
    const response = await _getClientForBucket(bucketName)
      .headObject({ Bucket: bucketName, Key: key })
      .promise()
    return response.ContentLength
  } catch (err) {
    throw _wrapError(
      err,
      'error getting size of s3 object',
      { bucketName, key },
      ReadError
    )
  }
}

async function getFileMd5Hash(bucketName, key) {
  try {
    const response = await _getClientForBucket(bucketName)
      .headObject({ Bucket: bucketName, Key: key })
      .promise()
    const md5 = _md5FromResponse(response)
    return md5
  } catch (err) {
    throw _wrapError(
      err,
      'error getting hash of s3 object',
      { bucketName, key },
      ReadError
    )
  }
}

async function deleteFile(bucketName, key) {
  try {
    await _getClientForBucket(bucketName)
      .deleteObject({ Bucket: bucketName, Key: key })
      .promise()
  } catch (err) {
    // s3 does not give us a NotFoundError here
    throw _wrapError(
      err,
      'failed to delete file in S3',
      { bucketName, key },
      WriteError
    )
  }
}

async function copyFile(bucketName, sourceKey, destKey) {
  const params = {
    Bucket: bucketName,
    Key: destKey,
    CopySource: `${bucketName}/${sourceKey}`
  }
  try {
    await _getClientForBucket(bucketName)
      .copyObject(params)
      .promise()
  } catch (err) {
    throw _wrapError(err, 'failed to copy file in S3', params, WriteError)
  }
}

async function checkIfFileExists(bucketName, key) {
  try {
    await getFileSize(bucketName, key)
    return true
  } catch (err) {
    if (err instanceof NotFoundError) {
      return false
    }
    throw _wrapError(
      err,
      'error checking whether S3 object exists',
      { bucketName, key },
      ReadError
    )
  }
}

async function directorySize(bucketName, key) {
  try {
    const response = await _getClientForBucket(bucketName)
      .listObjects({ Bucket: bucketName, Prefix: key })
      .promise()

    return response.Contents.reduce((acc, item) => item.Size + acc, 0)
  } catch (err) {
    throw _wrapError(
      err,
      'error getting directory size in S3',
      { bucketName, key },
      ReadError
    )
  }
}

function _wrapError(error, message, params, ErrorType) {
  // the AWS client can return one of 'NoSuchKey', 'NotFound' or 404 (integer)
  // when something is not found, depending on the endpoint
  if (
    ['NoSuchKey', 'NotFound', 404, 'AccessDenied', 'ENOENT'].includes(
      error.code
    )
  ) {
    return new NotFoundError({
      message: 'no such file',
      info: params
    }).withCause(error)
  } else {
    return new ErrorType({
      message: message,
      info: params
    }).withCause(error)
  }
}

const _clients = new Map()
let _defaultClient

function _getClientForBucket(bucket) {
  if (_clients[bucket]) {
    return _clients[bucket]
  }

  if (
    settings.filestore.s3BucketCreds &&
    settings.filestore.s3BucketCreds[bucket]
  ) {
    _clients[bucket] = new S3(
      _buildClientOptions(settings.filestore.s3BucketCreds[bucket])
    )
    return _clients[bucket]
  }

  // no specific credentials for the bucket
  if (_defaultClient) {
    return _defaultClient
  }

  if (settings.filestore.s3.key) {
    _defaultClient = new S3(_buildClientOptions())
    return _defaultClient
  }

  throw new SettingsError({
    message: 'no bucket-specific or default credentials provided',
    info: { bucket }
  })
}

function _buildClientOptions(bucketCredentials) {
  const options = {}

  if (bucketCredentials) {
    options.credentials = {
      accessKeyId: bucketCredentials.auth_key,
      secretAccessKey: bucketCredentials.auth_secret
    }
  } else {
    options.credentials = {
      accessKeyId: settings.filestore.s3.key,
      secretAccessKey: settings.filestore.s3.secret
    }
  }

  if (settings.filestore.s3.endpoint) {
    const endpoint = new URL(settings.filestore.s3.endpoint)
    options.endpoint = settings.filestore.s3.endpoint
    options.sslEnabled = endpoint.protocol === 'https'
  }

  // path-style access is only used for acceptance tests
  if (settings.filestore.s3.pathStyle) {
    options.s3ForcePathStyle = true
  }

  return options
}

function _md5FromResponse(response) {
  const md5 = (response.ETag || '').replace(/[ "]/g, '')
  if (!md5.match(/^[a-f0-9]{32}$/)) {
    throw new ReadError({
      message: 's3 etag not in md5-hash format',
      info: {
        md5,
        eTag: response.ETag
      }
    })
  }

  return md5
}
