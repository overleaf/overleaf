// @ts-check
'use strict'

const { expect } = require('chai')
const Comment = require('../lib/comment')
const Range = require('../lib/range')

describe('Comment', function () {
  it('should move ranges to the right of insert', function () {
    const comment = new Comment([new Range(5, 10)])
    comment.applyInsert(3, 5, false)
    expect(comment.ranges).to.eql([new Range(10, 10)])
  })

  it('should expand the range after insert inside it', function () {
    const comment = new Comment([new Range(5, 10)])
    comment.applyInsert(4, 1) // inserting 1 char before the range
    expect(comment.ranges).to.eql([new Range(6, 10)])
    comment.applyInsert(6, 1) // inserting 1 char at the edge (without expandCommand = false)
    expect(comment.ranges).to.eql([new Range(7, 10)])
    comment.applyInsert(7, 1, true) // inserting 1 char at the edge (with expandCommand = true)
    expect(comment.ranges).to.eql([new Range(7, 11)])
    comment.applyInsert(8, 1, true) // inserting 1 char inside the range
    expect(comment.ranges).to.eql([new Range(7, 12)])
  })

  it('should split the range if inside another and expandComment is false', function () {
    const comment1 = new Comment([new Range(5, 10)])
    comment1.applyInsert(6, 10, false)
    expect(comment1.ranges).to.eql([new Range(5, 1), new Range(16, 9)])

    // insert at the end of the range
    const comment2 = new Comment([new Range(5, 10)])
    comment2.applyInsert(14, 10, false)
    expect(comment2.ranges).to.eql([new Range(5, 9), new Range(24, 1)])
  })

  it('should move the range if insert is at range start and expandComment is false', function () {
    const comment = new Comment([new Range(5, 10)])
    comment.applyInsert(5, 10, false)
    expect(comment.ranges).to.eql([new Range(15, 10)])
  })

  it('should ignore the range if insert is at range end and expandComment is false', function () {
    const comment = new Comment([new Range(5, 10)])
    comment.applyInsert(15, 10, false)
    expect(comment.ranges).to.eql([new Range(5, 10)])
  })

  it('should expand the range after inserting on the edge of it if expandComment is true', function () {
    const comment = new Comment([new Range(5, 10)])
    comment.applyInsert(15, 10, true)
    expect(comment.ranges).to.eql([new Range(5, 20)])
  })

  it('should add a new range if expandComment is true and not inside any range', function () {
    const commentNoRanges = new Comment([])
    commentNoRanges.applyInsert(5, 10, true)
    expect(commentNoRanges.ranges).to.eql([new Range(5, 10)])

    const commentWithRanges = new Comment([new Range(5, 10)])
    commentWithRanges.applyInsert(50, 10, true)
    expect(commentWithRanges.ranges).to.eql([
      new Range(5, 10),
      new Range(50, 10),
    ])
  })

  it('should move ranges if delete is before it', function () {
    const from5to14 = new Comment([new Range(5, 10)])
    const from3to7 = new Range(3, 5)

    from5to14.applyDelete(from3to7)
    const from3to9 = new Range(3, 7)
    expect(from5to14.ranges).to.eql([from3to9])
  })

  it('should merge ranges after delete', function () {
    const comment = new Comment([new Range(5, 10), new Range(20, 10)])
    comment.applyDelete(new Range(7, 18))
    expect(comment.ranges).to.eql([new Range(5, 7)])
  })

  it('should merge overlapping ranges', function () {
    const comment = new Comment([
      new Range(5, 10),
      new Range(15, 20),
      new Range(50, 10),
    ])
    comment.mergeRanges()
    expect(comment.ranges).to.eql([new Range(5, 30), new Range(50, 10)])
  })

  it('should merge unsorted ranges', function () {
    const comment = new Comment([
      new Range(15, 20),
      new Range(50, 10),
      new Range(5, 10),
    ])
    comment.mergeRanges()
    expect(comment.ranges).to.eql([new Range(5, 30), new Range(50, 10)])
  })

  it('should ignore overlapped range', function () {
    const comment = new Comment([
      new Range(5, 10),
      new Range(10, 5),
      new Range(50, 10),
    ])
    comment.mergeRanges()
    expect(comment.ranges).to.eql([new Range(5, 10), new Range(50, 10)])
  })

  it('should join touching ranges', function () {
    const comment = new Comment([
      new Range(5, 10),
      new Range(15, 5),
      new Range(50, 10),
    ])
    comment.mergeRanges()
    expect(comment.ranges).to.eql([new Range(5, 15), new Range(50, 10)])
  })
})
