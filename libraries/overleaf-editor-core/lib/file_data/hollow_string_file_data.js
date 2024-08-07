// @ts-check
'use strict'

/**
 * @typedef {import('../operation/edit_operation')} EditOperation
 */
const assert = require('check-types').assert

const FileData = require('./')

/**
 * @typedef {import('../types').RawHollowStringFileData} RawHollowStringFileData
 */

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

  /**
   * @param {RawHollowStringFileData} raw
   * @returns {HollowStringFileData}
   */
  static fromRaw(raw) {
    return new HollowStringFileData(raw.stringLength)
  }

  /**
   * @inheritdoc
   * @returns {RawHollowStringFileData}
   */
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
  async toHollow() {
    return this
  }

  /**
   * @inheritdoc
   * @param {EditOperation} operation
   */
  edit(operation) {
    this.stringLength = operation.applyToLength(this.stringLength)
  }
}

module.exports = HollowStringFileData
