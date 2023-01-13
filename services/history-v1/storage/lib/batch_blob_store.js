'use strict'

const BPromise = require('bluebird')

/**
 * @constructor
 * @param {BlobStore} blobStore
 * @classdesc
 * Wrapper for BlobStore that pre-fetches blob metadata to avoid making one
 * database call per blob lookup.
 */
function BatchBlobStore(blobStore) {
  this.blobStore = blobStore
  this.blobs = new Map()
}

/**
 * Pre-fetch metadata for the given blob hashes.
 *
 * @param {Array.<string>} hashes
 * @return {Promise}
 */
BatchBlobStore.prototype.preload = function batchBlobStorePreload(hashes) {
  return BPromise.each(this.blobStore.getBlobs(hashes), blob => {
    this.blobs.set(blob.getHash(), blob)
  })
}

/**
 * @see BlobStore#getBlob
 */
BatchBlobStore.prototype.getBlob = BPromise.method(
  function batchBlobStoreGetBlob(hash) {
    const blob = this.blobs.get(hash)
    if (blob) return blob
    return this.blobStore.getBlob(hash)
  }
)

module.exports = BatchBlobStore
