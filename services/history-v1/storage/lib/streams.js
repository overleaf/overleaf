/**
 * Promises are promises and streams are streams, and ne'er the twain shall
 * meet.
 * @module
 */
'use strict'

const BPromise = require('bluebird')
const zlib = require('zlib')
const stringToStream = require('string-to-stream')
const { pipeline, Writable } = require('stream')

function promisePipe(readStream, writeStream) {
  return new BPromise(function (resolve, reject) {
    pipeline(readStream, writeStream, function (err) {
      if (err) {
        reject(err)
      } else {
        resolve()
      }
    })
  })
}

/**
 * Pipe a read stream to a write stream. The promise resolves when the write
 * stream finishes.
 *
 * @function
 * @param {stream.Readable} readStream
 * @param {stream.Writable} writeStream
 * @return {Promise}
 */
exports.promisePipe = promisePipe

class WritableBuffer extends Writable {
  constructor(options) {
    super(options)
    this.buffers = []
  }

  _write(chunk, encoding, callback) {
    this.buffers.push(chunk)
    callback()
  }

  _final(callback) {
    callback()
  }

  contents() {
    return Buffer.concat(this.buffers)
  }
}

function readStreamToBuffer(readStream) {
  return new BPromise(function (resolve, reject) {
    const bufferStream = new WritableBuffer()
    pipeline(readStream, bufferStream, function (err) {
      if (err) {
        reject(err)
      } else {
        resolve(bufferStream.contents())
      }
    })
  })
}

/**
 * Create a promise for the result of reading a stream to a buffer.
 *
 * @function
 * @param {stream.Readable} readStream
 * @return {Promise.<Buffer>}
 */
exports.readStreamToBuffer = readStreamToBuffer

function gunzipStreamToBuffer(readStream) {
  const gunzip = zlib.createGunzip()
  const bufferStream = new WritableBuffer()
  return new BPromise(function (resolve, reject) {
    pipeline(readStream, gunzip, bufferStream, function (err) {
      if (err) {
        reject(err)
      } else {
        resolve(bufferStream.contents())
      }
    })
  })
}

/**
 * Create a promise for the result of un-gzipping a stream to a buffer.
 *
 * @function
 * @param {stream.Readable} readStream
 * @return {Promise.<Buffer>}
 */
exports.gunzipStreamToBuffer = gunzipStreamToBuffer

function gzipStringToStream(string) {
  const gzip = zlib.createGzip()
  return stringToStream(string).pipe(gzip)
}

/**
 * Create a write stream that gzips the given string.
 *
 * @function
 * @param {string} string
 * @return {stream.Writable}
 */
exports.gzipStringToStream = gzipStringToStream
