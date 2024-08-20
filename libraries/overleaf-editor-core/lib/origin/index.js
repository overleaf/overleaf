'use strict'

const assert = require('check-types').assert

// Dependencies are loaded at the bottom of the file to mitigate circular
// dependency
let RestoreOrigin = null
let RestoreFileOrigin = null
let RestoreProjectOrigin = null

/**
 * An Origin records where a {@link Change} came from. The Origin class handles
 * simple tag origins, like "it came from rich text mode", or "it came from
 * uploading files". Its subclasses record more detailed data for Changes such
 * as restoring a version.
 */
class Origin {
  /**
   * @param {string} kind
   */
  constructor(kind) {
    assert.string(kind, 'Origin: bad kind')

    this.kind = kind
  }

  /**
   * Create an Origin from its raw form.
   *
   * @param {Object} [raw]
   * @return {Origin | null}
   */
  static fromRaw(raw) {
    if (!raw) return null
    if (raw.kind === RestoreOrigin.KIND) return RestoreOrigin.fromRaw(raw)
    if (raw.kind === RestoreFileOrigin.KIND)
      return RestoreFileOrigin.fromRaw(raw)
    if (raw.kind === RestoreProjectOrigin.KIND)
      return RestoreProjectOrigin.fromRaw(raw)
    return new Origin(raw.kind)
  }

  /**
   * Convert the Origin to raw form for storage or transmission.
   *
   * @return {Object}
   */
  toRaw() {
    return { kind: this.kind }
  }

  /**
   * @return {string}
   */
  getKind() {
    return this.kind
  }
}

module.exports = Origin

RestoreOrigin = require('./restore_origin')
RestoreFileOrigin = require('./restore_file_origin')
RestoreProjectOrigin = require('./restore_project_origin')
