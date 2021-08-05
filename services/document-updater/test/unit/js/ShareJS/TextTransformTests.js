/* eslint-disable
    camelcase,
    mocha/no-identical-title,
    no-return-assign,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS202: Simplify dynamic range loops
 * DS205: Consider reworking code to avoid use of IIFEs
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const text = require('../../../../app/js/sharejs/types/text')
const RangesTracker = require('../../../../app/js/RangesTracker')

describe('ShareJS text type', function () {
  beforeEach(function () {
    return (this.t = 'mock-thread-id')
  })

  describe('transform', function () {
    describe('insert / insert', function () {
      it('with an insert before', function () {
        const dest = []
        text._tc(dest, { i: 'foo', p: 9 }, { i: 'bar', p: 3 })
        return dest.should.deep.equal([{ i: 'foo', p: 12 }])
      })

      it('with an insert after', function () {
        const dest = []
        text._tc(dest, { i: 'foo', p: 3 }, { i: 'bar', p: 9 })
        return dest.should.deep.equal([{ i: 'foo', p: 3 }])
      })

      it("with an insert at the same place with side == 'right'", function () {
        const dest = []
        text._tc(dest, { i: 'foo', p: 3 }, { i: 'bar', p: 3 }, 'right')
        return dest.should.deep.equal([{ i: 'foo', p: 6 }])
      })

      return it("with an insert at the same place with side == 'left'", function () {
        const dest = []
        text._tc(dest, { i: 'foo', p: 3 }, { i: 'bar', p: 3 }, 'left')
        return dest.should.deep.equal([{ i: 'foo', p: 3 }])
      })
    })

    describe('insert / delete', function () {
      it('with a delete before', function () {
        const dest = []
        text._tc(dest, { i: 'foo', p: 9 }, { d: 'bar', p: 3 })
        return dest.should.deep.equal([{ i: 'foo', p: 6 }])
      })

      it('with a delete after', function () {
        const dest = []
        text._tc(dest, { i: 'foo', p: 3 }, { d: 'bar', p: 9 })
        return dest.should.deep.equal([{ i: 'foo', p: 3 }])
      })

      it("with a delete at the same place with side == 'right'", function () {
        const dest = []
        text._tc(dest, { i: 'foo', p: 3 }, { d: 'bar', p: 3 }, 'right')
        return dest.should.deep.equal([{ i: 'foo', p: 3 }])
      })

      return it("with a delete at the same place with side == 'left'", function () {
        const dest = []

        text._tc(dest, { i: 'foo', p: 3 }, { d: 'bar', p: 3 }, 'left')
        return dest.should.deep.equal([{ i: 'foo', p: 3 }])
      })
    })

    describe('delete / insert', function () {
      it('with an insert before', function () {
        const dest = []
        text._tc(dest, { d: 'foo', p: 9 }, { i: 'bar', p: 3 })
        return dest.should.deep.equal([{ d: 'foo', p: 12 }])
      })

      it('with an insert after', function () {
        const dest = []
        text._tc(dest, { d: 'foo', p: 3 }, { i: 'bar', p: 9 })
        return dest.should.deep.equal([{ d: 'foo', p: 3 }])
      })

      it("with an insert at the same place with side == 'right'", function () {
        const dest = []
        text._tc(dest, { d: 'foo', p: 3 }, { i: 'bar', p: 3 }, 'right')
        return dest.should.deep.equal([{ d: 'foo', p: 6 }])
      })

      it("with an insert at the same place with side == 'left'", function () {
        const dest = []
        text._tc(dest, { d: 'foo', p: 3 }, { i: 'bar', p: 3 }, 'left')
        return dest.should.deep.equal([{ d: 'foo', p: 6 }])
      })

      return it('with a delete that overlaps the insert location', function () {
        const dest = []
        text._tc(dest, { d: 'foo', p: 3 }, { i: 'bar', p: 4 })
        return dest.should.deep.equal([
          { d: 'f', p: 3 },
          { d: 'oo', p: 6 },
        ])
      })
    })

    describe('delete / delete', function () {
      it('with a delete before', function () {
        const dest = []
        text._tc(dest, { d: 'foo', p: 9 }, { d: 'bar', p: 3 })
        return dest.should.deep.equal([{ d: 'foo', p: 6 }])
      })

      it('with a delete after', function () {
        const dest = []
        text._tc(dest, { d: 'foo', p: 3 }, { d: 'bar', p: 9 })
        return dest.should.deep.equal([{ d: 'foo', p: 3 }])
      })

      it('with deleting the same content', function () {
        const dest = []
        text._tc(dest, { d: 'foo', p: 3 }, { d: 'foo', p: 3 }, 'right')
        return dest.should.deep.equal([])
      })

      it('with the delete overlapping before', function () {
        const dest = []
        text._tc(dest, { d: 'foobar', p: 3 }, { d: 'abcfoo', p: 0 }, 'right')
        return dest.should.deep.equal([{ d: 'bar', p: 0 }])
      })

      it('with the delete overlapping after', function () {
        const dest = []
        text._tc(dest, { d: 'abcfoo', p: 3 }, { d: 'foobar', p: 6 })
        return dest.should.deep.equal([{ d: 'abc', p: 3 }])
      })

      it('with the delete overlapping the whole delete', function () {
        const dest = []
        text._tc(dest, { d: 'abcfoo123', p: 3 }, { d: 'foo', p: 6 })
        return dest.should.deep.equal([{ d: 'abc123', p: 3 }])
      })

      return it('with the delete inside the whole delete', function () {
        const dest = []
        text._tc(dest, { d: 'foo', p: 6 }, { d: 'abcfoo123', p: 3 })
        return dest.should.deep.equal([])
      })
    })

    describe('comment / insert', function () {
      it('with an insert before', function () {
        const dest = []
        text._tc(dest, { c: 'foo', p: 9, t: this.t }, { i: 'bar', p: 3 })
        return dest.should.deep.equal([{ c: 'foo', p: 12, t: this.t }])
      })

      it('with an insert after', function () {
        const dest = []
        text._tc(dest, { c: 'foo', p: 3, t: this.t }, { i: 'bar', p: 9 })
        return dest.should.deep.equal([{ c: 'foo', p: 3, t: this.t }])
      })

      it('with an insert at the left edge', function () {
        const dest = []
        text._tc(dest, { c: 'foo', p: 3, t: this.t }, { i: 'bar', p: 3 })
        // RangesTracker doesn't inject inserts into comments on edges, so neither should we
        return dest.should.deep.equal([{ c: 'foo', p: 6, t: this.t }])
      })

      it('with an insert at the right edge', function () {
        const dest = []
        text._tc(dest, { c: 'foo', p: 3, t: this.t }, { i: 'bar', p: 6 })
        // RangesTracker doesn't inject inserts into comments on edges, so neither should we
        return dest.should.deep.equal([{ c: 'foo', p: 3, t: this.t }])
      })

      return it('with an insert in the middle', function () {
        const dest = []
        text._tc(dest, { c: 'foo', p: 3, t: this.t }, { i: 'bar', p: 5 })
        return dest.should.deep.equal([{ c: 'fobaro', p: 3, t: this.t }])
      })
    })

    describe('comment / delete', function () {
      it('with a delete before', function () {
        const dest = []
        text._tc(dest, { c: 'foo', p: 9, t: this.t }, { d: 'bar', p: 3 })
        return dest.should.deep.equal([{ c: 'foo', p: 6, t: this.t }])
      })

      it('with a delete after', function () {
        const dest = []
        text._tc(dest, { c: 'foo', p: 3, t: this.t }, { i: 'bar', p: 9 })
        return dest.should.deep.equal([{ c: 'foo', p: 3, t: this.t }])
      })

      it('with a delete overlapping the comment content before', function () {
        const dest = []
        text._tc(dest, { c: 'foobar', p: 6, t: this.t }, { d: '123foo', p: 3 })
        return dest.should.deep.equal([{ c: 'bar', p: 3, t: this.t }])
      })

      it('with a delete overlapping the comment content after', function () {
        const dest = []
        text._tc(dest, { c: 'foobar', p: 6, t: this.t }, { d: 'bar123', p: 9 })
        return dest.should.deep.equal([{ c: 'foo', p: 6, t: this.t }])
      })

      it('with a delete overlapping the comment content in the middle', function () {
        const dest = []
        text._tc(dest, { c: 'foo123bar', p: 6, t: this.t }, { d: '123', p: 9 })
        return dest.should.deep.equal([{ c: 'foobar', p: 6, t: this.t }])
      })

      return it('with a delete overlapping the whole comment', function () {
        const dest = []
        text._tc(dest, { c: 'foo', p: 6, t: this.t }, { d: '123foo456', p: 3 })
        return dest.should.deep.equal([{ c: '', p: 3, t: this.t }])
      })
    })

    describe('comment / insert', function () {
      return it('should not do anything', function () {
        const dest = []
        text._tc(dest, { i: 'foo', p: 6 }, { c: 'bar', p: 3 })
        return dest.should.deep.equal([{ i: 'foo', p: 6 }])
      })
    })

    describe('comment / delete', function () {
      return it('should not do anything', function () {
        const dest = []
        text._tc(dest, { d: 'foo', p: 6 }, { c: 'bar', p: 3 })
        return dest.should.deep.equal([{ d: 'foo', p: 6 }])
      })
    })

    return describe('comment / comment', function () {
      return it('should not do anything', function () {
        const dest = []
        text._tc(dest, { c: 'foo', p: 6 }, { c: 'bar', p: 3 })
        return dest.should.deep.equal([{ c: 'foo', p: 6 }])
      })
    })
  })

  describe('apply', function () {
    it('should apply an insert', function () {
      return text.apply('foo', [{ i: 'bar', p: 2 }]).should.equal('fobaro')
    })

    it('should apply a delete', function () {
      return text
        .apply('foo123bar', [{ d: '123', p: 3 }])
        .should.equal('foobar')
    })

    it('should do nothing with a comment', function () {
      return text
        .apply('foo123bar', [{ c: '123', p: 3 }])
        .should.equal('foo123bar')
    })

    it('should throw an error when deleted content does not match', function () {
      return (() => text.apply('foo123bar', [{ d: '456', p: 3 }])).should.throw(
        Error
      )
    })

    return it('should throw an error when comment content does not match', function () {
      return (() => text.apply('foo123bar', [{ c: '456', p: 3 }])).should.throw(
        Error
      )
    })
  })

  return describe('applying ops and comments in different orders', function () {
    return it('should not matter which op or comment is applied first', function () {
      let length, p
      let asc, end
      let asc1, end1
      let asc3, end3
      const transform = function (op1, op2, side) {
        const d = []
        text._tc(d, op1, op2, side)
        return d
      }

      const applySnapshot = (snapshot, op) => text.apply(snapshot, op)

      const applyRanges = function (rangesTracker, ops) {
        for (const op of Array.from(ops)) {
          rangesTracker.applyOp(op, {})
        }
        return rangesTracker
      }

      const commentsEqual = function (comments1, comments2) {
        if (comments1.length !== comments2.length) {
          return false
        }
        comments1.sort((a, b) => {
          if (a.offset - b.offset === 0) {
            return a.length - b.length
          } else {
            return a.offset - b.offset
          }
        })
        comments2.sort((a, b) => {
          if (a.offset - b.offset === 0) {
            return a.length - b.length
          } else {
            return a.offset - b.offset
          }
        })
        for (let i = 0; i < comments1.length; i++) {
          const comment1 = comments1[i]
          const comment2 = comments2[i]
          if (
            comment1.offset !== comment2.offset ||
            comment1.length !== comment2.length
          ) {
            return false
          }
        }
        return true
      }

      const SNAPSHOT = '123'

      const OPS = []
      // Insert ops
      for (
        p = 0, end = SNAPSHOT.length, asc = end >= 0;
        asc ? p <= end : p >= end;
        asc ? p++ : p--
      ) {
        OPS.push({ i: 'a', p })
        OPS.push({ i: 'bc', p })
      }
      for (
        p = 0, end1 = SNAPSHOT.length - 1, asc1 = end1 >= 0;
        asc1 ? p <= end1 : p >= end1;
        asc1 ? p++ : p--
      ) {
        var asc2, end2
        for (
          length = 1, end2 = SNAPSHOT.length - p, asc2 = end2 >= 1;
          asc2 ? length <= end2 : length >= end2;
          asc2 ? length++ : length--
        ) {
          OPS.push({ d: SNAPSHOT.slice(p, p + length), p })
        }
      }
      for (
        p = 0, end3 = SNAPSHOT.length - 1, asc3 = end3 >= 0;
        asc3 ? p <= end3 : p >= end3;
        asc3 ? p++ : p--
      ) {
        var asc4, end4
        for (
          length = 1, end4 = SNAPSHOT.length - p, asc4 = end4 >= 1;
          asc4 ? length <= end4 : length >= end4;
          asc4 ? length++ : length--
        ) {
          OPS.push({ c: SNAPSHOT.slice(p, p + length), p, t: this.t })
        }
      }

      return (() => {
        const result = []
        for (var op1 of Array.from(OPS)) {
          result.push(
            (() => {
              const result1 = []
              for (const op2 of Array.from(OPS)) {
                const op1_t = transform(op1, op2, 'left')
                const op2_t = transform(op2, op1, 'right')

                const rt12 = new RangesTracker()
                const snapshot12 = applySnapshot(
                  applySnapshot(SNAPSHOT, [op1]),
                  op2_t
                )
                applyRanges(rt12, [op1])
                applyRanges(rt12, op2_t)

                const rt21 = new RangesTracker()
                const snapshot21 = applySnapshot(
                  applySnapshot(SNAPSHOT, [op2]),
                  op1_t
                )
                applyRanges(rt21, [op2])
                applyRanges(rt21, op1_t)

                if (snapshot12 !== snapshot21) {
                  console.error(
                    { op1, op2, op1_t, op2_t, snapshot12, snapshot21 },
                    'Ops are not consistent'
                  )
                  throw new Error('OT is inconsistent')
                }

                if (!commentsEqual(rt12.comments, rt21.comments)) {
                  console.log(rt12.comments)
                  console.log(rt21.comments)
                  console.error(
                    {
                      op1,
                      op2,
                      op1_t,
                      op2_t,
                      rt12_comments: rt12.comments,
                      rt21_comments: rt21.comments,
                    },
                    'Comments are not consistent'
                  )
                  throw new Error('OT is inconsistent')
                } else {
                  result1.push(undefined)
                }
              }
              return result1
            })()
          )
        }
        return result
      })()
    })
  })
})
