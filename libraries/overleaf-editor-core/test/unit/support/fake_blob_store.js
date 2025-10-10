/**
 * @import { Blob } from "../.."
 */

/**
 * Fake blob store for tests
 */
class FakeBlobStore {
  /**
   * Get a string from the blob store
   *
   * @param {string} hash
   * @return {Promise<string>}
   */
  getString(hash) {
    throw new Error('Not implemented')
  }

  /**
   * Store a string in the blob store
   *
   * @param {string} content
   * @return {Promise<Blob>}
   */
  putString(content) {
    throw new Error('Not implemented')
  }
}

module.exports = FakeBlobStore
