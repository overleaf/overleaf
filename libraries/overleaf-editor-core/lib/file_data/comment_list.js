// @ts-check
const Comment = require('../comment')

/**
 * @typedef {import("../types").CommentsListRawData} CommentsListRawData
 * @typedef {import("../range")} Range
 */

class CommentList {
  /**
   * @param {Map<string, Comment>} comments
   */
  constructor(comments) {
    this.comments = comments
  }

  /**
   * @returns {CommentsListRawData}
   */
  getComments() {
    return Array.from(this.comments).map(([commentId, comment]) => {
      return {
        id: commentId,
        ...comment.toRaw(),
      }
    })
  }

  /**
   * @param {string} id
   * @returns {Comment | undefined}
   */
  getComment(id) {
    return this.comments.get(id)
  }

  /**
   * @param {string} id
   * @param {Comment} newComment
   */
  add(id, newComment) {
    this.comments.set(id, newComment)
  }

  /**
   * @param {string} id
   */
  delete(id) {
    return this.comments.delete(id)
  }

  /**
   * @param {CommentsListRawData} rawComments
   */
  static fromRaw(rawComments) {
    const comments = new Map()
    for (const rawComment of rawComments) {
      comments.set(rawComment.id, Comment.fromRaw(rawComment))
    }
    return new CommentList(comments)
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
