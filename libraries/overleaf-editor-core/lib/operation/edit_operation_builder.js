// @ts-check

/**
 * @import EditOperation from './edit_operation'
 * @import { RawTextOperation, RawAddCommentOperation, RawEditOperation } from '../types'
 * @import { RawDeleteCommentOperation, RawSetCommentStateOperation } from '../types'
 */

const DeleteCommentOperation = require('./delete_comment_operation')
const AddCommentOperation = require('./add_comment_operation')
const TextOperation = require('./text_operation')
const SetCommentStateOperation = require('./set_comment_state_operation')
const EditNoOperation = require('./edit_no_operation')

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
    if (isRawSetCommentStateOperation(raw)) {
      return SetCommentStateOperation.fromJSON(raw)
    }
    if (isRawEditNoOperation(raw)) {
      return EditNoOperation.fromJSON()
    }
    throw new Error('Unsupported operation in EditOperationBuilder.fromJSON')
  }
}

/**
 * @param {unknown} raw
 * @returns {raw is RawTextOperation}
 */
function isTextOperation(raw) {
  return raw !== null && typeof raw === 'object' && 'textOperation' in raw
}

/**
 * @param {unknown} raw
 * @returns {raw is RawAddCommentOperation}
 */
function isRawAddCommentOperation(raw) {
  return (
    raw !== null &&
    typeof raw === 'object' &&
    'commentId' in raw &&
    'ranges' in raw &&
    Array.isArray(raw.ranges)
  )
}

/**
 * @param {unknown} raw
 * @returns {raw is RawDeleteCommentOperation}
 */
function isRawDeleteCommentOperation(raw) {
  return raw !== null && typeof raw === 'object' && 'deleteComment' in raw
}

/**
 * @param {unknown} raw
 * @returns {raw is RawSetCommentStateOperation}
 */
function isRawSetCommentStateOperation(raw) {
  return (
    raw !== null &&
    typeof raw === 'object' &&
    'commentId' in raw &&
    'resolved' in raw &&
    typeof raw.resolved === 'boolean'
  )
}

/**
 * @param {unknown} raw
 * @returns {raw is RawEditNoOperation}
 */
function isRawEditNoOperation(raw) {
  return raw !== null && typeof raw === 'object' && 'noOp' in raw
}

module.exports = EditOperationBuilder
