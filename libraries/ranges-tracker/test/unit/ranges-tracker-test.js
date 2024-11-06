const { expect } = require('chai')
const RangesTracker = require('../..')

describe('RangesTracker', function () {
  describe('with duplicate change ids', function () {
    beforeEach(function () {
      this.comments = []
      this.changes = [
        { id: 'id1', op: { p: 1, i: 'hello' } },
        { id: 'id2', op: { p: 10, i: 'world' } },
        { id: 'id3', op: { p: 20, i: '!!!' } },
        { id: 'id1', op: { p: 30, d: 'duplicate' } },
      ]
      this.rangesTracker = new RangesTracker(this.changes, this.comments)
    })

    it('getChanges() returns all changes with the given ids', function () {
      expect(this.rangesTracker.getChanges(['id1', 'id2'])).to.deep.equal([
        this.changes[0],
        this.changes[1],
        this.changes[3],
      ])
    })

    it('removeChangeIds() removes all changes with the given ids', function () {
      this.rangesTracker.removeChangeIds(['id1', 'id2'])
      expect(this.rangesTracker.changes).to.deep.equal([this.changes[2]])
    })
  })

  describe('with multiple tracked deletes at the same position', function () {
    beforeEach(function () {
      this.comments = []
      this.changes = [
        { id: 'id1', op: { p: 33, d: 'before' } },
        { id: 'id2', op: { p: 50, d: 'right before' } },
        { id: 'id3', op: { p: 50, d: 'this one' } },
        { id: 'id4', op: { p: 50, d: 'right after' } },
        { id: 'id5', op: { p: 75, d: 'long after' } },
      ]
      this.rangesTracker = new RangesTracker(this.changes, this.comments)
    })

    it('preserves the text order when rejecting changes', function () {
      this.rangesTracker.applyOp(
        { p: 50, i: 'this one', u: true },
        { user_id: 'user-id' }
      )
      expect(this.rangesTracker.changes).to.deep.equal([
        { id: 'id1', op: { p: 33, d: 'before' } },
        { id: 'id2', op: { p: 50, d: 'right before' } },
        { id: 'id4', op: { p: 58, d: 'right after' } },
        { id: 'id5', op: { p: 83, d: 'long after' } },
      ])
    })

    it('moves all tracked deletes after the insert if not rejecting changes', function () {
      this.rangesTracker.applyOp(
        { p: 50, i: 'some other text', u: true },
        { user_id: 'user-id' }
      )
      expect(this.rangesTracker.changes).to.deep.equal([
        { id: 'id1', op: { p: 33, d: 'before' } },
        { id: 'id2', op: { p: 65, d: 'right before' } },
        { id: 'id3', op: { p: 65, d: 'this one' } },
        { id: 'id4', op: { p: 65, d: 'right after' } },
        { id: 'id5', op: { p: 90, d: 'long after' } },
      ])
    })
  })
})
