/** @module */
'use strict'

const BPromise = require('bluebird')
const fs = BPromise.promisifyAll(require('node:fs'))
const crypto = require('node:crypto')
const { pipeline } = require('node:stream')
const assert = require('./assert')

function getGitBlobHeader(byteLength) {
  return 'blob ' + byteLength + '\x00'
}

function getBlobHash(byteLength) {
  const hash = crypto.createHash('sha1')
  hash.setEncoding('hex')
  hash.update(getGitBlobHeader(byteLength))
  return hash
}

/**
 * Compute the git blob hash for a blob from a readable stream of its content.
 *
 * @function
 * @param  {number} byteLength
 * @param  {stream.Readable} stream
 * @return {Promise.<string>} hexadecimal SHA-1 hash
 */
exports.fromStream = BPromise.method(
  function blobHashFromStream(byteLength, stream) {
    assert.integer(byteLength, 'blobHash: bad byteLength')
    assert.object(stream, 'blobHash: bad stream')

    const hash = getBlobHash(byteLength)
    return new BPromise(function (resolve, reject) {
      pipeline(stream, hash, function (err) {
        if (err) {
          reject(err)
        } else {
          hash.end()
          resolve(hash.read())
        }
      })
    })
  }
)

/**
 * Compute the git blob hash for a blob with the given string content.
 *
 * @param  {string} string
 * @return {string} hexadecimal SHA-1 hash
 */
exports.fromString = function blobHashFromString(string) {
  assert.string(string, 'blobHash: bad string')
  const hash = getBlobHash(Buffer.byteLength(string))
  hash.update(string, 'utf8')
  hash.end()
  return hash.read()
}

/**
 * Compute the git blob hash for the content of a file
 *
 * @param  {string} filePath
 * @return {Promise<string>} hexadecimal SHA-1 hash
 */
exports.fromFile = function blobHashFromFile(pathname) {
  assert.string(pathname, 'blobHash: bad pathname')

  function getByteLengthOfFile() {
    return fs.statAsync(pathname).then(stat => stat.size)
  }

  const fromStream = this.fromStream
  return getByteLengthOfFile(pathname).then(function (byteLength) {
    const stream = fs.createReadStream(pathname)
    return fromStream(byteLength, stream)
  })
}
