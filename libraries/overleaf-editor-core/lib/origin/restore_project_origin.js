// @ts-check

'use strict'

const assert = require('check-types').assert

const Origin = require('.')

/**
 * @import { RawRestoreProjectOrigin } from '../types'
 */

class RestoreProjectOrigin extends Origin {
  /**
   * @param {number} version that was restored
   * @param {Date} timestamp from the restored version
   * @param {string} [historyClientId] see {@link Origin}
   */
  constructor(version, timestamp, historyClientId) {
    assert.integer(version, 'RestoreProjectOrigin: bad version')
    assert.date(timestamp, 'RestoreProjectOrigin: bad timestamp')

    super(RestoreProjectOrigin.KIND, historyClientId)
    this.version = version
    this.timestamp = timestamp
  }

  /**
   * @param {RawRestoreProjectOrigin} raw
   * @return {RestoreProjectOrigin}
   */
  static fromRaw(raw) {
    return new RestoreProjectOrigin(
      raw.version,
      new Date(raw.timestamp),
      raw.historyClientId
    )
  }

  /** @inheritdoc */
  toRaw() {
    return {
      ...super.toRaw(),
      version: this.version,
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
   * @return {Date}
   */
  getTimestamp() {
    return this.timestamp
  }
}

/** @type {'project-restore'} */
RestoreProjectOrigin.KIND = 'project-restore'

module.exports = RestoreProjectOrigin
