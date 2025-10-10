'use strict'

const { expect } = require('chai')
const Range = require('../../lib/range')

describe('Range', function () {
  it('should create a range', function () {
    const from5to14 = new Range(5, 10)
    expect(from5to14.start).to.eql(5)
    expect(from5to14.end).to.eql(15)
  })

  it('should create a range using fromRaw', function () {
    const from5to14 = Range.fromRaw({ pos: 5, length: 10 })
    expect(from5to14.start).to.eql(5)
    expect(from5to14.end).to.eql(15)
  })

  it('should convert to raw', function () {
    const from5to14 = new Range(5, 10)
    expect(from5to14.toRaw()).to.eql({ pos: 5, length: 10 })
  })

  it('should check isEmpty method', function () {
    const from5to14 = new Range(5, 10)
    expect(from5to14.isEmpty()).to.be.false

    const range0length = new Range(5, 0)
    expect(range0length.isEmpty()).to.be.true
  })

  it('should not create a range with a negative position', function () {
    expect(() => new Range(-1, 10)).to.throw
  })

  it('should not create a range with a negative length', function () {
    expect(() => new Range(0, -2)).to.throw
  })

  describe('overlaps', function () {
    it('same ranges should overlap', function () {
      const range1 = new Range(1, 3)
      const range2 = new Range(1, 3)
      expect(range1.overlaps(range2)).to.eql(true)
    })

    it('non-touching ranges should not overlap', function () {
      const from1to3 = new Range(1, 3)
      const from10to12 = new Range(10, 3)
      expect(from1to3.overlaps(from10to12)).to.eql(false)
      expect(from10to12.overlaps(from1to3)).to.eql(false)
    })

    it('touching ranges should not overlap', function () {
      const from1to3 = new Range(1, 3)
      const from4to6 = new Range(4, 3)
      expect(from1to3.overlaps(from4to6)).to.eql(false)
      expect(from4to6.overlaps(from1to3)).to.eql(false)
    })

    it('should overlap', function () {
      const from1to3 = new Range(1, 3)
      const from2to4 = new Range(2, 3)
      expect(from1to3.overlaps(from2to4)).to.eql(true)
      expect(from2to4.overlaps(from1to3)).to.eql(true)
    })
  })

  describe('touches', function () {
    it('should not touch if ranges are the same', function () {
      const range1 = new Range(1, 3)
      const range2 = new Range(1, 3)
      expect(range1.touches(range2)).to.eql(false)
      expect(range2.touches(range1)).to.eql(false)
    })

    it('should return true when ranges touch at one point', function () {
      const from1to3 = new Range(1, 3)
      const from4to5 = new Range(4, 2)
      expect(from1to3.touches(from4to5)).to.eql(true)
      expect(from4to5.touches(from1to3)).to.eql(true)
    })

    it('should return false when ranges do not touch', function () {
      const from1to3 = new Range(1, 3)
      const from5to6 = new Range(5, 2)
      expect(from1to3.touches(from5to6)).to.eql(false)
      expect(from5to6.touches(from1to3)).to.eql(false)
    })

    it('should return false when ranges overlap', function () {
      const from1to3 = new Range(1, 3)
      const from3to4 = new Range(3, 2)
      expect(from1to3.touches(from3to4)).to.eql(false)
      expect(from3to4.touches(from1to3)).to.eql(false)
    })
  })

  it('should check if range contains another', function () {
    const from0to2 = new Range(0, 3)
    const from4to13 = new Range(4, 10)
    const from4to14 = new Range(4, 11)
    const from4to15 = new Range(4, 12)
    const from5to13 = new Range(5, 9)
    const from5to14 = new Range(5, 10)
    const from5to15 = new Range(5, 11)
    const from0to99 = new Range(0, 100)

    expect(from0to2.contains(from0to2)).to.eql(true)
    expect(from0to2.contains(from4to13)).to.eql(false)
    expect(from0to2.contains(from4to14)).to.eql(false)
    expect(from0to2.contains(from4to15)).to.eql(false)
    expect(from0to2.contains(from5to13)).to.eql(false)
    expect(from0to2.contains(from5to14)).to.eql(false)
    expect(from0to2.contains(from5to15)).to.eql(false)
    expect(from0to2.contains(from0to99)).to.eql(false)

    expect(from4to13.contains(from0to2)).to.eql(false)
    expect(from4to13.contains(from4to13)).to.eql(true)
    expect(from4to13.contains(from4to14)).to.eql(false)
    expect(from4to13.contains(from4to15)).to.eql(false)
    expect(from4to13.contains(from5to13)).to.eql(true)
    expect(from4to13.contains(from5to14)).to.eql(false)
    expect(from4to13.contains(from5to15)).to.eql(false)
    expect(from4to13.contains(from0to99)).to.eql(false)

    expect(from4to14.contains(from0to2)).to.eql(false)
    expect(from4to14.contains(from4to13)).to.eql(true)
    expect(from4to14.contains(from4to14)).to.eql(true)
    expect(from4to14.contains(from4to15)).to.eql(false)
    expect(from4to14.contains(from5to13)).to.eql(true)
    expect(from4to14.contains(from5to14)).to.eql(true)
    expect(from4to14.contains(from5to15)).to.eql(false)
    expect(from4to14.contains(from0to99)).to.eql(false)

    expect(from4to15.contains(from0to2)).to.eql(false)
    expect(from4to15.contains(from4to13)).to.eql(true)
    expect(from4to15.contains(from4to14)).to.eql(true)
    expect(from4to15.contains(from4to15)).to.eql(true)
    expect(from4to15.contains(from5to13)).to.eql(true)
    expect(from4to15.contains(from5to14)).to.eql(true)
    expect(from4to15.contains(from5to15)).to.eql(true)
    expect(from4to15.contains(from0to99)).to.eql(false)

    expect(from5to13.contains(from0to2)).to.eql(false)
    expect(from5to13.contains(from4to13)).to.eql(false)
    expect(from5to13.contains(from4to14)).to.eql(false)
    expect(from5to13.contains(from4to15)).to.eql(false)
    expect(from5to13.contains(from5to13)).to.eql(true)
    expect(from5to13.contains(from5to14)).to.eql(false)
    expect(from5to13.contains(from5to15)).to.eql(false)
    expect(from5to13.contains(from0to99)).to.eql(false)

    expect(from5to14.contains(from0to2)).to.eql(false)
    expect(from5to14.contains(from4to13)).to.eql(false)
    expect(from5to14.contains(from4to14)).to.eql(false)
    expect(from5to14.contains(from4to15)).to.eql(false)
    expect(from5to14.contains(from5to13)).to.eql(true)
    expect(from5to14.contains(from5to14)).to.eql(true)
    expect(from5to14.contains(from5to15)).to.eql(false)
    expect(from5to14.contains(from0to99)).to.eql(false)

    expect(from5to15.contains(from0to2)).to.eql(false)
    expect(from5to15.contains(from4to13)).to.eql(false)
    expect(from5to15.contains(from4to14)).to.eql(false)
    expect(from5to15.contains(from4to15)).to.eql(false)
    expect(from5to15.contains(from5to13)).to.eql(true)
    expect(from5to15.contains(from5to14)).to.eql(true)
    expect(from5to15.contains(from5to15)).to.eql(true)
    expect(from5to15.contains(from0to99)).to.eql(false)

    expect(from0to99.contains(from0to2)).to.eql(true)
    expect(from0to99.contains(from4to13)).to.eql(true)
    expect(from0to99.contains(from4to14)).to.eql(true)
    expect(from0to99.contains(from4to15)).to.eql(true)
    expect(from0to99.contains(from5to13)).to.eql(true)
    expect(from0to99.contains(from5to14)).to.eql(true)
    expect(from0to99.contains(from5to15)).to.eql(true)
    expect(from0to99.contains(from0to99)).to.eql(true)
  })

  it('should check if range contains a cursor', function () {
    const from5to14 = new Range(5, 10)
    expect(from5to14.containsCursor(4)).to.eql(false)
    expect(from5to14.containsCursor(5)).to.eql(true)
    expect(from5to14.containsCursor(6)).to.eql(true)
    expect(from5to14.containsCursor(14)).to.eql(true)
    expect(from5to14.containsCursor(15)).to.eql(true)
    expect(from5to14.containsCursor(16)).to.eql(false)
  })

  describe('subtract range from another', function () {
    it('should not subtract', function () {
      const from1to5 = new Range(1, 6)
      const from0to1 = new Range(0, 1)
      const subtracted = from1to5.subtract(from0to1)
      expect(subtracted.start).to.eql(1)
      expect(subtracted.length).to.eql(6)
    })

    it('should subtract from the left', function () {
      const from5to19 = new Range(5, 15)
      const from15to24 = new Range(15, 10)
      const subtracted = from15to24.subtract(from5to19)
      expect(subtracted.start).to.eql(5)
      expect(subtracted.end).to.eql(10)
    })

    it('should subtract from the right', function () {
      const from10to24 = new Range(10, 15)
      const from5to19 = new Range(5, 15)
      const subtracted = from5to19.subtract(from10to24)
      expect(subtracted.start).to.eql(5)
      expect(subtracted.end).to.eql(10)
    })

    it('should subtract from the middle', function () {
      const from5to19 = new Range(5, 15)
      const from10to14 = new Range(10, 5)
      const subtracted = from5to19.subtract(from10to14)
      expect(subtracted.start).to.eql(5)
      expect(subtracted.end).to.eql(15)
    })

    it('should delete entire range', function () {
      const from0to99 = new Range(0, 100)
      const from5to19 = new Range(5, 15)
      const subtracted = from5to19.subtract(from0to99)
      expect(subtracted.start).to.eql(5)
      expect(subtracted.end).to.eql(5)
      expect(subtracted.length).to.eql(0)
    })

    it('should not subtract if ranges do not overlap', function () {
      const from5to14 = new Range(5, 10)
      const from20to29 = new Range(20, 10)
      const subtracted1 = from5to14.subtract(from20to29)
      const subtracted2 = from20to29.subtract(from5to14)
      expect(subtracted1.toRaw()).deep.equal(from5to14.toRaw())
      expect(subtracted2.toRaw()).deep.equal(from20to29.toRaw())
    })
  })

  describe('merge ranges', function () {
    it('should merge ranges overlaping at the end', function () {
      const from5to14 = new Range(5, 10)
      const from10to19 = new Range(10, 10)
      expect(from5to14.canMerge(from10to19)).to.eql(true)
      const result = from5to14.merge(from10to19)
      expect(result.start).to.eql(5)
      expect(result.end).to.eql(20)
    })

    it('should merge ranges overlaping at the start', function () {
      const from5to14 = new Range(5, 10)
      const from0to9 = new Range(0, 10)
      expect(from5to14.canMerge(from0to9)).to.eql(true)
      const result = from5to14.merge(from0to9)
      expect(result.start).to.eql(0)
      expect(result.end).to.eql(15)
    })

    it('should merge ranges if one is covered by another', function () {
      const from5to14 = new Range(5, 10)
      const from0to19 = new Range(0, 20)
      expect(from5to14.canMerge(from0to19)).to.eql(true)
      const result = from5to14.merge(from0to19)
      expect(result.toRaw()).deep.equal(from0to19.toRaw())
    })

    it('should produce the same length after merge', function () {
      const from5to14 = new Range(5, 10)
      const from0to19 = new Range(0, 20)
      expect(from0to19.canMerge(from5to14)).to.eql(true)
      const result = from0to19.merge(from5to14)
      expect(result.start).to.eql(0)
      expect(result.end).to.eql(20)
    })

    it('should not merge ranges if they do not overlap', function () {
      const from5to14 = new Range(5, 10)
      const from20to29 = new Range(20, 10)
      expect(from5to14.canMerge(from20to29)).to.eql(false)
      expect(from20to29.canMerge(from5to14)).to.eql(false)
      expect(() => from5to14.merge(from20to29)).to.throw()
    })
  })

  it('should check if range starts after a range', function () {
    const from0to4 = new Range(0, 5)
    const from1to5 = new Range(1, 5)
    const from5to9 = new Range(5, 5)
    const from6to10 = new Range(6, 5)
    const from10to14 = new Range(10, 5)

    expect(from0to4.startsAfter(from0to4)).to.eql(false)
    expect(from0to4.startsAfter(from1to5)).to.eql(false)
    expect(from0to4.startsAfter(from5to9)).to.eql(false)
    expect(from0to4.startsAfter(from6to10)).to.eql(false)
    expect(from0to4.startsAfter(from10to14)).to.eql(false)

    expect(from1to5.startsAfter(from0to4)).to.eql(false)
    expect(from1to5.startsAfter(from1to5)).to.eql(false)
    expect(from1to5.startsAfter(from5to9)).to.eql(false)
    expect(from1to5.startsAfter(from6to10)).to.eql(false)
    expect(from1to5.startsAfter(from10to14)).to.eql(false)

    expect(from5to9.startsAfter(from0to4)).to.eql(true)
    expect(from5to9.startsAfter(from1to5)).to.eql(false)
    expect(from5to9.startsAfter(from5to9)).to.eql(false)
    expect(from5to9.startsAfter(from6to10)).to.eql(false)
    expect(from5to9.startsAfter(from10to14)).to.eql(false)

    expect(from6to10.startsAfter(from0to4)).to.eql(true)
    expect(from6to10.startsAfter(from1to5)).to.eql(true)
    expect(from6to10.startsAfter(from5to9)).to.eql(false)
    expect(from6to10.startsAfter(from6to10)).to.eql(false)
    expect(from6to10.startsAfter(from10to14)).to.eql(false)

    expect(from10to14.startsAfter(from0to4)).to.eql(true)
    expect(from10to14.startsAfter(from1to5)).to.eql(true)
    expect(from10to14.startsAfter(from5to9)).to.eql(true)
    expect(from10to14.startsAfter(from6to10)).to.eql(false)
    expect(from10to14.startsAfter(from10to14)).to.eql(false)
  })

  it('should check if range starts after a position', function () {
    const from5to14 = new Range(5, 10)
    expect(from5to14.startIsAfter(3)).to.be.true
    expect(from5to14.startIsAfter(4)).to.be.true
    expect(from5to14.startIsAfter(5)).to.be.false
    expect(from5to14.startIsAfter(6)).to.be.false
    expect(from5to14.startIsAfter(15)).to.be.false
    expect(from5to14.startIsAfter(16)).to.be.false
  })

  it('should extend the range', function () {
    const from5to14 = new Range(5, 10)
    const result = from5to14.extendBy(3)
    expect(result.length).to.eql(13)
    expect(result.start).to.eql(5)
    expect(result.end).to.eql(18)
  })

  it('should shrink the range', function () {
    const from5to14 = new Range(5, 10)
    const result = from5to14.shrinkBy(3)
    expect(result.length).to.eql(7)
    expect(result.start).to.eql(5)
    expect(result.end).to.eql(12)
  })

  it('should throw if shrinking too much', function () {
    const from5to14 = new Range(5, 10)
    expect(() => from5to14.shrinkBy(11)).to.throw()
  })

  it('should move the range', function () {
    const from5to14 = new Range(5, 10)
    const result = from5to14.moveBy(3)
    expect(result.length).to.eql(10)
    expect(result.start).to.eql(8)
    expect(result.end).to.eql(18)
  })

  describe('splitAt', function () {
    it('should split at the start', function () {
      const range = new Range(5, 10)
      const [left, right] = range.splitAt(5)
      expect(left.isEmpty()).to.be.true
      expect(right.start).to.eql(5)
      expect(right.end).to.eql(15)
    })

    it('should not split before the start', function () {
      const range = new Range(5, 10)
      expect(() => range.splitAt(4)).to.throw()
    })

    it('should split at last cursor in range', function () {
      const range = new Range(5, 10)
      const [left, right] = range.splitAt(14)
      expect(left.start).to.equal(5)
      expect(left.end).to.equal(14)
      expect(right.start).to.equal(14)
      expect(right.end).to.equal(15)
    })

    it('should not split after the end', function () {
      const range = new Range(5, 10)
      expect(() => range.splitAt(16)).to.throw()
    })

    it('should split at end', function () {
      const range = new Range(5, 10)
      const [left, right] = range.splitAt(15)
      expect(left.start).to.equal(5)
      expect(left.end).to.equal(15)
      expect(right.start).to.equal(15)
      expect(right.end).to.equal(15)
    })

    it('should split in the middle', function () {
      const range = new Range(5, 10)
      const [left, right] = range.splitAt(10)
      expect(left.start).to.equal(5)
      expect(left.end).to.equal(10)
      expect(right.start).to.equal(10)
      expect(right.end).to.equal(15)
    })
  })

  describe('insertAt', function () {
    it('should insert at the start', function () {
      const range = new Range(5, 10)
      const [left, inserted, right] = range.insertAt(5, 3)
      expect(left.isEmpty()).to.be.true
      expect(inserted.start).to.eql(5)
      expect(inserted.end).to.eql(8)
      expect(right.start).to.eql(8)
      expect(right.end).to.eql(18)
    })

    it('should insert at the end', function () {
      const range = new Range(5, 10)
      const [left, inserted, right] = range.insertAt(15, 3)
      expect(left.start).to.eql(5)
      expect(left.end).to.eql(15)
      expect(inserted.start).to.eql(15)
      expect(inserted.end).to.eql(18)
      expect(right.isEmpty()).to.be.true
    })

    it('should insert in the middle', function () {
      const range = new Range(5, 10)
      const [left, inserted, right] = range.insertAt(10, 3)
      expect(left.start).to.eql(5)
      expect(left.end).to.eql(10)
      expect(inserted.start).to.eql(10)
      expect(inserted.end).to.eql(13)
      expect(right.start).to.eql(13)
      expect(right.end).to.eql(18)
    })

    it('should throw if cursor is out of range', function () {
      const range = new Range(5, 10)
      expect(() => range.insertAt(4, 3)).to.throw()
      expect(() => range.insertAt(16, 3)).to.throw()
    })
  })

  describe('intersect', function () {
    it('should handle partially overlapping ranges', function () {
      const range1 = new Range(5, 10)
      const range2 = new Range(3, 6)
      const intersection1 = range1.intersect(range2)
      expect(intersection1.pos).to.equal(5)
      expect(intersection1.length).to.equal(4)
      const intersection2 = range2.intersect(range1)
      expect(intersection2.pos).to.equal(5)
      expect(intersection2.length).to.equal(4)
    })

    it('should intersect with itself', function () {
      const range = new Range(5, 10)
      const intersection = range.intersect(range)
      expect(intersection.pos).to.equal(5)
      expect(intersection.length).to.equal(10)
    })

    it('should handle nested ranges', function () {
      const range1 = new Range(5, 10)
      const range2 = new Range(7, 2)
      const intersection1 = range1.intersect(range2)
      expect(intersection1.pos).to.equal(7)
      expect(intersection1.length).to.equal(2)
      const intersection2 = range2.intersect(range1)
      expect(intersection2.pos).to.equal(7)
      expect(intersection2.length).to.equal(2)
    })

    it('should handle disconnected ranges', function () {
      const range1 = new Range(5, 10)
      const range2 = new Range(20, 30)
      const intersection1 = range1.intersect(range2)
      expect(intersection1).to.be.null
      const intersection2 = range2.intersect(range1)
      expect(intersection2).to.be.null
    })
  })
})
