// @ts-check
const core = require('../../index')
const EditNoOperation = require('./edit_no_operation')
const EditOperation = require('./edit_operation')

/**
 * @import AddCommentOperation from './add_comment_operation'
 * @import StringFileData from '../file_data/string_file_data'
 * @import { RawDeleteCommentOperation } from '../types'
 */

/**
 * @extends EditOperation
 */
class DeleteCommentOperation extends EditOperation {
  /**
   * @param {string} commentId
   */
  constructor(commentId) {
    super()
    this.commentId = commentId
  }

  /**
   * @inheritdoc
   * @returns {RawDeleteCommentOperation}
   */
  toJSON() {
    return {
      deleteComment: this.commentId,
    }
  }

  /**
   * @inheritdoc
   * @param {StringFileData} fileData
   */
  apply(fileData) {
    fileData.comments.delete(this.commentId)
  }

  /**
   * @inheritdoc
   * @param {StringFileData} previousState
   * @returns {AddCommentOperation | EditNoOperation}
   */
  invert(previousState) {
    const comment = previousState.comments.getComment(this.commentId)
    if (!comment) {
      return new EditNoOperation()
    }

    return new core.AddCommentOperation(
      comment.id,
      comment.ranges.slice(),
      comment.resolved
    )
  }

  /**
   * @inheritdoc
   * @param {RawDeleteCommentOperation} raw
   * @returns {DeleteCommentOperation}
   */
  static fromJSON(raw) {
    return new DeleteCommentOperation(raw.deleteComment)
  }
}

module.exports = DeleteCommentOperation
