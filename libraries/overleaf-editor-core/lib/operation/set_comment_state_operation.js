// @ts-check
const core = require('../../index')
const Comment = require('../comment')
const EditNoOperation = require('./edit_no_operation')
const EditOperation = require('./edit_operation')

/**
 * @import DeleteCommentOperation from './delete_comment_operation'
 * @import { CommentRawData } from '../types'
 * @import { RawSetCommentStateOperation } from '../types'
 * @import StringFileData from '../file_data/string_file_data'
 */

/**
 * @extends EditOperation
 */
class SetCommentStateOperation extends EditOperation {
  /**
   * @param {string} commentId
   * @param {boolean} resolved
   */
  constructor(commentId, resolved) {
    super()
    this.commentId = commentId
    this.resolved = resolved
  }

  /**
   *
   * @returns {RawSetCommentStateOperation}
   */
  toJSON() {
    return {
      resolved: this.resolved,
      commentId: this.commentId,
    }
  }

  /**
   * @param {StringFileData} fileData
   */
  apply(fileData) {
    const comment = fileData.comments.getComment(this.commentId)
    if (comment) {
      const newComment = new Comment(comment.id, comment.ranges, this.resolved)
      fileData.comments.add(newComment)
    }
  }

  /**
   * @param {StringFileData} previousState
   * @returns {SetCommentStateOperation | EditNoOperation}
   */
  invert(previousState) {
    const comment = previousState.comments.getComment(this.commentId)
    if (!comment) {
      return new EditNoOperation()
    }

    return new SetCommentStateOperation(this.commentId, comment.resolved)
  }

  /**
   * @inheritdoc
   * @param {EditOperation} other
   * @returns {boolean}
   */
  canBeComposedWith(other) {
    return (
      (other instanceof SetCommentStateOperation &&
        this.commentId === other.commentId) ||
      (other instanceof core.DeleteCommentOperation &&
        this.commentId === other.commentId)
    )
  }

  /**
   * @inheritdoc
   * @param {EditOperation} other
   * @returns {SetCommentStateOperation | core.DeleteCommentOperation}
   */
  compose(other) {
    if (
      other instanceof SetCommentStateOperation &&
      other.commentId === this.commentId
    ) {
      return other
    }

    if (
      other instanceof core.DeleteCommentOperation &&
      other.commentId === this.commentId
    ) {
      return other
    }

    throw new Error(
      `Trying to compose SetCommentStateOperation with ${other?.constructor?.name}.`
    )
  }

  /**
   * @inheritdoc
   * @param {RawSetCommentStateOperation} raw
   * @returns {SetCommentStateOperation}
   */
  static fromJSON(raw) {
    return new SetCommentStateOperation(raw.commentId, raw.resolved)
  }
}

module.exports = SetCommentStateOperation
