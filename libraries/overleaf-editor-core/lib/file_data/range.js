// @ts-check
class Range {
  /**
   * @param {number} pos
   * @param {number} length
   */
  constructor(pos, length) {
    this.pos = pos
    this.length = length
  }

  get start() {
    return this.pos
  }

  get end() {
    return this.pos + this.length
  }

  /**
   * @param {Range} range
   * @returns {boolean}
   */
  startsAfter(range) {
    return this.start >= range.end
  }

  /**
   * @param {number} pos
   * @returns {boolean}
   */
  startIsAfter(pos) {
    return this.start > pos
  }

  /**
   *
   * @returns {boolean}
   */
  isEmpty() {
    return this.length === 0
  }

  /**
   * checks if the range contains a given range
   * @param {Range} range
   */
  contains(range) {
    return this.start <= range.start && this.end >= range.end
  }

  /**
   * checks if the range contains a cursor (i.e. is not at the ends of the range)
   * @param {number} cursor
   */
  containsCursor(cursor) {
    return this.start <= cursor && this.end >= cursor
  }

  /**
   * @param {Range} range
   */
  overlaps(range) {
    return this.start < range.end && this.end > range.start
  }

  /**
   * checks if the range touches a given range
   * @param {Range} range
   */
  touches(range) {
    return this.end === range.start || this.start === range.end
  }

  /**
   * @param {Range} range
   * @returns {number} the length of the intersected range
   */
  subtract(range) {
    if (this.contains(range)) {
      this.length -= range.length
      return range.length
    }

    if (range.contains(this)) {
      const intersectedLength = this.length
      this.length = 0
      return intersectedLength
    }

    if (range.overlaps(this)) {
      if (range.start < this.start) {
        const intersectedLength = range.end - this.start
        this.length -= intersectedLength
        this.pos = range.pos
        return intersectedLength
      } else {
        const intersectedLength = this.end - range.start
        this.length -= intersectedLength
        return intersectedLength
      }
    }

    return 0
  }

  /**
   * @param {Range} range
   * @returns {boolean}
   */
  canMerge(range) {
    return this.overlaps(range) || this.touches(range)
  }

  /**
   * @param {Range} range
   */
  merge(range) {
    if (!this.canMerge(range)) {
      throw new Error('Ranges cannot be merged')
    }
    const newPos = Math.min(this.pos, range.pos)
    const newEnd = Math.max(this.end, range.end)
    this.pos = newPos
    this.length = newEnd - newPos
  }

  /**
   * Moves the range by a given number
   * @param {number} length
   */
  moveBy(length) {
    this.pos += length
  }

  /**
   * Extends the range by a given number
   * @param {number} extensionLength
   */
  extendBy(extensionLength) {
    this.length += extensionLength
  }

  /**
   * Splits a range on the cursor and insert a range with the length provided
   * @param {number} cursor
   * @param {number} length
   * @returns {[Range, Range, Range]}
   */
  insertAt(cursor, length) {
    if (!this.containsCursor(cursor)) {
      throw new Error('The cursor must be contained in the range')
    }
    const rangeUpToCursor = new Range(this.pos, cursor - this.pos)
    const insertedRange = new Range(cursor, length)
    const rangeAfterCursor = new Range(
      cursor + length,
      this.length - rangeUpToCursor.length
    )
    return [rangeUpToCursor, insertedRange, rangeAfterCursor]
  }

  toRaw() {
    return {
      pos: this.pos,
      length: this.length,
    }
  }

  static fromRaw(raw) {
    return new Range(raw.pos, raw.length)
  }

  /**
   * Splits a range into two ranges, at a given cursor
   * @param {number} cursor
   * @returns {[Range, Range]}
   */
  splitAt(cursor) {
    if (!this.containsCursor(cursor)) {
      throw new Error('The cursor must be contained in the range')
    }
    const rangeUpToCursor = new Range(this.pos, cursor - this.pos)
    const rangeAfterCursor = new Range(
      cursor,
      this.length - rangeUpToCursor.length
    )
    return [rangeUpToCursor, rangeAfterCursor]
  }
}

module.exports = Range
