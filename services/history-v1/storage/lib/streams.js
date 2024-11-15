// @ts-check
/**
 * Promises are promises and streams are streams, and ne'er the twain shall
 * meet.
 * @module
 */
'use strict'

const Stream = require('node:stream')
const zlib = require('node:zlib')
const { WritableBuffer } = require('@overleaf/stream-utils')

/**
 * Create a promise for the result of reading a stream to a buffer.
 *
 * @param {Stream.Readable} readStream
 * @return {Promise<Buffer>}
 */
async function readStreamToBuffer(readStream) {
  const bufferStream = new WritableBuffer()
  await Stream.promises.pipeline(readStream, bufferStream)
  return bufferStream.contents()
}

exports.readStreamToBuffer = readStreamToBuffer

/**
 * Create a promise for the result of un-gzipping a stream to a buffer.
 *
 * @param {NodeJS.ReadableStream} readStream
 * @return {Promise<Buffer>}
 */
async function gunzipStreamToBuffer(readStream) {
  const gunzip = zlib.createGunzip()
  const bufferStream = new WritableBuffer()
  await Stream.promises.pipeline(readStream, gunzip, bufferStream)
  return bufferStream.contents()
}

exports.gunzipStreamToBuffer = gunzipStreamToBuffer
