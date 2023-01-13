'use strict'

const assert = require('check-types').assert

// Dependencies are loaded at the bottom of the file to mitigate circular
// dependency
let RestoreOrigin = null

/**
 * @constructor
 * @param {string} kind
 * @classdesc
 * An Origin records where a {@link Change} came from. The Origin class handles
 * simple tag origins, like "it came from rich text mode", or "it came from
 * uploading files". Its subclasses record more detailed data for Changes such
 * as restoring a version.
 */
function Origin(kind) {
  assert.string(kind, 'Origin: bad kind')

  this.kind = kind
}

/**
 * Create an Origin from its raw form.
 *
 * @param {Object} [raw]
 * @return {Origin | null}
 */
Origin.fromRaw = function originFromRaw(raw) {
  if (!raw) return null
  if (raw.kind === RestoreOrigin.KIND) return RestoreOrigin.fromRaw(raw)
  return new Origin(raw.kind)
}

/**
 * Convert the Origin to raw form for storage or transmission.
 *
 * @return {Object}
 */
Origin.prototype.toRaw = function originToRaw() {
  return { kind: this.kind }
}

/**
 * @return {string}
 */
Origin.prototype.getKind = function () {
  return this.kind
}

module.exports = Origin

RestoreOrigin = require('./restore_origin')
