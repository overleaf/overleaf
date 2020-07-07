const Crypto = require('crypto')
const Stream = require('stream')
const Logger = require('logger-sharelatex')
const { WriteError, ReadError, NotFoundError } = require('./Errors')
const { promisify } = require('util')

const pipeline = promisify(Stream.pipeline)

// Observes data that passes through and computes some metadata for it
// - specifically, it computes the number of bytes transferred, and optionally
//   computes a cryptographic hash based on the 'hash' option. e.g., pass
//   { hash: 'md5' } to compute the md5 hash of the stream
// - if 'metric' is supplied as an option, this metric will be incremented by
//   the number of bytes transferred
class ObserverStream extends Stream.Transform {
  constructor(options) {
    super({ autoDestroy: true, ...options })

    this.bytes = 0

    if (options.hash) {
      this.hash = Crypto.createHash(options.hash)
    }

    if (options.metric && options.Metrics) {
      const onEnd = () => {
        options.Metrics.count(options.metric, this.bytes)
      }
      this.once('error', onEnd)
      this.once('end', onEnd)
    }
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
  getReadyPipeline,
  wrapError,
  hexToBase64,
  base64ToHex
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
      key
    })
  }
}

// resolves when a stream is 'readable', or rejects if the stream throws an error
// before that happens - this lets us handle protocol-level errors before trying
// to read them
function getReadyPipeline(...streams) {
  return new Promise((resolve, reject) => {
    const lastStream = streams.slice(-1)[0]

    // in case of error or stream close, we must ensure that we drain the
    // previous stream so that it can clean up its socket (if it has one)
    const drainPreviousStream = function (previousStream) {
      // this stream is no longer reliable, so don't pipe anything more into it
      previousStream.unpipe(this)
      previousStream.resume()
    }

    // handler to resolve when either:
    // - an error happens, or
    // - the last stream in the chain is readable
    // for example, in the case of a 4xx error an error will occur and the
    // streams will not become readable
    const handler = function (err) {
      // remove handler from all streams because we don't want to do this on
      // later errors
      lastStream.removeListener('readable', handler)
      for (const stream of streams) {
        stream.removeListener('error', handler)
      }

      // return control to the caller
      if (err) {
        reject(
          wrapError(err, 'error before stream became ready', {}, ReadError)
        )
      } else {
        resolve(lastStream)
      }
    }

    // ensure the handler fires when the last strem becomes readable
    lastStream.on('readable', handler)

    for (const stream of streams) {
      // when a stream receives a pipe, set up the drain handler to drain the
      // connection if an error occurs or the stream is closed
      stream.on('pipe', (previousStream) => {
        stream.on('error', (x) => {
          drainPreviousStream(previousStream)
        })
        stream.on('close', () => {
          drainPreviousStream(previousStream)
        })
      })
      // add the handler function to resolve this method on error if we can't
      // set up the pipeline
      stream.on('error', handler)
    }

    // begin the pipeline
    for (let index = 0; index < streams.length - 1; index++) {
      streams[index].pipe(streams[index + 1])
    }
  })
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
