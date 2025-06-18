// @ts-check
'use strict'

const assert = require('check-types').assert

const FileData = require('./')
const CommentList = require('./comment_list')
const TrackedChangeList = require('./tracked_change_list')

/**
 * @import { StringFileRawData, RawHashFileData, BlobStore, CommentRawData } from "../types"
 * @import { TrackedChangeRawData, RangesBlob } from "../types"
 * @import EditOperation from "../operation/edit_operation"
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

  /**
   * Return docstore view of a doc: each line separated
   * @return {string[]}
   */
  getLines() {
    return this.getContent({ filterTrackedDeletes: true }).split('\n')
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
   * @return {Promise<RawHashFileData>}
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
      return { hash: blob.getHash(), rangesHash: rangesBlob.getHash() }
    }
    return { hash: blob.getHash() }
  }
}

module.exports = StringFileData
