// @ts-check
const core = require('../../index')
const Comment = require('../comment')
const EditOperation = require('./edit_operation')

/**
 * @typedef {import('./delete_comment_operation')} DeleteCommentOperation
 * @typedef {import('../types').CommentRawData} CommentRawData
 * @typedef {import('../types').RawAddCommentOperation} RawAddCommentOperation
 * @typedef {import('../file_data/string_file_data')} StringFileData
 */

/**
 * @extends EditOperation
 */
class AddCommentOperation extends EditOperation {
  /**
   * @param {string} commentId
   * @param {Comment} comment
   */
  constructor(commentId, comment) {
    super()
    this.commentId = commentId
    this.comment = comment
  }

  /**
   *
   * @returns {RawAddCommentOperation}
   */
  toJSON() {
    return {
      ...this.comment.toRaw(),
      commentId: this.commentId,
    }
  }

  /**
   * @param {StringFileData} fileData
   */
  apply(fileData) {
    fileData.comments.add(this.commentId, this.comment)
  }

  /**
   *
   * @returns {DeleteCommentOperation}
   */
  invert() {
    return new core.DeleteCommentOperation(this.commentId)
  }

  /**
   * @inheritdoc
   * @param {EditOperation} other
   * @returns {boolean}
   */
  canBeComposedWith(other) {
    return (
      (other instanceof AddCommentOperation &&
        this.commentId === other.commentId) ||
      (other instanceof core.DeleteCommentOperation &&
        this.commentId === other.commentId)
    )
  }

  /**
   * @inheritdoc
   * @param {EditOperation} other
   * @returns {EditOperation}
   */
  compose(other) {
    if (
      other instanceof core.DeleteCommentOperation &&
      other.commentId === this.commentId
    ) {
      return other
    }

    if (
      other instanceof AddCommentOperation &&
      other.commentId === this.commentId
    ) {
      return other
    }

    throw new Error(
      `Trying to compose AddCommentOperation with ${other?.constructor?.name}.`
    )
  }

  /**
   * @inheritdoc
   * @param {RawAddCommentOperation} raw
   * @returns {AddCommentOperation}
   */
  static fromJSON(raw) {
    return new AddCommentOperation(raw.commentId, Comment.fromRaw(raw))
  }
}

module.exports = AddCommentOperation
