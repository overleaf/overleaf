// @ts-check
'use strict'

const assert = require('check-types').assert

const FileData = require('./')
const CommentList = require('./comment_list')
const TrackedChangeList = require('./tracked_change_list')

/**
 * @typedef {import("../types").StringFileRawData} StringFileRawData
 * @typedef {import("../types").RawFileData} RawFileData
 * @typedef {import("../operation/edit_operation")} EditOperation
 * @typedef {import("../types").BlobStore} BlobStore
 * @typedef {import("../types").CommentRawData} CommentRawData
 * @typedef {import("../types").TrackedChangeRawData} TrackedChangeRawData
 * @typedef {import('../types').RangesBlob} RangesBlob
 */

class StringFileData extends FileData {
  /**
   * @param {string} content
   * @param {CommentRawData[]} [rawComments]
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
    /** @type StringFileRawData */
    const raw = { content: this.content }

    if (this.comments.length) {
      raw.comments = this.comments.toRaw()
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

  /**
   * @inheritdoc
   * @param {import('../file').FileGetContentOptions} [opts]
   */
  getContent(opts = {}) {
    let content = ''
    let cursor = 0
    if (opts.filterTrackedDeletes) {
      for (const tc of this.trackedChanges.asSorted()) {
        if (tc.tracking.type !== 'delete') {
          continue
        }
        if (cursor < tc.range.start) {
          content += this.content.slice(cursor, tc.range.start)
        }
        // skip the tracked change
        cursor = tc.range.end
      }
    }
    if (cursor < this.content.length) {
      content += this.content.slice(cursor)
    }
    return content
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
    return this.comments
  }

  /** @inheritdoc */
  getTrackedChanges() {
    return this.trackedChanges
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
   * @return {Promise<RawFileData>}
   */
  async store(blobStore) {
    const blob = await blobStore.putString(this.content)
    if (this.comments.comments.size || this.trackedChanges.length) {
      /** @type {RangesBlob} */
      const ranges = {
        comments: this.getComments().toRaw(),
        trackedChanges: this.trackedChanges.toRaw(),
      }
      const rangesBlob = await blobStore.putObject(ranges)
      // TODO(das7pad): Provide interface that guarantees hash exists?
      // @ts-ignore
      return { hash: blob.getHash(), rangesHash: rangesBlob.getHash() }
    }
    // TODO(das7pad): Provide interface that guarantees hash exists?
    // @ts-ignore
    return { hash: blob.getHash() }
  }
}

module.exports = StringFileData
