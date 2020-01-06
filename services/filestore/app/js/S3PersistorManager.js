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
const { WriteError, ReadError, NotFoundError } = require('./Errors')

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

const _client = new S3(_defaultOptions())

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

    const response = await _client
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
    const stream = _client.getObject(params).createReadStream()

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
    response = await _client
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
      await _client
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
    const response = await _client
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
    await _client.deleteObject({ Bucket: bucketName, Key: key }).promise()
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
    await _client.copyObject(params).promise()
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
    const response = await _client
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
  if (['NoSuchKey', 'NotFound', 'ENOENT'].includes(error.code)) {
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

function _defaultOptions() {
  const options = {
    credentials: {
      accessKeyId: settings.filestore.s3.key,
      secretAccessKey: settings.filestore.s3.secret
    }
  }

  if (settings.filestore.s3.endpoint) {
    const endpoint = new URL(settings.filestore.s3.endpoint)
    options.endpoint = settings.filestore.s3.endpoint
    options.sslEnabled = endpoint.protocol === 'https'
  }

  return options
}
