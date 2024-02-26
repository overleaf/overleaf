// @ts-check
'use strict'

const assert = require('check-types').assert

const Blob = require('../blob')
const FileData = require('./')
/**
 * @typedef {import('./string_file_data')} StringFileData
 * @typedef {import('./lazy_string_file_data')} LazyStringFileData
 * @typedef {import('./hollow_string_file_data')} HollowStringFileData
 * @typedef {import('../types').BlobStore} BlobStore
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
   * @param {{hash: string, rangesHash?: string}} raw
   * @returns
   */
  static fromRaw(raw) {
    return new HashFileData(raw.hash, raw.rangesHash)
  }

  /**
   * @inheritdoc
   * @returns {{hash: string, rangesHash?: string}}
   */
  toRaw() {
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
    const blob = await blobStore.getBlob(this.hash)
    let rangesBlob
    if (this.rangesHash) {
      rangesBlob = await blobStore.getBlob(this.rangesHash)
    }
    if (!blob) throw new Error('blob not found: ' + this.hash)
    return FileData.createLazyFromBlobs(blob, rangesBlob)
  }

  /**
   * @inheritdoc
   * @param {BlobStore} blobStore
   * @returns {Promise<HollowStringFileData>}
   */
  async toHollow(blobStore) {
    const blob = await blobStore.getBlob(this.hash)
    return FileData.createHollow(blob.getByteLength(), blob.getStringLength())
  }

  /**
   * @inheritdoc
   * @returns {Promise<{hash: string, rangesHash?: string}>}
   */
  async store() {
    const raw = { hash: this.hash }
    if (this.rangesHash) {
      raw.rangesHash = this.rangesHash
    }
    return raw
  }
}

module.exports = HashFileData
