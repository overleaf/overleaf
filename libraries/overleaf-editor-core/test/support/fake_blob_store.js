/**
 * @typedef {import("../..").Blob } Blob
 */

/**
 * @template T
 * @typedef {import("bluebird")<T>} BPromise
 */

/**
 * Fake blob store for tests
 */
class FakeBlobStore {
  /**
   * Get a string from the blob store
   *
   * @param {string} hash
   * @return {BPromise<string>}
   */
  getString(hash) {
    throw new Error('Not implemented')
  }

  /**
   * Store a string in the blob store
   *
   * @param {string} content
   * @return {BPromise<Blob>}
   */
  putString(content) {
    throw new Error('Not implemented')
  }
}

module.exports = FakeBlobStore
