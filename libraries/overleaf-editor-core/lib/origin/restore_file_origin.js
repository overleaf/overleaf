'use strict'

const assert = require('check-types').assert

const Origin = require('.')

class RestoreFileOrigin extends Origin {
  /**
   * @param {number} version that was restored
   * @param {string} path that was restored
   * @param {Date} timestamp from the restored version
   */
  constructor(version, path, timestamp) {
    assert.integer(version, 'RestoreFileOrigin: bad version')
    assert.string(path, 'RestoreFileOrigin: bad path')
    assert.date(timestamp, 'RestoreFileOrigin: bad timestamp')

    super(RestoreFileOrigin.KIND)
    this.version = version
    this.path = path
    this.timestamp = timestamp
  }

  static fromRaw(raw) {
    return new RestoreFileOrigin(raw.version, raw.path, new Date(raw.timestamp))
  }

  /** @inheritdoc */
  toRaw() {
    return {
      kind: RestoreFileOrigin.KIND,
      version: this.version,
      path: this.path,
      timestamp: this.timestamp.toISOString(),
    }
  }

  /**
   * @return {number}
   */
  getVersion() {
    return this.version
  }

  /**
   * @return {string}
   */
  getPath() {
    return this.path
  }

  /**
   * @return {Date}
   */
  getTimestamp() {
    return this.timestamp
  }
}

RestoreFileOrigin.KIND = 'file-restore'

module.exports = RestoreFileOrigin
