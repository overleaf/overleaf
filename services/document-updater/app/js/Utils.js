// @ts-check

/**
 * @typedef {import('./types').CommentOp} CommentOp
 * @typedef {import('./types').DeleteOp} DeleteOp
 * @typedef {import('./types').InsertOp} InsertOp
 * @typedef {import('./types').Op} Op
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

module.exports = { isInsert, isDelete, isComment }
