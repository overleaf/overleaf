const { Blob, BlobStoreBase } = require('overleaf-editor-core')
const { blobHashFromString } = require('overleaf-editor-core/lib/blob_utils')

// We want to simulate applying all of the operations so we can return the
// resulting hashes to the caller for them to check. To do this, we need to be
// able to take the lazy files in the final snapshot, fetch their content, and
// compute the new content hashes. We don't, however, need to actually store
// that content; we just need to get the hash.
//
// A file's ranges go through here the same way its content does: reading one
// needs getObject, which the base class builds on fetchString, and hashing one
// again needs putObject, which is putString of its JSON. Without both, a project
// holding a tracked change or a comment could not be hashed at all.
class HashCheckBlobStore extends BlobStoreBase {
  /**
   * @param {{ getString(hash: string): Promise<string> }} realBlobStore
   */
  constructor(realBlobStore) {
    super()
    this.realBlobStore = realBlobStore
  }

  /**
   * @param {string} hash
   * @return {Promise<string>}
   */
  async fetchString(hash) {
    return await this.realBlobStore.getString(hash)
  }

  /**
   * @param {string} string
   * @return {Promise<Blob>}
   */
  async putString(string) {
    return new Blob(
      blobHashFromString(string),
      Buffer.byteLength(string),
      string.length
    )
  }

  /**
   * @param {object} obj
   * @return {Promise<Blob>}
   */
  async putObject(obj) {
    return await this.putString(JSON.stringify(obj))
  }
}

module.exports = HashCheckBlobStore
