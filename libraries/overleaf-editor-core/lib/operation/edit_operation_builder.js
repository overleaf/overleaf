// @ts-check
/**
 * @typedef {import('./edit_operation')} EditOperation
 * @typedef {import('../types').RawTextOperation} RawTextOperation
 * @typedef {import('../types').RawAddCommentOperation} RawAddCommentOperation
 * @typedef {import('../types').RawDeleteCommentOperation} RawDeleteCommentOperation
 * @typedef {import('../types').RawEditOperation} RawEditOperation
 */
const DeleteCommentOperation = require('./delete_comment_operation')
const AddCommentOperation = require('./add_comment_operation')
const TextOperation = require('./text_operation')

class EditOperationBuilder {
  /**
   *
   * @param {RawEditOperation} raw
   * @returns {EditOperation}
   */
  static fromJSON(raw) {
    if (isTextOperation(raw)) {
      return TextOperation.fromJSON(raw)
    }
    if (isRawAddCommentOperation(raw)) {
      return AddCommentOperation.fromJSON(raw)
    }
    if (isRawDeleteCommentOperation(raw)) {
      return DeleteCommentOperation.fromJSON(raw)
    }
    throw new Error('Unsupported operation in EditOperationBuilder.fromJSON')
  }
}

/**
 * @param {*} raw
 * @returns {raw is RawTextOperation}
 */
function isTextOperation(raw) {
  return raw?.textOperation !== undefined
}

/**
 * @param {*} raw
 * @returns {raw is RawAddCommentOperation}
 */
function isRawAddCommentOperation(raw) {
  return raw?.commentId && Array.isArray(raw.ranges)
}

/**
 * @param {*} raw
 * @returns {raw is RawDeleteCommentOperation}
 */
function isRawDeleteCommentOperation(raw) {
  return raw?.deleteComment
}

module.exports = EditOperationBuilder
