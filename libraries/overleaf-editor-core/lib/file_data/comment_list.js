const Comment = require('./comment')

/**
 * @typedef {import("../types").CommentRawData} CommentRawData
 */

class CommentList {
  /**
   * @param {Map<string, Comment>} comments
   */
  constructor(comments) {
    this.comments = comments
  }

  /**
   * @returns {CommentRawData[]}
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
    const existing = this.getComment(id)
    if (existing) {
      // todo: merge/split ranges
      existing.ranges = newComment.ranges
    } else {
      this.comments.set(id, newComment)
    }
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
    const comments = new Map()
    for (const rawComment of rawComments) {
      comments.set(rawComment.id, Comment.fromRaw(rawComment))
    }
    return new CommentList(comments)
  }
}

module.exports = CommentList
