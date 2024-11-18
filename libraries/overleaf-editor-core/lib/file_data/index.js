// @ts-check

'use strict'

const assert = require('check-types').assert

const Blob = require('../blob')

/**
 * @import { BlobStore, ReadonlyBlobStore, RawFileData, CommentRawData } from "../types"
 * @import EditOperation from "../operation/edit_operation"
 * @import CommentList from "../file_data/comment_list"
 * @import TrackedChangeList from "../file_data/tracked_change_list"
 */

/**
 * Helper to represent the content of a file. This class and its subclasses
 * should be used only through {@link File}.
 */
class FileData {
  /** @see File.fromRaw
   * @param {RawFileData} raw
   */
  static fromRaw(raw) {
    // TODO(das7pad): can we teach typescript to understand our polymorphism?
    if (Object.prototype.hasOwnProperty.call(raw, 'hash')) {
      if (Object.prototype.hasOwnProperty.call(raw, 'byteLength'))
        // @ts-ignore
        return BinaryFileData.fromRaw(raw)
      if (Object.prototype.hasOwnProperty.call(raw, 'stringLength'))
        // @ts-ignore
        return LazyStringFileData.fromRaw(raw)
      // @ts-ignore
      return HashFileData.fromRaw(raw)
    }
    if (Object.prototype.hasOwnProperty.call(raw, 'byteLength'))
      // @ts-ignore
      return HollowBinaryFileData.fromRaw(raw)
    if (Object.prototype.hasOwnProperty.call(raw, 'stringLength'))
      // @ts-ignore
      return HollowStringFileData.fromRaw(raw)
    if (Object.prototype.hasOwnProperty.call(raw, 'content'))
      // @ts-ignore
      return StringFileData.fromRaw(raw)
    throw new Error('FileData: bad raw object ' + JSON.stringify(raw))
  }

  /** @see File.createHollow
   * @param {number} byteLength
   * @param {number} [stringLength]
   */
  static createHollow(byteLength, stringLength) {
    if (stringLength == null) {
      return new HollowBinaryFileData(byteLength)
    }
    return new HollowStringFileData(stringLength)
  }

  /**
   * @see File.createLazyFromBlob
   * @param {Blob} blob
   * @param {Blob} [rangesBlob]
   */
  static createLazyFromBlobs(blob, rangesBlob) {
    assert.instance(blob, Blob, 'FileData: bad blob')
    const stringLength = blob.getStringLength()
    if (stringLength == null) {
      return new BinaryFileData(blob.getHash(), blob.getByteLength())
    }
    return new LazyStringFileData(
      blob.getHash(),
      rangesBlob?.getHash(),
      stringLength
    )
  }

  /**
   * @returns {RawFileData}
   */
  toRaw() {
    throw new Error('FileData: toRaw not implemented')
  }

  /**
   * @see File#getHash
   * @return {string | null | undefined}
   */

  getHash() {
    return null
  }

  /**
   * @see File#getHash
   * @return {string | null | undefined}
   */
  getRangesHash() {
    return null
  }

  /**
   * @see File#getContent
   * @param {import('../file').FileGetContentOptions} [opts]
   * @return {string | null | undefined}
   */
  getContent(opts = {}) {
    return null
  }

  /**
   * @see File#isEditable
   * @return {boolean | null | undefined} null if it is not currently known
   */
  isEditable() {
    return null
  }

  /**
   * @see File#getByteLength
   * @return {number | null | undefined}
   */
  getByteLength() {
    return null
  }

  /**
   * @see File#getStringLength
   * @return {number | null | undefined}
   */
  getStringLength() {
    return null
  }

  /**
   * @see File#edit
   * @param {EditOperation} editOperation
   */
  edit(editOperation) {
    throw new Error('edit not implemented for ' + JSON.stringify(this))
  }

  /**
   * @function
   * @param {ReadonlyBlobStore} blobStore
   * @return {Promise<FileData>}
   * @abstract
   * @see FileData#load
   */
  async toEager(blobStore) {
    throw new Error('toEager not implemented for ' + JSON.stringify(this))
  }

  /**
   * @function
   * @param {ReadonlyBlobStore} blobStore
   * @return {Promise<FileData>}
   * @abstract
   * @see FileData#load
   */
  async toLazy(blobStore) {
    throw new Error('toLazy not implemented for ' + JSON.stringify(this))
  }

  /**
   * @function
   * @param {ReadonlyBlobStore} blobStore
   * @return {Promise<FileData>}
   * @abstract
   * @see FileData#load
   */
  async toHollow(blobStore) {
    throw new Error('toHollow not implemented for ' + JSON.stringify(this))
  }

  /**
   * @see File#load
   * @param {string} kind
   * @param {ReadonlyBlobStore} blobStore
   * @return {Promise<FileData>}
   */
  async load(kind, blobStore) {
    if (kind === 'eager') return await this.toEager(blobStore)
    if (kind === 'lazy') return await this.toLazy(blobStore)
    if (kind === 'hollow') return await this.toHollow(blobStore)
    throw new Error('bad file data load kind: ' + kind)
  }

  /**
   * @see File#store
   * @function
   * @param {BlobStore} blobStore
   * @return {Promise<RawFileData>} a raw HashFile
   * @abstract
   */
  async store(blobStore) {
    throw new Error('store not implemented for ' + JSON.stringify(this))
  }

  /**
   * @see File#getComments
   * @function
   * @return {CommentList}
   * @abstract
   */
  getComments() {
    throw new Error('getComments not implemented for ' + JSON.stringify(this))
  }

  /**
   * @see File#getTrackedChanges
   * @function
   * @return {TrackedChangeList}
   * @abstract
   */
  getTrackedChanges() {
    throw new Error(
      'getTrackedChanges not implemented for ' + JSON.stringify(this)
    )
  }
}

module.exports = FileData

const BinaryFileData = require('./binary_file_data')
const HashFileData = require('./hash_file_data')
const HollowBinaryFileData = require('./hollow_binary_file_data')
const HollowStringFileData = require('./hollow_string_file_data')
const LazyStringFileData = require('./lazy_string_file_data')
const StringFileData = require('./string_file_data')
