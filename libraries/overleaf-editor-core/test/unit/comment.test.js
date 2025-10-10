// @ts-check
'use strict'

const { expect } = require('chai')
const Comment = require('../../lib/comment')
const Range = require('../../lib/range')

describe('Comment', function () {
  it('should move ranges to the right of insert', function () {
    const comment = new Comment('c1', [new Range(5, 10)])
    const resComment = comment.applyInsert(3, 5, false)
    expect(resComment.ranges).to.eql([new Range(10, 10)])
  })

  describe('applyInsert', function () {
    it('should insert 1 char before the range', function () {
      const comment = new Comment('c1', [new Range(5, 10)])
      expect(comment.applyInsert(4, 1).ranges).to.eql([new Range(6, 10)])
    })

    it('should insert 1 char at the edge, without expandCommand', function () {
      const comment = new Comment('c1', [new Range(5, 10)])
      expect(comment.applyInsert(5, 1).ranges).to.eql([new Range(6, 10)])
    })

    it('should insert 1 char at the edge, with expandCommand', function () {
      const comment = new Comment('c1', [new Range(5, 10)])
      expect(comment.applyInsert(5, 1, true).ranges).to.eql([new Range(5, 11)])
    })

    it('should expand the range after insert inside it', function () {
      const comment = new Comment('c1', [new Range(5, 10)])
      expect(comment.applyInsert(6, 1, true).ranges).to.eql([new Range(5, 11)])
    })
  })

  it('should split the range if inside another and expandComment is false', function () {
    const comment = new Comment('c1', [new Range(5, 10)])
    const commentRes = comment.applyInsert(6, 10, false)
    expect(commentRes.ranges).to.eql([new Range(5, 1), new Range(16, 9)])
  })

  it('should insert the range if expandComment is false', function () {
    const comment = new Comment('c1', [new Range(5, 10)])
    const commentRes = comment.applyInsert(14, 10, false)
    expect(commentRes.ranges).to.eql([new Range(5, 9), new Range(24, 1)])
  })

  it('should move the range if insert is at range start and expandComment is false', function () {
    const comment = new Comment('c1', [new Range(5, 10)])
    const commentRes = comment.applyInsert(5, 10, false)
    expect(commentRes.ranges).to.eql([new Range(15, 10)])
  })

  it('should ignore the range if insert is at range end and expandComment is false', function () {
    const comment = new Comment('c1', [new Range(5, 10)])
    const commentRes = comment.applyInsert(15, 10, false)
    expect(commentRes.ranges).to.eql([new Range(5, 10)])
  })

  it('should expand the range after inserting on the edge of it if expandComment is true', function () {
    const comment = new Comment('c1', [new Range(5, 10)])
    const commentRes = comment.applyInsert(15, 10, true)
    expect(commentRes.ranges).to.eql([new Range(5, 20)])
  })

  it('should move comment ranges if delete is before it', function () {
    const comment = new Comment('c1', [new Range(5, 10)])
    const commentRes = comment.applyDelete(new Range(3, 5))
    expect(commentRes.ranges).to.eql([new Range(3, 7)])
  })

  it('should merge ranges after delete', function () {
    const comment = new Comment('c1', [new Range(5, 10), new Range(20, 10)])
    const commentRes = comment.applyDelete(new Range(7, 18))
    expect(commentRes.ranges).to.eql([new Range(5, 7)])
  })

  it('should merge overlapping ranges', function () {
    const comment = new Comment('c1', [
      new Range(5, 10),
      new Range(15, 20),
      new Range(50, 10),
    ])
    expect(comment.ranges).to.eql([new Range(5, 30), new Range(50, 10)])
  })

  it('should merge unsorted ranges', function () {
    const comment = new Comment('c1', [
      new Range(15, 20),
      new Range(50, 10),
      new Range(5, 10),
    ])
    expect(comment.ranges).to.eql([new Range(5, 30), new Range(50, 10)])
  })

  it('should throw error when ranges overlap', function () {
    expect(
      () =>
        new Comment('c1', [
          new Range(5, 10),
          new Range(10, 5),
          new Range(50, 10),
        ])
    ).to.throw()
  })

  it('should join touching ranges', function () {
    const comment = new Comment('c1', [
      new Range(5, 10),
      new Range(15, 5),
      new Range(50, 10),
    ])
    expect(comment.ranges).to.eql([new Range(5, 15), new Range(50, 10)])
  })
})
