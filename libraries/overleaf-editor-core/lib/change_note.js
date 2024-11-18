'use strict'

const assert = require('check-types').assert

const Change = require('./change')

/**
 * A `ChangeNote` is returned when the server has applied a {@link Change}.
 */
class ChangeNote {
  /**
   * @param {number} baseVersion the new base version for the change
   * @param {Change} [change]
   */
  constructor(baseVersion, change) {
    assert.integer(baseVersion, 'bad baseVersion')
    assert.maybe.instance(change, Change, 'bad change')

    this.baseVersion = baseVersion
    this.change = change
  }

  /**
   * For serialization.
   *
   * @return {Object}
   */
  toRaw() {
    return {
      baseVersion: this.baseVersion,
      change: this.change.toRaw(),
    }
  }

  toRawWithoutChange() {
    return {
      baseVersion: this.baseVersion,
    }
  }

  static fromRaw(raw) {
    assert.integer(raw.baseVersion, 'bad raw.baseVersion')
    assert.maybe.object(raw.change, 'bad raw.changes')

    return new ChangeNote(raw.baseVersion, Change.fromRaw(raw.change))
  }

  getBaseVersion() {
    return this.baseVersion
  }

  getResultVersion() {
    return this.baseVersion + 1
  }

  getChange() {
    return this.change
  }
}

module.exports = ChangeNote
