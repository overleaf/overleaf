const http = require('http')
const https = require('https')
http.globalAgent.maxSockets = 300
https.globalAgent.maxSockets = 300

const settings = require('settings-sharelatex')
const logger = require('logger-sharelatex')
const metrics = require('metrics-sharelatex')

const meter = require('stream-meter')
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
    deleteDirectory,
    getFileSize,
    deleteFile,
    copyFile,
    checkIfFileExists,
    directorySize
  }
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

async function sendStream(bucketName, key, readStream) {
  try {
    const meteredStream = meter()
    meteredStream.on('finish', () => {
      metrics.count('s3.egress', meteredStream.bytes)
    })

    const response = await _getClientForBucket(bucketName)
      .upload({
        Bucket: bucketName,
        Key: key,
        Body: readStream.pipe(meteredStream)
      })
      .promise()

    logger.log({ response, bucketName, key }, 'data uploaded to s3')
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
  logger.log({ key, bucketName }, 'deleting directory')
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

async function deleteFile(bucketName, key) {
  try {
    await _getClientForBucket(bucketName)
      .deleteObject({ Bucket: bucketName, Key: key })
      .promise()
  } catch (err) {
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
  if (
    ['NoSuchKey', 'NotFound', 'AccessDenied', 'ENOENT'].includes(error.code)
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
