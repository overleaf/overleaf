'use strict'

const assert = require('check-types').assert
const OError = require('@overleaf/o-error')

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
   * This used to be 3 times the max editable file length to account for 3-byte
   * UTF-8 codepoints. However, editable file blobs now include tracked deletes
   * and the system used to allow unlimited tracked deletes on a single file.
   * A practical limit is the 16 MB Mongo size limit. It wouldn't have been
   * possible to store more than 16 MB of tracked deletes. We therefore fall
   * back to this limit.
   */
  static MAX_EDITABLE_BYTE_LENGTH_BOUND = 16 * 1024 * 1024

  static NotFoundError = NotFoundError

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
   * @return {?String}
   */
  getHash() {
    return this.hash
  }

  setHash(hash) {
    assert.maybe.match(hash, Blob.HEX_HASH_RX, 'bad hash')
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
    assert.maybe.integer(byteLength, 'bad byteLength')
    this.byteLength = byteLength
  }

  /**
   * Utf-8 length of the blob content, if it appears to be valid UTF-8.
   * @return {?number}
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
