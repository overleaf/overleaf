const crypto = require('crypto')
const metrics = require('metrics-sharelatex')
const meter = require('stream-meter')
const Stream = require('stream')
const logger = require('logger-sharelatex')
const { WriteError, ReadError, NotFoundError } = require('./Errors')
const { promisify } = require('util')

const pipeline = promisify(Stream.pipeline)

module.exports = {
  calculateStreamMd5,
  verifyMd5,
  getMeteredStream,
  waitForStreamReady,
  wrapError,
  hexToBase64,
  base64ToHex
}

// returns a promise which resolves with the md5 hash of the stream
function calculateStreamMd5(stream) {
  const hash = crypto.createHash('md5')
  hash.setEncoding('hex')

  return pipeline(stream, hash).then(() => hash.read())
}

// verifies the md5 hash of a file against the supplied md5 or the one stored in
// storage if not supplied - deletes the new file if the md5 does not match and
// throws an error
async function verifyMd5(persistor, bucket, key, sourceMd5, destMd5 = null) {
  if (!destMd5) {
    destMd5 = await persistor.promises.getFileMd5Hash(bucket, key)
  }

  if (sourceMd5 !== destMd5) {
    try {
      await persistor.promises.deleteFile(bucket, key)
    } catch (err) {
      logger.warn(err, 'error deleting file for invalid upload')
    }

    throw new WriteError({
      message: 'source and destination hashes do not match',
      info: {
        sourceMd5,
        destMd5,
        bucket,
        key
      }
    })
  }
}

// returns the next stream in the pipeline, and calls the callback with the byte count
// when the stream finishes or receives an error
function getMeteredStream(stream, metricName) {
  const meteredStream = meter()

  pipeline(stream, meteredStream)
    .then(() => {
      metrics.count(metricName, meteredStream.bytes)
    })
    .catch(() => {
      // on error, just send how many bytes we received before the stream stopped
      metrics.count(metricName, meteredStream.bytes)
    })

  return meteredStream
}

// resolves when a stream is 'readable', or rejects if the stream throws an error
// before that happens - this lets us handle protocol-level errors before trying
// to read them
function waitForStreamReady(stream) {
  return new Promise((resolve, reject) => {
    const onError = function(err) {
      reject(wrapError(err, 'error before stream became ready', {}, ReadError))
    }
    const onStreamReady = function() {
      stream.removeListener('readable', onStreamReady)
      stream.removeListener('error', onError)
      resolve(stream)
    }
    stream.on('readable', onStreamReady)
    stream.on('error', onError)
  })
}

function wrapError(error, message, params, ErrorType) {
  if (
    error instanceof NotFoundError ||
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

function base64ToHex(base64) {
  return Buffer.from(base64, 'base64').toString('hex')
}

function hexToBase64(hex) {
  return Buffer.from(hex, 'hex').toString('base64')
}
