'use strict'

const assert = require('check-types').assert

const Origin = require('.')

class RestoreProjectOrigin extends Origin {
  /**
   * @param {number} version that was restored
   * @param {Date} timestamp from the restored version
   */
  constructor(version, timestamp) {
    assert.integer(version, 'RestoreProjectOrigin: bad version')
    assert.date(timestamp, 'RestoreProjectOrigin: bad timestamp')

    super(RestoreProjectOrigin.KIND)
    this.version = version
    this.timestamp = timestamp
  }

  static fromRaw(raw) {
    return new RestoreProjectOrigin(raw.version, new Date(raw.timestamp))
  }

  /** @inheritdoc */
  toRaw() {
    return {
      kind: RestoreProjectOrigin.KIND,
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

RestoreProjectOrigin.KIND = 'project-restore'

module.exports = RestoreProjectOrigin
