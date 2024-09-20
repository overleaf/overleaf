// @ts-check
'use strict'

const assert = require('check-types').assert

const Blob = require('../blob')
const FileData = require('./')
/**
 * @import StringFileData from './string_file_data'
 * @import LazyStringFileData from './lazy_string_file_data'
 * @import HollowStringFileData from './hollow_string_file_data'
 * @import { BlobStore, RawHashFileData } from '../types'
 */

class HashFileData extends FileData {
  /**
   * @constructor
   * @param {string} hash
   * @param {string} [rangesHash]
   * @see FileData
   */
  constructor(hash, rangesHash) {
    super()
    assert.match(hash, Blob.HEX_HASH_RX, 'HashFileData: bad hash')
    if (rangesHash) {
      assert.match(
        rangesHash,
        Blob.HEX_HASH_RX,
        'HashFileData: bad ranges hash'
      )
    }
    this.hash = hash
    this.rangesHash = rangesHash
  }

  /**
   *
   * @param {RawHashFileData} raw
   */
  static fromRaw(raw) {
    return new HashFileData(raw.hash, raw.rangesHash)
  }

  /**
   * @inheritdoc
   * @returns {RawHashFileData}
   */
  toRaw() {
    /** @type RawHashFileData */
    const raw = { hash: this.hash }
    if (this.rangesHash) {
      raw.rangesHash = this.rangesHash
    }
    return raw
  }

  /**
   * @inheritdoc
   * @returns {string}
   */
  getHash() {
    return this.hash
  }

  /**
   * @inheritdoc
   * @returns {string | undefined}
   */
  getRangesHash() {
    return this.rangesHash
  }

  /**
   * @inheritdoc
   * @param {BlobStore} blobStore
   * @returns {Promise<StringFileData>}
   */
  async toEager(blobStore) {
    const lazyFileData = await this.toLazy(blobStore)
    return await lazyFileData.toEager(blobStore)
  }

  /**
   * @inheritdoc
   * @param {BlobStore} blobStore
   * @returns {Promise<LazyStringFileData>}
   */
  async toLazy(blobStore) {
    const [blob, rangesBlob] = await Promise.all([
      blobStore.getBlob(this.hash),
      this.rangesHash
        ? blobStore.getBlob(this.rangesHash)
        : Promise.resolve(undefined),
    ])
    if (rangesBlob === null) {
      // We attempted to look up the blob, but none was found
      throw new Error('Failed to look up rangesHash in blobStore')
    }
    if (!blob) throw new Error('blob not found: ' + this.hash)
    // TODO(das7pad): inline 2nd path of FileData.createLazyFromBlobs?
    // @ts-ignore
    return FileData.createLazyFromBlobs(blob, rangesBlob)
  }

  /**
   * @inheritdoc
   * @param {BlobStore} blobStore
   * @returns {Promise<HollowStringFileData>}
   */
  async toHollow(blobStore) {
    const blob = await blobStore.getBlob(this.hash)
    if (!blob) {
      throw new Error('Failed to look up hash in blobStore')
    }
    // TODO(das7pad): inline 2nd path of FileData.createHollow?
    // @ts-ignore
    return FileData.createHollow(blob.getByteLength(), blob.getStringLength())
  }

  /**
   * @inheritdoc
   * @returns {Promise<RawHashFileData>}
   */
  async store() {
    /** @type RawHashFileData */
    const raw = { hash: this.hash }
    if (this.rangesHash) {
      raw.rangesHash = this.rangesHash
    }
    return raw
  }
}

module.exports = HashFileData
