// @ts-check

'use strict'

const { EDITOR_ORIGIN_KIND } = require('./origin')

/**
 * @import { RawChange } from "./types"
 */

/**
 * Identifying a change an editor client submitted.
 *
 * history-v1 uses this to recognise a change a client is resending, so as not to
 * apply the same operations twice; the client uses it to recognise its own change
 * coming back on the change stream, so as not to apply it a second time locally.
 * Both sides have to agree exactly — if one of them compares a field the other
 * does not, they disagree about what is a duplicate, and a change is either
 * applied twice or discarded. Neither reports an error. So the key lives here
 * rather than being spelled out in each service.
 *
 * The fields are the ones a rebase leaves alone: transforming a change rewrites
 * its operations, so those cannot identify it, while the origin, the author and
 * the timestamp travel through history untouched.
 *
 * Each rules out a different false match:
 *
 * - the origin kind keeps other writers out, so a Dropbox sync or a resync is
 *   never mistaken for a client's change.
 * - `historyClientId` separates editors that share an author. Nothing coordinates
 *   timestamps between two tabs of one user, or between anonymous editors, who
 *   share an empty author — without it, two clients colliding on a millisecond
 *   look identical.
 * - the author makes a forged `historyClientId` unusable: it arrives from the
 *   client, but a change belonging to another account can never match.
 * - the timestamp separates successive changes from one editor, which the client
 *   keeps distinct and stable across resends.
 *
 * @typedef {{historyClientId: string, author: (string|null), timestamp: number}} EditorChangeIdentity
 */

/**
 * The identity of a raw change, or null if it is not an identifiable editor
 * change — another writer's, or one whose `historyClientId` was dropped when its
 * chunk was written.
 *
 * The timestamp is compared as a point in time rather than as a string, so that
 * two spellings of the same instant cannot read as different changes.
 *
 * @param {RawChange} [raw]
 * @return {EditorChangeIdentity | null}
 */
function editorChangeIdentity(raw) {
  const origin = raw?.origin
  if (!origin || origin.kind !== EDITOR_ORIGIN_KIND) return null

  // Absent on a change nothing has to recognise again, and on one whose id was
  // dropped when its chunk was written. Neither is identifiable, and an absent id
  // must never read as a match.
  const { historyClientId } = origin
  if (!historyClientId) return null

  // real-time stamps exactly one author on every change it forwards, so anything
  // else did not come from this path.
  const authors = raw.v2Authors
  if (!Array.isArray(authors) || authors.length !== 1) return null

  const timestamp = new Date(raw.timestamp).getTime()
  if (Number.isNaN(timestamp)) return null

  return { historyClientId, author: authors[0] ?? null, timestamp }
}

/**
 * Build an identity from a client's own record of a change it submitted, for
 * comparing against what comes back from history.
 *
 * The timestamp is still a Date here: the client holds the change it submitted,
 * and only the comparison works in milliseconds.
 *
 * @param {{historyClientId: string, author: string | null, timestamp: Date}} params
 * @return {EditorChangeIdentity}
 */
function editorChangeIdentityOf({ historyClientId, author, timestamp }) {
  return {
    historyClientId,
    author: author ?? null,
    timestamp: timestamp.getTime(),
  }
}

/**
 * Whether two identities name the same change. A null identity matches nothing,
 * including another null.
 *
 * @param {EditorChangeIdentity | null} [a]
 * @param {EditorChangeIdentity | null} [b]
 * @return {boolean}
 */
function isSameEditorChange(a, b) {
  if (!a || !b) return false
  return (
    a.historyClientId === b.historyClientId &&
    a.author === b.author &&
    a.timestamp === b.timestamp
  )
}

/**
 * Whether a raw change is one a given writer placed.
 *
 * The counterpart of the above for writers that are not an editor client: an
 * integration that commits a batch on a user's behalf and then has to recognise
 * that batch coming back, because a lost response does not say whether the
 * commit landed and resubmitting one that did applies its removes twice.
 *
 * Compares the same three fields, and for the same reason -- a rebase rewrites
 * a change's operations but leaves its origin, authors and timestamp alone --
 * with the timestamp compared as a point in time rather than as a string, so
 * that two spellings of the same instant cannot read as different changes.
 *
 * @param {RawChange} [raw]
 * @param {{originKind: string, author: string, timestamp: Date}} [expected]
 * @return {boolean}
 */
function isChangeFrom(raw, expected) {
  if (!raw || !expected) return false
  if (raw.origin?.kind !== expected.originKind) return false
  if (!Array.isArray(raw.v2Authors)) return false
  if (!raw.v2Authors.includes(expected.author)) return false
  const timestamp = new Date(raw.timestamp).getTime()
  if (Number.isNaN(timestamp)) return false
  return timestamp === expected.timestamp.getTime()
}

module.exports = {
  editorChangeIdentity,
  editorChangeIdentityOf,
  isSameEditorChange,
  isChangeFrom,
}
