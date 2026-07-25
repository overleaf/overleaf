// @ts-check
/**
 * Promises are promises and streams are streams, and ne'er the twain shall
 * meet.
 * @module
 */
'use strict'

const { pipeline } = require('node:stream/promises')
const zlib = require('node:zlib')
const { WritableBuffer } = require('@overleaf/stream-utils')

/**
 * Create a promise for the result of reading a stream to a buffer.
 *
 * @param {import('node:stream').Readable} readStream
 * @return {Promise<Buffer>}
 */
async function readStreamToBuffer(readStream) {
  const bufferStream = new WritableBuffer()
  await pipeline(readStream, bufferStream)
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
  await pipeline(readStream, gunzip, bufferStream)
  return bufferStream.contents()
}

exports.gunzipStreamToBuffer = gunzipStreamToBuffer
