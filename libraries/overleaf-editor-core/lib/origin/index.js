// @ts-check

'use strict'

const assert = require('check-types').assert

/**
 * @import { RawBaseOrigin, RawOrigin, RawRestoreOrigin } from '../types'
 * @import { RawRestoreFileOrigin, RawRestoreProjectOrigin } from '../types'
 */

// Dependencies are loaded at the bottom of the file to mitigate circular
// dependency. Typed here, or they would be `any` and nothing they are handed
// would be checked.
/** @type {typeof import('./restore_origin')} */
let RestoreOrigin
/** @type {typeof import('./restore_file_origin')} */
let RestoreFileOrigin
/** @type {typeof import('./restore_project_origin')} */
let RestoreProjectOrigin

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
   * @param {string} [historyClientId] identifies the client that submitted the
   *   change, where it is one that has to be recognised again; see
   *   {@link Origin#getHistoryClientId}
   */
  constructor(kind, historyClientId) {
    assert.string(kind, 'Origin: bad kind')
    assert.maybe.nonEmptyString(historyClientId, 'Origin: bad historyClientId')

    this.kind = kind
    this.historyClientId = historyClientId
  }

  /**
   * Create an Origin from its raw form.
   *
   * The kind tells the variants apart, but only up to a point: the union's last
   * variant is a kind on its own, and its `kind` is any string, so it admits the
   * kinds below as well. Checking the kind rules out the other restore variants
   * and leaves that one, hence the assertion at each branch.
   *
   * @param {RawOrigin} [raw]
   * @return {Origin | null}
   */
  static fromRaw(raw) {
    if (!raw) return null
    if (raw.kind === RestoreOrigin.KIND && 'version' in raw) {
      return RestoreOrigin.fromRaw(raw)
    }
    if (raw.kind === RestoreFileOrigin.KIND && 'path' in raw) {
      return RestoreFileOrigin.fromRaw(raw)
    }
    if (raw.kind === RestoreProjectOrigin.KIND && 'version' in raw) {
      return RestoreProjectOrigin.fromRaw(raw)
    }
    return new Origin(raw.kind, raw.historyClientId)
  }

  /**
   * Convert the Origin to raw form for storage or transmission.
   *
   * Built up a layer at a time: this one writes what every origin has, and a
   * subclass spreads it and adds the fields it owns.
   *
   * @return {RawBaseOrigin}
   */
  toRaw() {
    /** @type {RawBaseOrigin} */
    const raw = { kind: this.kind }
    if (this.historyClientId) {
      raw.historyClientId = this.historyClientId
    }
    return raw
  }

  /**
   * @return {string}
   */
  getKind() {
    return this.kind
  }

  /**
   * The client that submitted this change, where there is one.
   *
   * It is what scopes the change's timestamp: a client keeps its own timestamps
   * distinct, but two clients of the same user do not coordinate, so the pair is
   * what identifies a submission. history-v1 uses it to recognise a change it has
   * already applied, rather than applying a resend twice, and the client that
   * sent it uses it to recognise its own change coming back.
   *
   * Absent on a change nothing has to recognise again, and on one whose id was
   * dropped once it could no longer be resent -- see
   * {@link Origin#dropHistoryClientId}.
   *
   * @return {string | undefined}
   */
  getHistoryClientId() {
    return this.historyClientId
  }

  /**
   * Forget which client submitted this change, keeping the rest of the origin.
   *
   * The id is only worth anything while the change could still be resent, so the
   * chunk store drops it from all but the latest change of each client when a
   * chunk is written.
   */
  dropHistoryClientId() {
    this.historyClientId = undefined
  }
}

module.exports = Origin
module.exports.EDITOR_ORIGIN_KIND = EDITOR_ORIGIN_KIND

RestoreOrigin = require('./restore_origin')
RestoreFileOrigin = require('./restore_file_origin')
RestoreProjectOrigin = require('./restore_project_origin')
