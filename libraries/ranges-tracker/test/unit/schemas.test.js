const { expect } = require('chai')
const { ranges } = require('../../schemas')

const metadata = Object.freeze({
  user_id: '65a4f2c3b1e4d5a6f7089123',
  ts: '2026-08-14T10:47:58.000Z',
})
const threadId = '65a4f2c3b1e4d5a6f7089124'
// an 18 character RangesTracker id seed plus its 6 character increment
const changeId = '65a4f2c3b1e4d5a6f7' + '000001'

describe('schemas', function () {
  describe('ranges', function () {
    it('accepts a legacy fixedRemoveChange flag on an insert op', function () {
      const result = ranges.safeParse({
        changes: [
          { op: { i: 'foo', p: 0, fixedRemoveChange: true }, metadata },
        ],
      })
      expect(result.success).to.equal(true)
    })

    it('accepts a legacy fixedRemoveChange flag on a delete op', function () {
      const result = ranges.safeParse({
        changes: [
          { op: { d: 'foo', p: 0, fixedRemoveChange: true }, metadata },
        ],
      })
      expect(result.success).to.equal(true)
    })

    it('accepts a legacy orderedRejections flag on an insert op', function () {
      const result = ranges.safeParse({
        changes: [
          { op: { i: 'foo', p: 0, orderedRejections: true }, metadata },
        ],
      })
      expect(result.success).to.equal(true)
    })

    it('accepts a legacy orderedRejections flag on a delete op', function () {
      const result = ranges.safeParse({
        changes: [
          { op: { d: 'foo', p: 0, orderedRejections: true }, metadata },
        ],
      })
      expect(result.success).to.equal(true)
    })

    it('rejects an unrecognized key on an insert op', function () {
      const result = ranges.safeParse({
        changes: [{ op: { i: 'foo', p: 0, somethingElse: true }, metadata }],
      })
      expect(result.success).to.equal(false)
    })

    it('rejects a tracked change without metadata', function () {
      const result = ranges.safeParse({
        changes: [{ op: { i: 'foo', p: 0 } }],
      })
      expect(result.success).to.equal(false)
    })

    it('rejects a tracked change without a user_id', function () {
      const result = ranges.safeParse({
        changes: [{ op: { i: 'foo', p: 0 }, metadata: { ts: metadata.ts } }],
      })
      expect(result.success).to.equal(false)
    })

    it('accepts a tracked change with a RangesTracker id', function () {
      const result = ranges.safeParse({
        changes: [{ id: changeId, op: { i: 'foo', p: 0 }, metadata }],
      })
      expect(result.success).to.equal(true)
    })

    // eslint-disable-next-line mocha/no-pending-tests
    it.skip('rejects a tracked change with a non-ObjectId id', function () {
      const result = ranges.safeParse({
        changes: [{ id: 'tc_1000001', op: { i: 'foo', p: 0 }, metadata }],
      })
      expect(result.success).to.equal(false)
    })

    it('rejects a tracked change without a ts', function () {
      const result = ranges.safeParse({
        changes: [
          { op: { i: 'foo', p: 0 }, metadata: { user_id: metadata.user_id } },
        ],
      })
      expect(result.success).to.equal(false)
    })

    it('accepts a comment op with an ObjectId thread id', function () {
      const result = ranges.safeParse({
        comments: [{ op: { c: 'foo', p: 0, t: threadId } }],
      })
      expect(result.success).to.equal(true)
    })

    it('rejects a comment op with a non-ObjectId thread id', function () {
      const result = ranges.safeParse({
        comments: [{ op: { c: 'foo', p: 0, t: 'thread-id-1' } }],
      })
      expect(result.success).to.equal(false)
    })

    it('rejects a comment op without a thread id', function () {
      const result = ranges.safeParse({
        comments: [{ op: { c: 'foo', p: 0 } }],
      })
      expect(result.success).to.equal(false)
    })

    it('accepts a comment with an ObjectId id', function () {
      const result = ranges.safeParse({
        comments: [{ id: threadId, op: { c: 'foo', p: 0, t: threadId } }],
      })
      expect(result.success).to.equal(true)
    })

    // eslint-disable-next-line mocha/no-pending-tests
    it.skip('rejects a comment with a non-ObjectId id', function () {
      const result = ranges.safeParse({
        comments: [{ id: 'thread-id-1', op: { c: 'foo', p: 0, t: threadId } }],
      })
      expect(result.success).to.equal(false)
    })
  })
})
