// @ts-check

/**
 * @typedef {import('./types').CommentOp} CommentOp
 * @typedef {import('./types').DeleteOp} DeleteOp
 * @typedef {import('./types').InsertOp} InsertOp
 * @typedef {import('./types').Op} Op
 * @typedef {import('./types').TrackedChange} TrackedChange
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

module.exports = { isInsert, isDelete, isComment, addTrackedDeletesToContent }
