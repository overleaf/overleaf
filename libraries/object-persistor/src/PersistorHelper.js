const Crypto = require('crypto')
const Stream = require('stream')
const { pipeline } = require('stream/promises')
const Logger = require('@overleaf/logger')
const Metrics = require('@overleaf/metrics')
const { WriteError, NotFoundError } = require('./Errors')

/**
 * Observes data that passes through and optionally computes hash for content.
 */
class ObserverStream extends Stream.Transform {
  /**
   * @param {string} metric prefix for metrics
   * @param {string} hash optional hash algorithm, e.g. 'md5'
   */
  constructor({ metric, hash = '' }) {
    super({ autoDestroy: true })

    this.bytes = 0

    if (hash) {
      this.hash = Crypto.createHash(hash)
    }

    const onEnd = () => {
      Metrics.count(metric, this.bytes)
    }
    this.once('error', onEnd)
    this.once('end', onEnd)
  }

  _transform(chunk, encoding, done) {
    if (this.hash) {
      this.hash.update(chunk)
    }
    this.bytes += chunk.length
    this.push(chunk)
    done()
  }

  getHash() {
    return this.hash && this.hash.digest('hex')
  }
}

module.exports = {
  ObserverStream,
  calculateStreamMd5,
  verifyMd5,
  wrapError,
  hexToBase64,
  base64ToHex,
}

// returns a promise which resolves with the md5 hash of the stream
// - consumes the stream
async function calculateStreamMd5(stream) {
  const hash = Crypto.createHash('md5')
  hash.setEncoding('hex')

  await pipeline(stream, hash)
  return hash.read()
}

// verifies the md5 hash of a file against the supplied md5 or the one stored in
// storage if not supplied - deletes the new file if the md5 does not match and
// throws an error
async function verifyMd5(persistor, bucket, key, sourceMd5, destMd5 = null) {
  if (!destMd5) {
    destMd5 = await persistor.getObjectMd5Hash(bucket, key)
  }

  if (sourceMd5 !== destMd5) {
    try {
      await persistor.deleteObject(bucket, key)
    } catch (err) {
      Logger.warn(err, 'error deleting file for invalid upload')
    }

    throw new WriteError('source and destination hashes do not match', {
      sourceMd5,
      destMd5,
      bucket,
      key,
    })
  }
}

function wrapError(error, message, params, ErrorType) {
  if (
    error instanceof NotFoundError ||
    ['NoSuchKey', 'NotFound', 404, 'AccessDenied', 'ENOENT'].includes(
      error.code
    ) ||
    (error.response && error.response.statusCode === 404)
  ) {
    return new NotFoundError('no such file', params, error)
  } else {
    return new ErrorType(message, params, error)
  }
}

function base64ToHex(base64) {
  return Buffer.from(base64, 'base64').toString('hex')
}

function hexToBase64(hex) {
  return Buffer.from(hex, 'hex').toString('base64')
}
