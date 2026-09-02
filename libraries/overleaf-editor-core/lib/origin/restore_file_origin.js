// @ts-check

'use strict'

const assert = require('check-types').assert

const Origin = require('.')

/**
 * @import { RawRestoreFileOrigin } from '../types'
 */

class RestoreFileOrigin extends Origin {
  /**
   * @param {number} version that was restored
   * @param {string} path that was restored
   * @param {Date} timestamp from the restored version
   * @param {string} [historyClientId] see {@link Origin}
   */
  constructor(version, path, timestamp, historyClientId) {
    assert.integer(version, 'RestoreFileOrigin: bad version')
    assert.string(path, 'RestoreFileOrigin: bad path')
    assert.date(timestamp, 'RestoreFileOrigin: bad timestamp')

    super(RestoreFileOrigin.KIND, historyClientId)
    this.version = version
    this.path = path
    this.timestamp = timestamp
  }

  /**
   * @param {RawRestoreFileOrigin} raw
   * @return {RestoreFileOrigin}
   */
  static fromRaw(raw) {
    return new RestoreFileOrigin(
      raw.version,
      raw.path,
      new Date(raw.timestamp),
      raw.historyClientId
    )
  }

  /** @inheritdoc */
  toRaw() {
    return {
      ...super.toRaw(),
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

/** @type {'file-restore'} */
RestoreFileOrigin.KIND = 'file-restore'

module.exports = RestoreFileOrigin
