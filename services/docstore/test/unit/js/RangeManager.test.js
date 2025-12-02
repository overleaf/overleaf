import path from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ObjectId } from 'mongodb-legacy'

const modulePath = path.join(
  import.meta.dirname,
  '../../../app/js/RangeManager'
)

describe('RangeManager', () => {
  beforeEach(async ctx => {
    vi.doMock('../../../app/js/mongodb', () => ({
      default: {
        ObjectId,
      },
    }))

    ctx.RangeManager = (await import(modulePath)).default
  })

  describe('jsonRangesToMongo', () => {
    it('should convert ObjectIds and dates to proper objects and fix comment id', ctx => {
      const changeId = new ObjectId().toString()
      const commentId = new ObjectId().toString()
      const userId = new ObjectId().toString()
      const threadId = new ObjectId().toString()
      const ts = new Date().toJSON()
      ctx.RangeManager.jsonRangesToMongo({
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
            id: new ObjectId(threadId),
            op: { c: 'foo', p: 3, t: new ObjectId(threadId) },
          },
        ],
      })
    })

    it('should leave malformed ObjectIds as they are', ctx => {
      const changeId = 'foo'
      const commentId = 'bar'
      const userId = 'baz'
      ctx.RangeManager.jsonRangesToMongo({
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

    it('should be consistent when transformed through json -> mongo -> json', ctx => {
      const changeId = new ObjectId().toString()
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
            id: threadId,
            op: { c: 'foo', p: 3, t: threadId },
          },
        ],
      }
      const ranges1Copy = JSON.parse(JSON.stringify(ranges1)) // jsonRangesToMongo modifies in place
      const ranges2 = JSON.parse(
        JSON.stringify(ctx.RangeManager.jsonRangesToMongo(ranges1Copy))
      )
      ranges1.should.deep.equal(ranges2)
    })
  })

  return describe('shouldUpdateRanges', () => {
    beforeEach(ctx => {
      const threadId = new ObjectId()
      ctx.ranges = {
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
            id: threadId,
            op: { c: 'foo', p: 3, t: threadId },
          },
        ],
      }
      ctx.ranges_copy = ctx.RangeManager.jsonRangesToMongo(
        JSON.parse(JSON.stringify(ctx.ranges))
      )
    })

    describe('with a blank new range', () => {
      it('should throw an error', ctx => {
        expect(() => {
          ctx.RangeManager.shouldUpdateRanges(ctx.ranges, null)
        }).to.throw(Error)
      })
    })

    describe('with a blank old range', () => {
      it('should treat it like {}', ctx => {
        ctx.RangeManager.shouldUpdateRanges(null, {}).should.equal(false)
        ctx.RangeManager.shouldUpdateRanges(null, ctx.ranges).should.equal(true)
      })
    })

    describe('with no changes', () => {
      it('should return false', ctx => {
        ctx.RangeManager.shouldUpdateRanges(
          ctx.ranges,
          ctx.ranges_copy
        ).should.equal(false)
      })
    })

    describe('with changes', () => {
      it('should return true when the change id changes', ctx => {
        ctx.ranges_copy.changes[0].id = new ObjectId()
        ctx.RangeManager.shouldUpdateRanges(
          ctx.ranges,
          ctx.ranges_copy
        ).should.equal(true)
      })

      it('should return true when the change user id changes', ctx => {
        ctx.ranges_copy.changes[0].metadata.user_id = new ObjectId()
        ctx.RangeManager.shouldUpdateRanges(
          ctx.ranges,
          ctx.ranges_copy
        ).should.equal(true)
      })

      it('should return true when the change ts changes', ctx => {
        ctx.ranges_copy.changes[0].metadata.ts = new Date(Date.now() + 1000)
        ctx.RangeManager.shouldUpdateRanges(
          ctx.ranges,
          ctx.ranges_copy
        ).should.equal(true)
      })

      it('should return true when the change op changes', ctx => {
        ctx.ranges_copy.changes[0].op.i = 'bar'
        ctx.RangeManager.shouldUpdateRanges(
          ctx.ranges,
          ctx.ranges_copy
        ).should.equal(true)
      })

      it('should return true when the comment id changes', ctx => {
        ctx.ranges_copy.comments[0].id = new ObjectId()
        ctx.RangeManager.shouldUpdateRanges(
          ctx.ranges,
          ctx.ranges_copy
        ).should.equal(true)
      })

      it('should return true when the comment offset changes', ctx => {
        ctx.ranges_copy.comments[0].op.p = 17
        ctx.RangeManager.shouldUpdateRanges(
          ctx.ranges,
          ctx.ranges_copy
        ).should.equal(true)
      })

      it('should return true when the comment content changes', ctx => {
        ctx.ranges_copy.comments[0].op.c = 'bar'
        ctx.RangeManager.shouldUpdateRanges(
          ctx.ranges,
          ctx.ranges_copy
        ).should.equal(true)
      })
    })
  })
})
