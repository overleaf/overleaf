class Range {
  /**
   * @param {number} pos
   * @param {number} length
   */
  constructor(pos, length) {
    this.pos = pos
    this.length = length
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
