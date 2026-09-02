// @ts-check
'use strict'

/**
 * What history needs to know about a piece of content before it can store it:
 * the hash it is addressed by, whether its bytes count as editable text, and,
 * for content already written to disk, both at once as a {@link Blob}.
 *
 * This module is Node-only: it hashes with node:crypto, reads files and
 * validates UTF-8 with a native addon. It must never be reachable from
 * index.js, because overleaf-editor-core is bundled for the browser. Consumers
 * deep import it, which the package exports allow:
 *
 *     require('overleaf-editor-core/lib/blob_utils')
 */

const crypto = require('node:crypto')
const fs = require('node:fs')
const { pipeline } = require('node:stream/promises')
const isValidUtf8 = require('utf-8-validate')

const Blob = require('./blob')
const TextOperation = require('./operation/text_operation')
const { containsNonBmpChars } = require('./util')

/**
 * @param {number} byteLength
 * @return {crypto.Hash}
 */
function createBlobHash(byteLength) {
  if (!Number.isInteger(byteLength) || byteLength < 0) {
    // Without this the header carries "blob NaN\0" and the digest is a
    // plausible-looking hash of nothing in particular.
    throw new TypeError(`blobHash: bad byteLength: ${byteLength}`)
  }
  const hash = crypto.createHash('sha1')
  hash.setEncoding('hex')
  hash.update('blob ' + byteLength + '\x00')
  return hash
}

/**
 * The git blob hash: sha1("blob " + byteLength + "\0" + content).
 *
 * This is how history-v1 addresses blobs, and it is byte-for-byte git's own
 * blob object hash, so the hash history stores for a file is also the sha that
 * file has in a git repository. {@link File.EMPTY_FILE_HASH} is git's empty-blob
 * hash for the same reason.
 *
 * @param {string} string
 * @return {string} hexadecimal SHA-1 hash
 */
function blobHashFromString(string) {
  // The header counts bytes, not characters. Hashing the string length instead
  // makes every non-ASCII file disagree with git and with history.
  const hash = createBlobHash(Buffer.byteLength(string))
  hash.update(string, 'utf8')
  hash.end()
  return /** @type {string} */ (hash.read())
}

/**
 * @param {Buffer} buffer
 * @return {string} hexadecimal SHA-1 hash
 */
function blobHashFromBuffer(buffer) {
  const hash = createBlobHash(buffer.byteLength)
  hash.update(buffer)
  hash.end()
  return /** @type {string} */ (hash.read())
}

/**
 * @param {number} byteLength
 * @param {NodeJS.ReadableStream} stream the interface, not the class: what a
 *        caller has is often whatever its storage handed it
 * @return {Promise<string>} hexadecimal SHA-1 hash
 */
async function blobHashFromStream(byteLength, stream) {
  const hash = createBlobHash(byteLength)
  // pipeline ends the hash stream, which flushes the digest to its readable
  // side. Ending it again here would emit ERR_STREAM_ALREADY_FINISHED.
  await pipeline(stream, hash)
  return /** @type {string} */ (hash.read())
}

/**
 * @param {string} pathname
 * @return {Promise<string>} hexadecimal SHA-1 hash
 */
async function blobHashFromFile(pathname) {
  // A file can be tens of megabytes, so the content is streamed rather than
  // read into memory. The header needs the byte length up front, hence the stat.
  const { size } = await fs.promises.stat(pathname)
  return await blobHashFromStream(size, fs.createReadStream(pathname))
}

/**
 * The rule that decides whether the content of a blob counts as editable text,
 * and if so what string length to record on the {@link Blob}.
 *
 * @param {Buffer} buffer
 * @return {number | null} the string length, or null when the content is not
 *         editable text
 */
function getStringLengthOfBuffer(buffer) {
  if (!isValidUtf8(buffer)) return null
  const data = buffer.toString()
  if (data.length > TextOperation.MAX_STRING_LENGTH) return null
  // We cannot edit files containing non-BMP or null characters.
  if (containsNonBmpChars(data)) return null
  if (data.indexOf('\x00') !== -1) return null
  return data.length
}

/**
 * @param {number} byteLength
 * @param {string} pathname
 * @return {Promise<number | null>} the string length, or null when the content
 *         is not editable text
 */
async function getStringLengthOfFile(byteLength, pathname) {
  // We have to read the file into memory to get its UTF-8 length, so don't
  // bother for files that are too large for us to edit anyway.
  if (byteLength > Blob.MAX_EDITABLE_BYTE_LENGTH_BOUND) {
    return null
  }

  return getStringLengthOfBuffer(await fs.promises.readFile(pathname))
}

/**
 * The blob a local file amounts to: the hash its content is addressed by, its
 * byte length, and the string length, left off when the content is not editable
 * text.
 *
 * @param {string} pathname
 * @return {Promise<Blob>}
 */
async function blobForFile(pathname) {
  const { size: byteLength } = await fs.promises.stat(pathname)
  const [hash, stringLength] = await Promise.all([
    blobHashFromStream(byteLength, fs.createReadStream(pathname)),
    getStringLengthOfFile(byteLength, pathname),
  ])
  return new Blob(hash, byteLength, stringLength ?? undefined)
}

module.exports = {
  blobHashFromString,
  blobHashFromBuffer,
  blobHashFromStream,
  blobHashFromFile,
  getStringLengthOfBuffer,
  getStringLengthOfFile,
  blobForFile,
}
