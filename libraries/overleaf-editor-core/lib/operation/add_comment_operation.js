// @ts-check
const core = require('../../index')
const Comment = require('../comment')
const Range = require('../range')
const EditOperation = require('./edit_operation')

/**
 * @import DeleteCommentOperation from './delete_comment_operation'
 * @import { CommentRawData, RawAddCommentOperation } from '../types'
 * @import StringFileData from '../file_data/string_file_data'
 */

/**
 * @extends EditOperation
 */
class AddCommentOperation extends EditOperation {
  /**
   * @param {string} commentId
   * @param {ReadonlyArray<Range>} ranges
   * @param {boolean} resolved
   */
  constructor(commentId, ranges, resolved = false) {
    super()

    for (const range of ranges) {
      if (range.isEmpty()) {
        throw new Error("AddCommentOperation can't be built with empty ranges")
      }
    }

    /** @readonly */
    this.commentId = commentId

    /** @readonly */
    this.ranges = ranges

    /** @readonly */
    this.resolved = resolved
  }

  /**
   *
   * @returns {RawAddCommentOperation}
   */
  toJSON() {
    /** @type RawAddCommentOperation */
    const raw = {
      commentId: this.commentId,
      ranges: this.ranges.map(range => range.toRaw()),
    }
    if (this.resolved) {
      raw.resolved = true
    }
    return raw
  }

  /**
   * @param {StringFileData} fileData
   */
  apply(fileData) {
    fileData.comments.add(
      new Comment(this.commentId, this.ranges, this.resolved)
    )
  }

  /**
   * @inheritdoc
   * @param {StringFileData} previousState
   * @returns {EditOperation}
   */
  invert(previousState) {
    const comment = previousState.comments.getComment(this.commentId)
    if (!comment) {
      return new core.DeleteCommentOperation(this.commentId)
    }

    return new core.AddCommentOperation(
      comment.id,
      comment.ranges.slice(),
      comment.resolved
    )
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
        this.commentId === other.commentId) ||
      (other instanceof core.SetCommentStateOperation &&
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

    if (
      other instanceof core.SetCommentStateOperation &&
      other.commentId === this.commentId
    ) {
      return new AddCommentOperation(
        this.commentId,
        this.ranges,
        other.resolved
      )
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
    return new AddCommentOperation(
      raw.commentId,
      raw.ranges.map(Range.fromRaw),
      raw.resolved ?? false
    )
  }
}

module.exports = AddCommentOperation
