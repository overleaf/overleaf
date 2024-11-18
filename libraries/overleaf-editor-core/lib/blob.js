'use strict'

const assert = require('check-types').assert
const OError = require('@overleaf/o-error')

const TextOperation = require('./operation/text_operation')

class NotFoundError extends OError {
  constructor(hash) {
    super(`blob ${hash} not found`, { hash })
    this.hash = hash
  }
}

/**
 * Metadata record for the content of a file.
 */
class Blob {
  static HEX_HASH_RX_STRING = '^[0-9a-f]{40,40}$'
  static HEX_HASH_RX = new RegExp(Blob.HEX_HASH_RX_STRING)

  /**
   * Size of the largest file that we'll read to determine whether we can edit it
   * or not, in bytes. The final decision on whether a file is editable or not is
   * based on the number of characters it contains, but we need to read the file
   * in to determine that; so it is useful to have an upper bound on the byte
   * length of a file that might be editable.
   *
   * The reason for the factor of 3 is as follows. We cannot currently edit files
   * that contain characters outside of the basic multilingual plane, so we're
   * limited to characters that can be represented in a single, two-byte UCS-2
   * code unit. Encoding the largest such value, 0xFFFF (which is not actually
   * a valid character), takes three bytes in UTF-8: 0xEF 0xBF 0xBF. A file
   * composed entirely of three-byte UTF-8 codepoints is the worst case; in
   * practice, this is a very conservative upper bound.
   *
   * @type {number}
   */
  static MAX_EDITABLE_BYTE_LENGTH_BOUND = 3 * TextOperation.MAX_STRING_LENGTH

  static NotFoundError = NotFoundError

  /**
   * @param {string} hash
   * @param {number} byteLength
   * @param {number} [stringLength]
   */
  constructor(hash, byteLength, stringLength) {
    this.setHash(hash)
    this.setByteLength(byteLength)
    this.setStringLength(stringLength)
  }

  static fromRaw(raw) {
    if (raw) {
      return new Blob(raw.hash, raw.byteLength, raw.stringLength)
    }
    return null
  }

  toRaw() {
    return {
      hash: this.hash,
      byteLength: this.byteLength,
      stringLength: this.stringLength,
    }
  }

  /**
   * Hex hash.
   * @return {String}
   */
  getHash() {
    return this.hash
  }

  setHash(hash) {
    assert.match(hash, Blob.HEX_HASH_RX, 'bad hash')
    this.hash = hash
  }

  /**
   * Length of the blob in bytes.
   * @return {number}
   */
  getByteLength() {
    return this.byteLength
  }

  setByteLength(byteLength) {
    assert.integer(byteLength, 'bad byteLength')
    this.byteLength = byteLength
  }

  /**
   * Utf-8 length of the blob content, if it appears to be valid UTF-8.
   * @return {number|undefined}
   */
  getStringLength() {
    return this.stringLength
  }

  setStringLength(stringLength) {
    assert.maybe.integer(stringLength, 'bad stringLength')
    this.stringLength = stringLength
  }
}

module.exports = Blob
