'use strict'

const assert = require('check-types').assert
const BPromise = require('bluebird')

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
  toEager(blobStore) {
    return this.toLazy(blobStore).then(lazyFileData =>
      lazyFileData.toEager(blobStore)
    )
  }

  /** @inheritdoc */
  toLazy(blobStore) {
    return blobStore.getBlob(this.hash).then(blob => {
      if (!blob) throw new Error('blob not found: ' + this.hash)
      return FileData.createLazyFromBlob(blob)
    })
  }

  /** @inheritdoc */
  toHollow(blobStore) {
    return blobStore.getBlob(this.hash).then(function (blob) {
      return FileData.createHollow(blob.getByteLength(), blob.getStringLength())
    })
  }

  /** @inheritdoc */
  store() {
    return BPromise.resolve({ hash: this.hash })
  }
}

module.exports = HashFileData
