'use strict'

const assert = require('check-types').assert

// Dependencies are loaded at the bottom of the file to mitigate circular
// dependency
let RestoreOrigin = null
let RestoreFileOrigin = null
let RestoreProjectOrigin = null
let EditorOrigin = null

/**
 * The origin kind of a change the editor submitted over the `applyHistoryOt`
 * rpc. real-time stamps it and history-v1 matches on it when recognising a
 * resend, so both need the same string.
 */
const EDITOR_ORIGIN_KIND = 'editor'

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
    // Only an editor change that still carries its editorId is an EditorOrigin.
    // The id is dropped from all but an editor's latest change when a chunk is
    // written, so most editor changes read back from storage are plain origins.
    if (raw.kind === EditorOrigin.KIND && raw.editorId)
      return EditorOrigin.fromRaw(raw)
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
module.exports.EDITOR_ORIGIN_KIND = EDITOR_ORIGIN_KIND

RestoreOrigin = require('./restore_origin')
RestoreFileOrigin = require('./restore_file_origin')
RestoreProjectOrigin = require('./restore_project_origin')
EditorOrigin = require('./editor_origin')
