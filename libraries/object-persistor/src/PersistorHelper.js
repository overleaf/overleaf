const Crypto = require('node:crypto')
const Stream = require('node:stream')
const { pipeline } = require('node:stream/promises')
const Logger = require('@overleaf/logger')
const Metrics = require('@overleaf/metrics')
const { WriteError, NotFoundError, AlreadyWrittenError } = require('./Errors')

const _128KiB = 128 * 1024
const TIMING_BUCKETS = [
  0, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000,
]
const SIZE_BUCKETS = [
  0,
  1_000,
  10_000,
  100_000,
  _128KiB,
  1_000_000,
  10_000_000,
  50_000_000,
  100_000_000,
]

/**
 * Observes data that passes through and optionally computes hash for content.
 */
class ObserverStream extends Stream.Transform {
  /**
   * @param {Object} opts
   * @param {string} opts.metric prefix for metrics
   * @param {string} opts.bucket name of source/target bucket
   * @param {string} [opts.hash] optional hash algorithm, e.g. 'md5'
   */
  constructor(opts) {
    super({ autoDestroy: true })
    const { metric, bucket, hash = '' } = opts

    this.bytes = 0
    this.start = performance.now()

    if (hash) {
      this.hash = Crypto.createHash(hash)
    }

    const onEnd = status => {
      const size = this.bytes < _128KiB ? 'lt-128KiB' : 'gte-128KiB'
      const labels = { size, bucket, status }
      // Keep this counter metric to allow rendering long-term charts.
      Metrics.count(metric, this.bytes, 1, labels)
      Metrics.inc(`${metric}.hit`, 1, labels)

      if (status === 'error') return
      // The below metrics are only relevant for successfully fetched objects.

      Metrics.histogram(`${metric}.size`, this.bytes, SIZE_BUCKETS, {
        status,
        bucket,
      })
      if (this.firstByteAfterMs) {
        Metrics.histogram(
          `${metric}.latency.first-byte`,
          this.firstByteAfterMs,
          TIMING_BUCKETS,
          labels
        )
      }
      Metrics.histogram(
        `${metric}.latency`,
        this.#getMsSinceStart(),
        TIMING_BUCKETS,
        labels
      )
    }
    this.once('error', () => onEnd('error'))
    this.once('end', () => onEnd('success'))
  }

  #getMsSinceStart() {
    return performance.now() - this.start
  }

  _transform(chunk, encoding, done) {
    if (this.bytes === 0) {
      this.firstByteAfterMs = this.#getMsSinceStart()
    }
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
  params = {
    ...params,
    cause: error,
  }
  if (
    error instanceof NotFoundError ||
    ['NoSuchKey', 'NotFound', 404, 'AccessDenied', 'ENOENT'].includes(
      error.code
    ) ||
    (error.response && error.response.statusCode === 404)
  ) {
    return new NotFoundError('no such file', params, error)
  } else if (
    params.ifNoneMatch === '*' &&
    (error.code === 'PreconditionFailed' ||
      error.response?.statusCode === 412 ||
      error instanceof AlreadyWrittenError)
  ) {
    return new AlreadyWrittenError(message, params, error)
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
