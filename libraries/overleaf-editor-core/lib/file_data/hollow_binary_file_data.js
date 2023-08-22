'use strict'

const assert = require('check-types').assert

const FileData = require('./')

class HollowBinaryFileData extends FileData {
  /**
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
  async toHollow() {
    return this
  }
}

module.exports = HollowBinaryFileData
