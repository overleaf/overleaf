/**
 * Promises are promises and streams are streams, and ne'er the twain shall
 * meet.
 * @module
 */
'use strict'

const BPromise = require('bluebird')
const zlib = require('zlib')
const stringToStream = require('string-to-stream')

function promiseWriteStreamFinish(writeStream) {
  return new BPromise(function (resolve, reject) {
    writeStream.on('finish', resolve)
    writeStream.on('error', reject)
  })
}

function promisePipe(readStream, writeStream) {
  readStream.pipe(writeStream)
  return promiseWriteStreamFinish(writeStream)
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

function readStreamToBuffer(readStream) {
  return new BPromise(function (resolve, reject) {
    const buffers = []
    readStream.on('readable', function () {
      while (true) {
        const buffer = this.read()
        if (!buffer) {
          break
        }
        buffers.push(buffer)
      }
    })
    readStream.on('end', function () {
      resolve(Buffer.concat(buffers))
    })
    readStream.on('error', reject)
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
  const gunzipStream = readStream.pipe(gunzip)
  return new BPromise(function (resolve, reject) {
    const buffers = []
    gunzipStream.on('data', function (buffer) {
      buffers.push(buffer)
    })
    gunzipStream.on('end', function () {
      resolve(Buffer.concat(buffers))
    })
    readStream.on('error', reject)
    gunzipStream.on('error', reject)
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
