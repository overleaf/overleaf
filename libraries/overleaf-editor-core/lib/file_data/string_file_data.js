'use strict'

const assert = require('check-types').assert

const FileData = require('./')
const CommentList = require('./comment_list')

/**
 * @typedef {import("../types").StringFileRawData} StringFileRawData
 * @typedef {import("../types").CommentRawData} CommentRawData
 */

class StringFileData extends FileData {
  /**
   * @param {string} content
   * @param {CommentRawData[]} [rawComments]
   */
  constructor(content, rawComments = []) {
    super()
    assert.string(content)
    this.content = content
    this.comments = CommentList.fromRaw(rawComments)
  }

  /**
   * @param {StringFileRawData} raw
   * @returns {StringFileData}
   */
  static fromRaw(raw) {
    return new StringFileData(raw.content, raw.comments || [])
  }

  /**
   * @inheritdoc
   * @returns {StringFileRawData}
   */
  toRaw() {
    const raw = { content: this.content }

    const comments = this.getComments()
    if (comments.length) {
      raw.comments = comments
    }

    return raw
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
  getComments() {
    return this.comments.getComments()
  }

  /** @inheritdoc */
  async toEager() {
    return this
  }

  /** @inheritdoc */
  async toHollow() {
    return FileData.createHollow(this.getByteLength(), this.getStringLength())
  }

  /** @inheritdoc */
  async store(blobStore) {
    const blob = await blobStore.putString(this.content)
    return { hash: blob.getHash() }
  }
}

module.exports = StringFileData
