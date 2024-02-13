// @ts-check
const Range = require('./range')

/**
 * @typedef {import("../types").CommentRawData} CommentRawData
 */

class Comment {
  /**
   * @type {Range[]}
   */
  ranges = []

  /**
   * @type {boolean}
   */
  resolved = false

  /**
   * @param {Range[]} ranges
   * @param {boolean} [resolved]
   */
  constructor(ranges, resolved = false) {
    this.resolved = resolved
    for (const range of ranges) {
      this.addRange(range)
    }
  }

  /**
   *
   * @param {Range} range
   */
  addRange(range) {
    this.ranges.push(range)
    this.ranges.sort((a, b) => a.start - b.start)
    this.mergeRanges()
  }

  /**
   *
   * @param {number} cursor
   * @param {number} length
   * @param {boolean} [extendComment]
   */
  applyInsert(cursor, length, extendComment = false) {
    let existingRangeExtended = false
    const newRanges = []

    for (const commentRange of this.ranges) {
      if (cursor === commentRange.end) {
        // insert right after the comment
        if (extendComment) {
          newRanges.push(commentRange.extendBy(length))
          existingRangeExtended = true
        } else {
          newRanges.push(commentRange)
        }
      } else if (cursor === commentRange.start) {
        // insert at the start of the comment
        if (extendComment) {
          newRanges.push(commentRange.extendBy(length))
          existingRangeExtended = true
        } else {
          newRanges.push(commentRange.moveBy(length))
        }
      } else if (commentRange.startIsAfter(cursor)) {
        // insert before the comment
        newRanges.push(commentRange.moveBy(length))
      } else if (commentRange.containsCursor(cursor)) {
        // insert is inside the comment
        if (extendComment) {
          newRanges.push(commentRange.extendBy(length))
          existingRangeExtended = true
        } else {
          const [rangeUpToCursor, , rangeAfterCursor] = commentRange.insertAt(
            cursor,
            length
          )

          // use current commentRange for the part before the cursor
          newRanges.push(new Range(commentRange.pos, rangeUpToCursor.length))
          // add the part after the cursor as a new range
          newRanges.push(rangeAfterCursor)
        }
      } else {
        // insert is after the comment
        newRanges.push(commentRange)
      }
    }

    this.ranges = newRanges

    // if the insert is not inside any range, add a new range
    if (extendComment && !existingRangeExtended) {
      this.addRange(new Range(cursor, length))
    }
  }

  /**
   *
   * @param {Range} deletedRange
   */
  applyDelete(deletedRange) {
    const newRanges = []

    for (const commentRange of this.ranges) {
      if (commentRange.overlaps(deletedRange)) {
        newRanges.push(commentRange.subtract(deletedRange))
      } else if (commentRange.startsAfter(deletedRange)) {
        newRanges.push(commentRange.moveBy(-deletedRange.length))
      } else {
        newRanges.push(commentRange)
      }
    }

    this.ranges = newRanges
    this.mergeRanges()
  }

  isEmpty() {
    return this.ranges.length === 0
  }

  toRaw() {
    return {
      resolved: this.resolved,
      ranges: this.ranges.map(range => range.toRaw()),
    }
  }

  mergeRanges() {
    /** @type {Range[]} */
    const mergedRanges = []

    for (const range of this.ranges) {
      if (range.isEmpty()) {
        continue
      }
      const lastMerged = mergedRanges[mergedRanges.length - 1]

      if (lastMerged?.canMerge(range)) {
        mergedRanges[mergedRanges.length - 1] = lastMerged.merge(range)
      } else {
        mergedRanges.push(range)
      }
    }

    this.ranges = mergedRanges
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
