'use strict'

const assert = require('check-types').assert

const Blob = require('../blob')
const FileData = require('./')

class HashFileData extends FileData {
  /**
   * @constructor
   * @param {string} hash
   * @see FileData
   */
  constructor(hash) {
    super()
    assert.match(hash, Blob.HEX_HASH_RX, 'HashFileData: bad hash')
    this.hash = hash
  }

  static fromRaw(raw) {
    return new HashFileData(raw.hash)
  }

  /** @inheritdoc */
  toRaw() {
    return { hash: this.hash }
  }

  /** @inheritdoc */
  getHash() {
    return this.hash
  }

  /** @inheritdoc */
  async toEager(blobStore) {
    const lazyFileData = await this.toLazy(blobStore)
    return await lazyFileData.toEager(blobStore)
  }

  /** @inheritdoc */
  async toLazy(blobStore) {
    const blob = await blobStore.getBlob(this.hash)
    if (!blob) throw new Error('blob not found: ' + this.hash)
    return FileData.createLazyFromBlob(blob)
  }

  /** @inheritdoc */
  async toHollow(blobStore) {
    const blob = await blobStore.getBlob(this.hash)
    return FileData.createHollow(blob.getByteLength(), blob.getStringLength())
  }

  /** @inheritdoc */
  async store() {
    return { hash: this.hash }
  }
}

module.exports = HashFileData
