// @ts-check
'use strict'

const assert = require('check-types').assert

const FileData = require('./')
const CommentList = require('./comment_list')
const TrackedChangeList = require('./tracked_change_list')

/**
 * @typedef {import("../types").StringFileRawData} StringFileRawData
 * @typedef {import("../operation/edit_operation")} EditOperation
 * @typedef {import("../types").BlobStore} BlobStore
 * @typedef {import("../types").CommentsListRawData} CommentsListRawData
 * @typedef {import("../types").TrackedChangeRawData} TrackedChangeRawData
 * @typedef {import('../types').RangesBlob} RangesBlob
 */

class StringFileData extends FileData {
  /**
   * @param {string} content
   * @param {CommentsListRawData} [rawComments]
   * @param {TrackedChangeRawData[]} [rawTrackedChanges]
   */
  constructor(content, rawComments = [], rawTrackedChanges = []) {
    super()
    assert.string(content)
    this.content = content
    this.comments = CommentList.fromRaw(rawComments)
    this.trackedChanges = TrackedChangeList.fromRaw(rawTrackedChanges)
  }

  /**
   * @param {StringFileRawData} raw
   * @returns {StringFileData}
   */
  static fromRaw(raw) {
    return new StringFileData(
      raw.content,
      raw.comments || [],
      raw.trackedChanges || []
    )
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

    if (this.trackedChanges.length) {
      raw.trackedChanges = this.trackedChanges.toRaw()
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
    if (this.comments.comments.size || this.trackedChanges.length) {
      /** @type {RangesBlob} */
      const ranges = {
        comments: this.getComments(),
        trackedChanges: this.trackedChanges.toRaw(),
      }
      const rangesBlob = await blobStore.putObject(ranges)
      return { hash: blob.getHash(), rangesHash: rangesBlob.getHash() }
    }
    return { hash: blob.getHash() }
  }
}

module.exports = StringFileData
