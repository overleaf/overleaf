'use strict'

const assert = require('check-types').assert

const Change = require('./change')

/**
 * @constructor
 * @param {number} baseVersion the new base version for the change
 * @param {?Change} change
 * @classdesc
 * A `ChangeNote` is returned when the server has applied a {@link Change}.
 */
function ChangeNote(baseVersion, change) {
  assert.integer(baseVersion, 'bad baseVersion')
  assert.maybe.instance(change, Change, 'bad change')

  this.baseVersion = baseVersion
  this.change = change
}

module.exports = ChangeNote

/**
 * For serialization.
 *
 * @return {Object}
 */
ChangeNote.prototype.toRaw = function changeNoteToRaw() {
  return {
    baseVersion: this.baseVersion,
    change: this.change.toRaw(),
  }
}

ChangeNote.prototype.toRawWithoutChange =
  function changeNoteToRawWithoutChange() {
    return {
      baseVersion: this.baseVersion,
    }
  }

ChangeNote.fromRaw = function changeNoteFromRaw(raw) {
  assert.integer(raw.baseVersion, 'bad raw.baseVersion')
  assert.maybe.object(raw.change, 'bad raw.changes')

  return new ChangeNote(raw.baseVersion, Change.fromRaw(raw.change))
}

ChangeNote.prototype.getBaseVersion = function () {
  return this.baseVersion
}

ChangeNote.prototype.getResultVersion = function () {
  return this.baseVersion + 1
}

ChangeNote.prototype.getChange = function () {
  return this.change
}
