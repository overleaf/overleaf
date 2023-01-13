const Blob = require('overleaf-editor-core').Blob
const blobHash = require('./blob_hash')
const BPromise = require('bluebird')

// We want to simulate applying all of the operations so we can return the
// resulting hashes to the caller for them to check. To do this, we need to be
// able to take the lazy files in the final snapshot, fetch their content, and
// compute the new content hashes. We don't, however, need to actually store
// that content; we just need to get the hash.
function HashCheckBlobStore(realBlobStore) {
  this.realBlobStore = realBlobStore
}

HashCheckBlobStore.prototype.getString = BPromise.method(
  function hashCheckBlobStoreGetString(hash) {
    return this.realBlobStore.getString(hash)
  }
)

HashCheckBlobStore.prototype.putString = BPromise.method(
  function hashCheckBlobStorePutString(string) {
    return new Blob(
      blobHash.fromString(string),
      Buffer.byteLength(string),
      string.length
    )
  }
)

module.exports = HashCheckBlobStore
