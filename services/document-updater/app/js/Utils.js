// @ts-check
const { createHash } = require('node:crypto')
const _ = require('lodash')

/**
 * @import { CommentOp, DeleteOp, InsertOp, Op, TrackedChange } from './types'
 */

/**
 * Returns true if the op is an insert
 *
 * @param {Op} op
 * @returns {op is InsertOp}
 */
function isInsert(op) {
  return 'i' in op && op.i != null
}

/**
 * Returns true if the op is an insert
 *
 * @param {Op} op
 * @returns {op is DeleteOp}
 */
function isDelete(op) {
  return 'd' in op && op.d != null
}

/**
 * Returns true if the op is a comment
 *
 * @param {Op} op
 * @returns {op is CommentOp}
 */
function isComment(op) {
  return 'c' in op && op.c != null
}

/**
 * Get the length of a document from its lines
 *
 * @param {string[]} lines
 * @returns {number}
 */
function getDocLength(lines) {
  let docLength = _.reduce(lines, (chars, line) => chars + line.length, 0)
  // Add newline characters. Lines are joined by newlines, but the last line
  // doesn't include a newline. We must make a special case for an empty list
  // so that it doesn't report a doc length of -1.
  docLength += Math.max(lines.length - 1, 0)

  return docLength
}

/**
 * Adds given tracked deletes to the given content.
 *
 * The history system includes tracked deletes in the document content.
 *
 * @param {string} content
 * @param {TrackedChange[]} trackedChanges
 * @return {string} content for the history service
 */
function addTrackedDeletesToContent(content, trackedChanges) {
  let cursor = 0
  let result = ''
  for (const change of trackedChanges) {
    if (isDelete(change.op)) {
      // Add the content before the tracked delete
      result += content.slice(cursor, change.op.p)
      cursor = change.op.p
      // Add the content of the tracked delete
      result += change.op.d
    }
  }

  // Add the content after all tracked deletes
  result += content.slice(cursor)

  return result
}

/**
 * Compute the content hash for a doc
 *
 * This hash is sent to the history to validate updates.
 *
 * @param {string[]} lines
 * @return {string} the doc hash
 */
function computeDocHash(lines) {
  const hash = createHash('sha1')
  if (lines.length > 0) {
    for (const line of lines.slice(0, lines.length - 1)) {
      hash.update(line)
      hash.update('\n')
    }
    // The last line doesn't end with a newline
    hash.update(lines[lines.length - 1])
  }
  return hash.digest('hex')
}

/**
 * checks if the given originOrSource should be treated as a source or origin
 * TODO: remove this hack and remove all "source" references
 */
function extractOriginOrSource(originOrSource) {
  let source = null
  let origin = null

  if (typeof originOrSource === 'string') {
    source = originOrSource
  } else if (originOrSource && typeof originOrSource === 'object') {
    origin = originOrSource
  }

  return { source, origin }
}

module.exports = {
  isInsert,
  isDelete,
  isComment,
  addTrackedDeletesToContent,
  getDocLength,
  computeDocHash,
  extractOriginOrSource,
}
