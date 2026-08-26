// @ts-check
'use strict'

const Blob = require('./blob')

/**
 * The parts of reading a blob that every blob store answers the same way.
 *
 * The hash of empty content is a property of the content rather than of anything
 * stored: every project's empty file has it, whether or not anything ever wrote a
 * blob under it, and a file may reference it before anything has. So no store has
 * to look it up, and every store that did was paying a lookup -- a database query,
 * an HTTP request, a read of a cache that offline mode may be the only thing
 * standing in for -- to be told what the hash already says. Deserializing a blob
 * that holds JSON is likewise the same wherever it is read from.
 *
 * Implementations extend this and provide `fetchString`, which is only ever called
 * for a hash that needs fetching. Spelling either of these out in each store
 * instead is a line per store, and the store written next is the one that forgets.
 *
 * `getObject` inherits the empty-hash answer through `getString`, so it parses `''`
 * and fails. That is right: a ranges blob is written from `JSON.stringify`, which
 * never yields empty content, so a hash reaching `getObject` is one something
 * stored. A store that reads or repairs its JSON differently overrides it.
 */
class BlobStoreBase {
  /**
   * Fetch a blob's content as a string.
   *
   * @param {string} hash hexadecimal SHA-1 hash
   * @return {Promise<string>}
   */
  async getString(hash) {
    if (hash === Blob.EMPTY_HASH) {
      return ''
    }
    return await this.fetchString(hash)
  }

  /**
   * Fetch a blob holding JSON and deserialize it.
   *
   * @template [T=unknown]
   * @param {string} hash hexadecimal SHA-1 hash
   * @return {Promise<T>}
   */
  async getObject(hash) {
    return /** @type {T} */ (JSON.parse(await this.getString(hash)))
  }

  /**
   * Fetch a blob's content as a string from wherever this store keeps it.
   *
   * Called only for a hash that something needs to have stored, so an
   * implementation may treat a miss as an error.
   *
   * @abstract
   * @param {string} hash hexadecimal SHA-1 hash
   * @return {Promise<string>}
   */
  async fetchString(hash) {
    throw new Error(
      `${this.constructor.name} does not implement fetchString(hash)`
    )
  }
}

module.exports = BlobStoreBase
