export class Range {
  from: number
  to: number

  constructor(from: number, to: number) {
    this.from = from
    this.to = to
  }

  contains(pos: number, allowBoundaries = true) {
    return allowBoundaries
      ? pos >= this.from && pos <= this.to
      : pos > this.from && pos < this.to
  }

  // Ranges that touch but don't overlap are not considered to intersect
  intersects(range: Range) {
    return this.contains(range.from, false) || this.contains(range.to, false)
  }

  touchesOrIntersects(range: Range) {
    return this.contains(range.from, true) || this.contains(range.to, true)
  }
}
