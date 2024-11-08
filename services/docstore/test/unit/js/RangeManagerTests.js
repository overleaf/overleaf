/* eslint-disable
    no-return-assign,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const SandboxedModule = require('sandboxed-module')
const sinon = require('sinon')
const { assert, expect } = require('chai')
const modulePath = require('node:path').join(
  __dirname,
  '../../../app/js/RangeManager'
)
const { ObjectId } = require('mongodb-legacy')

describe('RangeManager', function () {
  beforeEach(function () {
    return (this.RangeManager = SandboxedModule.require(modulePath, {
      requires: {
        './mongodb': {
          ObjectId,
        },
      },
    }))
  })

  describe('jsonRangesToMongo', function () {
    it('should convert ObjectIds and dates to proper objects', function () {
      const changeId = new ObjectId().toString()
      const commentId = new ObjectId().toString()
      const userId = new ObjectId().toString()
      const threadId = new ObjectId().toString()
      const ts = new Date().toJSON()
      return this.RangeManager.jsonRangesToMongo({
        changes: [
          {
            id: changeId,
            op: { i: 'foo', p: 3 },
            metadata: {
              user_id: userId,
              ts,
            },
          },
        ],
        comments: [
          {
            id: commentId,
            op: { c: 'foo', p: 3, t: threadId },
          },
        ],
      }).should.deep.equal({
        changes: [
          {
            id: new ObjectId(changeId),
            op: { i: 'foo', p: 3 },
            metadata: {
              user_id: new ObjectId(userId),
              ts: new Date(ts),
            },
          },
        ],
        comments: [
          {
            id: new ObjectId(commentId),
            op: { c: 'foo', p: 3, t: new ObjectId(threadId) },
          },
        ],
      })
    })

    it('should leave malformed ObjectIds as they are', function () {
      const changeId = 'foo'
      const commentId = 'bar'
      const userId = 'baz'
      return this.RangeManager.jsonRangesToMongo({
        changes: [
          {
            id: changeId,
            metadata: {
              user_id: userId,
            },
          },
        ],
        comments: [
          {
            id: commentId,
          },
        ],
      }).should.deep.equal({
        changes: [
          {
            id: changeId,
            metadata: {
              user_id: userId,
            },
          },
        ],
        comments: [
          {
            id: commentId,
          },
        ],
      })
    })

    return it('should be consistent when transformed through json -> mongo -> json', function () {
      const changeId = new ObjectId().toString()
      const commentId = new ObjectId().toString()
      const userId = new ObjectId().toString()
      const threadId = new ObjectId().toString()
      const ts = new Date().toJSON()
      const ranges1 = {
        changes: [
          {
            id: changeId,
            op: { i: 'foo', p: 3 },
            metadata: {
              user_id: userId,
              ts,
            },
          },
        ],
        comments: [
          {
            id: commentId,
            op: { c: 'foo', p: 3, t: threadId },
          },
        ],
      }
      const ranges1Copy = JSON.parse(JSON.stringify(ranges1)) // jsonRangesToMongo modifies in place
      const ranges2 = JSON.parse(
        JSON.stringify(this.RangeManager.jsonRangesToMongo(ranges1Copy))
      )
      return ranges1.should.deep.equal(ranges2)
    })
  })

  return describe('shouldUpdateRanges', function () {
    beforeEach(function () {
      this.ranges = {
        changes: [
          {
            id: new ObjectId(),
            op: { i: 'foo', p: 3 },
            metadata: {
              user_id: new ObjectId(),
              ts: new Date(),
            },
          },
        ],
        comments: [
          {
            id: new ObjectId(),
            op: { c: 'foo', p: 3, t: new ObjectId() },
          },
        ],
      }
      return (this.ranges_copy = this.RangeManager.jsonRangesToMongo(
        JSON.parse(JSON.stringify(this.ranges))
      ))
    })

    describe('with a blank new range', function () {
      return it('should throw an error', function () {
        return expect(() => {
          return this.RangeManager.shouldUpdateRanges(this.ranges, null)
        }).to.throw(Error)
      })
    })

    describe('with a blank old range', function () {
      return it('should treat it like {}', function () {
        this.RangeManager.shouldUpdateRanges(null, {}).should.equal(false)
        return this.RangeManager.shouldUpdateRanges(
          null,
          this.ranges
        ).should.equal(true)
      })
    })

    describe('with no changes', function () {
      return it('should return false', function () {
        return this.RangeManager.shouldUpdateRanges(
          this.ranges,
          this.ranges_copy
        ).should.equal(false)
      })
    })

    return describe('with changes', function () {
      it('should return true when the change id changes', function () {
        this.ranges_copy.changes[0].id = new ObjectId()
        return this.RangeManager.shouldUpdateRanges(
          this.ranges,
          this.ranges_copy
        ).should.equal(true)
      })

      it('should return true when the change user id changes', function () {
        this.ranges_copy.changes[0].metadata.user_id = new ObjectId()
        return this.RangeManager.shouldUpdateRanges(
          this.ranges,
          this.ranges_copy
        ).should.equal(true)
      })

      it('should return true when the change ts changes', function () {
        this.ranges_copy.changes[0].metadata.ts = new Date(Date.now() + 1000)
        return this.RangeManager.shouldUpdateRanges(
          this.ranges,
          this.ranges_copy
        ).should.equal(true)
      })

      it('should return true when the change op changes', function () {
        this.ranges_copy.changes[0].op.i = 'bar'
        return this.RangeManager.shouldUpdateRanges(
          this.ranges,
          this.ranges_copy
        ).should.equal(true)
      })

      it('should return true when the comment id changes', function () {
        this.ranges_copy.comments[0].id = new ObjectId()
        return this.RangeManager.shouldUpdateRanges(
          this.ranges,
          this.ranges_copy
        ).should.equal(true)
      })

      it('should return true when the comment offset changes', function () {
        this.ranges_copy.comments[0].op.p = 17
        return this.RangeManager.shouldUpdateRanges(
          this.ranges,
          this.ranges_copy
        ).should.equal(true)
      })

      return it('should return true when the comment content changes', function () {
        this.ranges_copy.comments[0].op.c = 'bar'
        return this.RangeManager.shouldUpdateRanges(
          this.ranges,
          this.ranges_copy
        ).should.equal(true)
      })
    })
  })
})
