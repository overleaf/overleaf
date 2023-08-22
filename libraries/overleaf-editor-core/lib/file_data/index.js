'use strict'

const assert = require('check-types').assert
const BPromise = require('bluebird')

const Blob = require('../blob')

// Dependencies are loaded at the bottom of the file to mitigate circular
// dependency
let BinaryFileData = null
let HashFileData = null
let HollowBinaryFileData = null
let HollowStringFileData = null
let LazyStringFileData = null
let StringFileData = null

/**
 * @typedef {import("../types").BlobStore} BlobStore
 */

/**
 * Helper to represent the content of a file. This class and its subclasses
 * should be used only through {@link File}.
 */
class FileData {
  /** @see File.fromRaw */
  static fromRaw(raw) {
    if (Object.prototype.hasOwnProperty.call(raw, 'hash')) {
      if (Object.prototype.hasOwnProperty.call(raw, 'byteLength'))
        return BinaryFileData.fromRaw(raw)
      if (Object.prototype.hasOwnProperty.call(raw, 'stringLength'))
        return LazyStringFileData.fromRaw(raw)
      return HashFileData.fromRaw(raw)
    }
    if (Object.prototype.hasOwnProperty.call(raw, 'byteLength'))
      return HollowBinaryFileData.fromRaw(raw)
    if (Object.prototype.hasOwnProperty.call(raw, 'stringLength'))
      return HollowStringFileData.fromRaw(raw)
    if (Object.prototype.hasOwnProperty.call(raw, 'content'))
      return StringFileData.fromRaw(raw)
    throw new Error('FileData: bad raw object ' + JSON.stringify(raw))
  }

  /** @see File.createHollow */
  static createHollow(byteLength, stringLength) {
    if (stringLength == null) {
      return new HollowBinaryFileData(byteLength)
    }
    return new HollowStringFileData(stringLength)
  }

  /** @see File.createLazyFromBlob */
  static createLazyFromBlob(blob) {
    assert.instance(blob, Blob, 'FileData: bad blob')
    if (blob.getStringLength() == null) {
      return new BinaryFileData(blob.getHash(), blob.getByteLength())
    }
    return new LazyStringFileData(blob.getHash(), blob.getStringLength())
  }

  toRaw() {
    throw new Error('FileData: toRaw not implemented')
  }

  /** @see File#getHash */
  getHash() {
    return null
  }

  /** @see File#getContent */
  getContent() {
    return null
  }

  /** @see File#isEditable */
  isEditable() {
    return null
  }

  /** @see File#getByteLength */
  getByteLength() {
    return null
  }

  /** @see File#getStringLength */
  getStringLength() {
    return null
  }

  /** @see File#edit */
  edit(textOperation) {
    throw new Error('edit not implemented for ' + JSON.stringify(this))
  }

  /**
   * @function
   * @param {BlobStore} blobStore
   * @return {BPromise<FileData>}
   * @abstract
   * @see FileData#load
   */
  toEager(blobStore) {
    return BPromise.reject(
      new Error('toEager not implemented for ' + JSON.stringify(this))
    )
  }

  /**
   * @function
   * @param {BlobStore} blobStore
   * @return {BPromise<FileData>}
   * @abstract
   * @see FileData#load
   */
  toLazy(blobStore) {
    return BPromise.reject(
      new Error('toLazy not implemented for ' + JSON.stringify(this))
    )
  }

  /**
   * @function
   * @param {BlobStore} blobStore
   * @return {BPromise<FileData>}
   * @abstract
   * @see FileData#load
   */
  toHollow(blobStore) {
    return BPromise.reject(
      new Error('toHollow not implemented for ' + JSON.stringify(this))
    )
  }

  /**
   * @see File#load
   * @param {string} kind
   * @param {BlobStore} blobStore
   * @return {BPromise<FileData>}
   */
  load(kind, blobStore) {
    if (kind === 'eager') return this.toEager(blobStore)
    if (kind === 'lazy') return this.toLazy(blobStore)
    if (kind === 'hollow') return this.toHollow(blobStore)
    throw new Error('bad file data load kind: ' + kind)
  }

  /**
   * @see File#store
   * @function
   * @param {BlobStore} blobStore
   * @return {BPromise<Object>} a raw HashFile
   * @abstract
   */
  store(blobStore) {
    return BPromise.reject(
      new Error('store not implemented for ' + JSON.stringify(this))
    )
  }
}

module.exports = FileData

BinaryFileData = require('./binary_file_data')
HashFileData = require('./hash_file_data')
HollowBinaryFileData = require('./hollow_binary_file_data')
HollowStringFileData = require('./hollow_string_file_data')
LazyStringFileData = require('./lazy_string_file_data')
StringFileData = require('./string_file_data')
