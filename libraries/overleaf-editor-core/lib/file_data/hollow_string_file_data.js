'use strict'

const assert = require('check-types').assert
const BPromise = require('bluebird')

const FileData = require('./')

class HollowStringFileData extends FileData {
  /**
   * @param {number} stringLength
   * @see FileData
   */
  constructor(stringLength) {
    super()
    assert.integer(stringLength, 'HollowStringFileData: bad stringLength')
    assert.greaterOrEqual(
      stringLength,
      0,
      'HollowStringFileData: low stringLength'
    )
    this.stringLength = stringLength
  }

  static fromRaw(raw) {
    return new HollowStringFileData(raw.stringLength)
  }

  /** @inheritdoc */
  toRaw() {
    return { stringLength: this.stringLength }
  }

  /** @inheritdoc */
  getStringLength() {
    return this.stringLength
  }

  /** @inheritdoc */
  isEditable() {
    return true
  }

  /** @inheritdoc */
  toHollow() {
    return BPromise.resolve(this)
  }

  /** @inheritdoc */
  edit(textOperation) {
    this.stringLength = textOperation.applyToLength(this.stringLength)
  }
}

module.exports = HollowStringFileData
