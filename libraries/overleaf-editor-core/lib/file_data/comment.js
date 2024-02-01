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
    this.ranges.sort((a, b) => a.firstIndex - b.firstIndex)
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
    const splittedRanges = []

    for (const commentRange of this.ranges) {
      if (commentRange.firstNextIndex === cursor) {
        // insert right after the comment
        if (extendComment) {
          commentRange.extendBy(length)
          existingRangeExtended = true
        }
      } else if (commentRange.firstIndex === cursor) {
        // insert at the start of the comment
        if (extendComment) {
          commentRange.extendBy(length)
          existingRangeExtended = true
        } else {
          commentRange.moveBy(length)
        }
      } else if (commentRange.firstIndexIsAfter(cursor)) {
        // insert before the comment
        commentRange.moveBy(length)
      } else if (commentRange.containsIndex(cursor)) {
        // insert is inside the comment
        if (extendComment) {
          commentRange.extendBy(length)
          existingRangeExtended = true
        } else {
          const [rangeUpToCursor, , rangeAfterCursor] = commentRange.insertAt(
            cursor,
            length
          )

          // use current commentRange for the part before the cursor
          commentRange.length = rangeUpToCursor.length
          // add the part after the cursor as a new range
          splittedRanges.push(rangeAfterCursor)
        }
      }
    }

    // add the splitted ranges
    for (const range of splittedRanges) {
      this.addRange(range)
    }

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
    for (const commentRange of this.ranges) {
      if (commentRange.overlaps(deletedRange)) {
        commentRange.subtract(deletedRange)
      } else if (commentRange.startsAfter(deletedRange)) {
        commentRange.pos -= deletedRange.length
      }
    }

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
      const lastRange = mergedRanges[mergedRanges.length - 1]

      if (lastRange?.canMerge(range)) {
        lastRange.merge(range)
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
