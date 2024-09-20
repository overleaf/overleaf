// @ts-check
const Comment = require('../comment')

/**
 * @import { CommentRawData } from "../types"
 * @import Range from "../range"
 */

class CommentList {
  /**
   * @param {Comment[]} comments
   */
  constructor(comments) {
    this.comments = new Map(comments.map(comment => [comment.id, comment]))
  }

  /**
   * @returns {IterableIterator<Comment>}
   */
  [Symbol.iterator]() {
    return this.comments.values()
  }

  /**
   * Returns the contents of this list in an array
   *
   * @returns {Comment[]}
   */
  toArray() {
    return Array.from(this)
  }

  /**
   * Return the length of the comment list
   *
   * @returns {number}
   */
  get length() {
    return this.comments.size
  }

  /**
   * Return the raw version of the comment list
   *
   * @returns {CommentRawData[]}
   */
  toRaw() {
    const raw = []
    for (const comment of this.comments.values()) {
      raw.push(comment.toRaw())
    }
    return raw
  }

  /**
   * @param {string} id
   * @returns {Comment | undefined}
   */
  getComment(id) {
    return this.comments.get(id)
  }

  /**
   * @param {Comment} newComment
   */
  add(newComment) {
    this.comments.set(newComment.id, newComment)
  }

  /**
   * @param {string} id
   */
  delete(id) {
    return this.comments.delete(id)
  }

  /**
   * @param {CommentRawData[]} rawComments
   */
  static fromRaw(rawComments) {
    return new CommentList(rawComments.map(Comment.fromRaw))
  }

  /**
   * @param {Range} range
   * @param {{ commentIds?: string[] }} opts
   */
  applyInsert(range, opts = { commentIds: [] }) {
    if (!opts.commentIds) {
      opts.commentIds = []
    }
    for (const [commentId, comment] of this.comments) {
      const commentAfterInsert = comment.applyInsert(
        range.pos,
        range.length,
        opts.commentIds.includes(commentId)
      )
      this.comments.set(commentId, commentAfterInsert)
    }
  }

  /**
   * @param {Range} range
   */
  applyDelete(range) {
    for (const [commentId, comment] of this.comments) {
      const commentAfterDelete = comment.applyDelete(range)
      this.comments.set(commentId, commentAfterDelete)
    }
  }

  /**
   *
   * @param {Range} range
   * @returns {string[]}
   */
  idsCoveringRange(range) {
    return Array.from(this.comments.entries())
      .filter(([, comment]) => comment.ranges.some(r => r.contains(range)))
      .map(([id]) => id)
  }
}

module.exports = CommentList
