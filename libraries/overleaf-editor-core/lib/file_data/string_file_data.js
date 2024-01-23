// @ts-check
'use strict'

const assert = require('check-types').assert

const FileData = require('./')
const CommentList = require('./comment_list')

/**
 * @typedef {import("../types").StringFileRawData} StringFileRawData
 * @typedef {import("../operation/edit_operation")} EditOperation
 * @typedef {import("../types").BlobStore} BlobStore
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

  /**
   * @inheritdoc
   * @param {EditOperation} operation */
  edit(operation) {
    operation.apply(this)
  }

  /** @inheritdoc */
  getComments() {
    return this.comments.getComments()
  }

  /**
   * @inheritdoc
   * @returns {Promise<StringFileData>}
   */
  async toEager() {
    return this
  }

  /** @inheritdoc */
  async toHollow() {
    return FileData.createHollow(this.getByteLength(), this.getStringLength())
  }

  /**
   * @inheritdoc
   * @param {BlobStore} blobStore
   */
  async store(blobStore) {
    const blob = await blobStore.putString(this.content)
    return { hash: blob.getHash() }
  }
}

module.exports = StringFileData
