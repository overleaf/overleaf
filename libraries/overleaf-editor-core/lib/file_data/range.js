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

  get firstIndex() {
    return this.pos
  }

  /**
   * @returns {number} for an empty range, lastIndex will be -1
   */
  get lastIndex() {
    if (this.length === 0) {
      throw new Error('Range is empty')
    }
    return this.pos + this.length - 1
  }

  get firstNextIndex() {
    return this.pos + this.length
  }

  /**
   * @param {Range} range
   * @returns {boolean}
   */
  startsAfter(range) {
    return this.firstIndex >= range.firstNextIndex
  }

  /**
   * @param {number} pos
   * @returns {boolean}
   */
  firstIndexIsAfter(pos) {
    return this.firstIndex > pos
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
    return (
      this.firstIndex <= range.firstIndex && this.lastIndex >= range.lastIndex
    )
  }

  /**
   * checks if the range contains a given index
   * @param {number} index
   */
  containsIndex(index) {
    return this.firstIndex <= index && this.lastIndex >= index
  }

  /**
   * @param {Range} range
   */
  overlaps(range) {
    return (
      this.firstIndex < range.firstNextIndex &&
      this.firstNextIndex > range.firstIndex
    )
  }

  /**
   * checks if the range touches a given range
   * @param {Range} range
   */
  touches(range) {
    return (
      this.firstNextIndex === range.firstIndex ||
      this.firstIndex === range.firstNextIndex
    )
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
      if (range.firstIndex < this.firstIndex) {
        const intersectedLength = range.lastIndex - this.firstIndex + 1
        this.length -= intersectedLength
        this.pos = range.pos
        return intersectedLength
      } else {
        const intersectedLength = this.lastIndex - range.firstIndex + 1
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
    const newFirstIndex = Math.min(this.pos, range.pos)
    const newLastIndex = Math.max(this.lastIndex, range.lastIndex)
    this.pos = newFirstIndex
    this.length = newLastIndex + 1 - newFirstIndex
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
   * Splits a range on the index and insert a range with the length provided
   * @param {number} index
   * @param {number} length
   * @returns {[Range, Range, Range]}
   */
  insertAt(index, length) {
    if (!this.containsIndex(index)) {
      throw new Error('The index must be contained in the range')
    }
    const rangeUpToIndex = new Range(this.pos, index - this.pos)
    const insertedRange = new Range(index, length)
    const rangeAfterIndex = new Range(
      index + length,
      this.length - rangeUpToIndex.length
    )
    return [rangeUpToIndex, insertedRange, rangeAfterIndex]
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
}

module.exports = Range
