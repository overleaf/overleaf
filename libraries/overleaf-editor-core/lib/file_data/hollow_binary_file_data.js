'use strict'

const assert = require('check-types').assert
const BPromise = require('bluebird')

const FileData = require('./')

class HollowBinaryFileData extends FileData {
  /**
   * @constructor
   * @param {number} byteLength
   * @see FileData
   */
  constructor(byteLength) {
    super()
    assert.integer(byteLength, 'HollowBinaryFileData: bad byteLength')
    assert.greaterOrEqual(byteLength, 0, 'HollowBinaryFileData: low byteLength')
    this.byteLength = byteLength
  }

  static fromRaw(raw) {
    return new HollowBinaryFileData(raw.byteLength)
  }

  /** @inheritdoc */
  toRaw() {
    return { byteLength: this.byteLength }
  }

  /** @inheritdoc */
  getByteLength() {
    return this.byteLength
  }

  /** @inheritdoc */
  isEditable() {
    return false
  }

  /** @inheritdoc */
  toHollow() {
    return BPromise.resolve(this)
  }
}

module.exports = HollowBinaryFileData
