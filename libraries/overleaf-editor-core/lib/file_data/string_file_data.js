'use strict'

const assert = require('check-types').assert
const BPromise = require('bluebird')

const FileData = require('./')

/**
 * @typedef {import("../types").StringFileRawData} StringFileRawData
 */

class StringFileData extends FileData {
  /**
   * @constructor
   * @param {string} content
   */
  constructor(content) {
    super()
    assert.string(content)
    this.content = content
  }

  static fromRaw(raw) {
    return new StringFileData(raw.content)
  }

  /**
   * @inheritdoc
   * @returns {StringFileRawData}
   */
  toRaw() {
    return { content: this.content }
  }

  /** @inheritdoc */
  isEditable() {
    return true
  }

  /** @inheritdoc */
  getContent() {
    return this.content
  }

  /** @inheritdoc */
  getByteLength() {
    return Buffer.byteLength(this.content)
  }

  /** @inheritdoc */
  getStringLength() {
    return this.content.length
  }

  /** @inheritdoc */
  edit(textOperation) {
    this.content = textOperation.apply(this.content)
  }

  /** @inheritdoc */
  toEager() {
    return BPromise.resolve(this)
  }

  /** @inheritdoc */
  toHollow() {
    return BPromise.try(() =>
      FileData.createHollow(this.getByteLength(), this.getStringLength())
    )
  }

  /** @inheritdoc */
  store(blobStore) {
    return blobStore.putString(this.content).then(function (blob) {
      return { hash: blob.getHash() }
    })
  }
}

module.exports = StringFileData
