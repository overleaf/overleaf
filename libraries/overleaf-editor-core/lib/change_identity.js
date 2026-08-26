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
 * - `editorId` separates editors that share an author. Nothing coordinates
 *   timestamps between two tabs of one user, or between anonymous editors, who
 *   share an empty author — without it, two clients colliding on a millisecond
 *   look identical.
 * - the author makes a forged `editorId` unusable: it arrives from the client, but
 *   a change belonging to another account can never match.
 * - the timestamp separates successive changes from one editor, which the client
 *   keeps distinct and stable across resends.
 *
 * @typedef {{editorId: string, author: (string|null), timestamp: number}} EditorChangeIdentity
 */

/**
 * The identity of a raw change, or null if it is not an identifiable editor
 * change — another writer's, or one whose `editorId` was dropped when its chunk
 * was written.
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

  // The origin union's catch-all variant is `{kind: string}`, which also admits
  // this kind, so checking the kind cannot narrow to the variant carrying the id.
  const { editorId } = /** @type {{editorId?: string}} */ (origin)
  if (!editorId) return null

  // real-time stamps exactly one author on every change it forwards, so anything
  // else did not come from this path.
  const authors = raw.v2Authors
  if (!Array.isArray(authors) || authors.length !== 1) return null

  const timestamp = new Date(raw.timestamp).getTime()
  if (Number.isNaN(timestamp)) return null

  return { editorId, author: authors[0] ?? null, timestamp }
}

/**
 * Build an identity from a client's own record of a change it submitted, for
 * comparing against what comes back from history.
 *
 * @param {Object} params
 * @param {string} params.editorId
 * @param {string | null} params.author
 * @param {Date} params.timestamp
 * @return {EditorChangeIdentity}
 */
function editorChangeIdentityOf({ editorId, author, timestamp }) {
  return { editorId, author: author ?? null, timestamp: timestamp.getTime() }
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
    a.editorId === b.editorId &&
    a.author === b.author &&
    a.timestamp === b.timestamp
  )
}

module.exports = {
  editorChangeIdentity,
  editorChangeIdentityOf,
  isSameEditorChange,
}
