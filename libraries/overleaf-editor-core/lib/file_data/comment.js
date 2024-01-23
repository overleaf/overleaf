const Range = require('./range')

/**
 * @typedef {import("../types").CommentRawData} CommentRawData
 */

class Comment {
  /**
   * @param {Range[]} ranges
   * @param {boolean} [resolved]
   */
  constructor(ranges, resolved = false) {
    this.ranges = ranges
    this.resolved = resolved
  }

  toRaw() {
    return {
      resolved: this.resolved,
      ranges: this.ranges.map(range => range.toRaw()),
    }
  }

  /**
   * @param {CommentRawData} rawComment
   * @returns {Comment}
   */
  static fromRaw(rawComment) {
    return new Comment(
      rawComment.ranges.map(range => Range.fromRaw(range)),
      rawComment.resolved
    )
  }
}

module.exports = Comment
