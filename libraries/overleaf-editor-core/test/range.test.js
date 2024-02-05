// @ts-check
'use strict'

const { expect } = require('chai')
const Range = require('../lib/file_data/range')

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
      expect(from1to5.subtract(from0to1)).to.eql(0)
      expect(from1to5.start).to.eql(1)
      expect(from1to5.length).to.eql(6)
    })

    it('should subtract from the left', function () {
      const from5to19 = new Range(5, 15)
      const from15to24 = new Range(15, 10)
      expect(from15to24.subtract(from5to19)).to.eql(5)
      expect(from15to24.start).to.eql(5)
      expect(from15to24.end).to.eql(10)
    })

    it('should subtract from the right', function () {
      const from10to24 = new Range(10, 15)
      const from5to19 = new Range(5, 15)
      expect(from5to19.subtract(from10to24)).to.eql(10)
      expect(from5to19.start).to.eql(5)
      expect(from5to19.end).to.eql(10)
    })

    it('should subtract from the middle', function () {
      const from5to19 = new Range(5, 15)
      const from10to14 = new Range(10, 5)
      expect(from5to19.subtract(from10to14)).to.eql(5)
      expect(from5to19.start).to.eql(5)
      expect(from5to19.end).to.eql(15)
    })

    it('should delete entire range', function () {
      const from0to99 = new Range(0, 100)
      const from5to19 = new Range(5, 15)
      expect(from5to19.subtract(from0to99)).to.eql(15)
      expect(from5to19.start).to.eql(5)
      expect(from5to19.end).to.eql(5)
      expect(from5to19.length).to.eql(0)
    })

    it('should not subtract if ranges do not overlap', function () {
      const from5to14 = new Range(5, 10)
      const from20to29 = new Range(20, 10)
      expect(from5to14.subtract(from20to29)).to.eql(0)
      expect(from20to29.subtract(from5to14)).to.eql(0)
      expect(from5to14.start).to.eql(5)
      expect(from5to14.end).to.eql(15)
    })
  })

  describe('merge ranges', function () {
    it('should merge ranges overlaping at the end', function () {
      const from5to14 = new Range(5, 10)
      const from10to19 = new Range(10, 10)
      expect(from5to14.canMerge(from10to19)).to.eql(true)
      from5to14.merge(from10to19)
      expect(from5to14.start).to.eql(5)
      expect(from5to14.end).to.eql(20)
    })

    it('should merge ranges overlaping at the start', function () {
      const from5to14 = new Range(5, 10)
      const from0to9 = new Range(0, 10)
      expect(from5to14.canMerge(from0to9)).to.eql(true)
      from5to14.merge(from0to9)
      expect(from5to14.start).to.eql(0)
      expect(from5to14.end).to.eql(15)
    })

    it('should merge ranges if one is covered by another', function () {
      const from5to14 = new Range(5, 10)
      const from0to19 = new Range(0, 20)
      expect(from5to14.canMerge(from0to19)).to.eql(true)
      from5to14.merge(from0to19)
      expect(from5to14.toRaw()).deep.equal(from0to19.toRaw())
    })

    it('should produce the same length after merge', function () {
      const from5to14 = new Range(5, 10)
      const from0to19 = new Range(0, 20)
      expect(from0to19.canMerge(from5to14)).to.eql(true)
      from0to19.merge(from5to14)
      expect(from0to19.start).to.eql(0)
      expect(from0to19.end).to.eql(20)
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
    from5to14.extendBy(3)
    expect(from5to14.length).to.eql(13)
    expect(from5to14.start).to.eql(5)
    expect(from5to14.end).to.eql(18)
  })

  it('should move the range', function () {
    const from5to14 = new Range(5, 10)
    from5to14.moveBy(3)
    expect(from5to14.length).to.eql(10)
    expect(from5to14.start).to.eql(8)
    expect(from5to14.end).to.eql(18)
  })
})
