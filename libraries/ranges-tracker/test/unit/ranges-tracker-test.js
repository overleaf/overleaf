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

  describe('with duplicate tracked insert ids', function () {
    beforeEach(function () {
      this.comments = []
      this.changes = [
        { id: 'id1', op: { p: 10, i: 'one' } },
        { id: 'id1', op: { p: 20, i: 'two' } },
        { id: 'id1', op: { p: 30, d: 'three' } },
      ]
      this.rangesTracker = new RangesTracker(this.changes, this.comments)
    })

    it("deleting one tracked insert doesn't delete the others", function () {
      this.rangesTracker.applyOp({ p: 20, d: 'two' })
      expect(this.rangesTracker.changes).to.deep.equal([
        this.changes[0],
        this.changes[2],
      ])
    })
  })

  describe('with duplicate tracked delete ids', function () {
    beforeEach(function () {
      this.comments = []
      this.changes = [
        { id: 'id1', op: { p: 10, d: 'one' } },
        { id: 'id1', op: { p: 20, d: 'two' } },
        { id: 'id1', op: { p: 30, d: 'three' } },
      ]
      this.rangesTracker = new RangesTracker(this.changes, this.comments)
    })

    it('deleting over tracked deletes in tracked changes mode removes the tracked deletes covered', function () {
      this.rangesTracker.track_changes = true
      this.rangesTracker.applyOp({
        p: 15,
        d: '567890123456789012345',
      })
      expect(this.rangesTracker.changes.map(c => c.op)).to.deep.equal([
        { p: 10, d: 'one' },
        { p: 15, d: '56789two0123456789three012345' },
      ])
    })

    it('a tracked delete between two tracked deletes joins them into a single tracked delete', function () {
      this.rangesTracker.track_changes = true
      this.rangesTracker.applyOp({
        p: 20,
        d: '0123456789',
      })
      expect(this.rangesTracker.changes.map(c => c.op)).to.deep.equal([
        { p: 10, d: 'one' },
        { p: 20, d: 'two0123456789three' },
      ])
    })

    it("rejecting one tracked delete doesn't reject the others", function () {
      this.rangesTracker.track_changes = true
      this.rangesTracker.applyOp({
        p: 20,
        i: 'two',
        u: true,
      })
      expect(this.rangesTracker.changes.map(c => c.op)).to.deep.equal([
        { p: 10, d: 'one' },
        { p: 33, d: 'three' },
      ])
    })

    it("rejecting all tracked deletes doesn't introduce tracked inserts", function () {
      this.rangesTracker.track_changes = true
      this.rangesTracker.applyOp({
        p: 10,
        i: 'one',
        u: true,
      })
      this.rangesTracker.applyOp({
        p: 23,
        i: 'two',
        u: true,
      })
      this.rangesTracker.applyOp({
        p: 36,
        i: 'three',
        u: true,
      })
      expect(this.rangesTracker.changes.map(c => c.op)).to.deep.equal([])
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
        { p: 50, i: 'some other text', u: true, orderedRejections: true },
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

  describe('with multiple tracked deletes at the same position with the same content', function () {
    beforeEach(function () {
      this.comments = []
      this.changes = [
        { id: 'id1', op: { p: 10, d: 'cat' } },
        { id: 'id2', op: { p: 10, d: 'giraffe' } },
        { id: 'id3', op: { p: 10, d: 'cat' } },
        { id: 'id4', op: { p: 10, d: 'giraffe' } },
      ]
      this.rangesTracker = new RangesTracker(this.changes, this.comments)
    })

    it('removes only the first matching tracked delete', function () {
      this.rangesTracker.applyOp(
        { p: 10, i: 'giraffe', u: true },
        { user_id: 'user-id' }
      )
      expect(this.rangesTracker.changes).to.deep.equal([
        { id: 'id1', op: { p: 10, d: 'cat' } },
        { id: 'id3', op: { p: 17, d: 'cat' } },
        { id: 'id4', op: { p: 17, d: 'giraffe' } },
      ])
    })
  })

  describe('with a tracked insert at the same position as a tracked delete', function () {
    beforeEach(function () {
      this.comments = []
      this.changes = [
        {
          id: 'id1',
          op: { p: 5, d: 'before' },
          metadata: { user_id: 'user-id' },
        },
        {
          id: 'id2',
          op: { p: 10, d: 'delete' },
          metadata: { user_id: 'user-id' },
        },
        {
          id: 'id3',
          op: { p: 10, i: 'insert' },
          metadata: { user_id: 'user-id' },
        },
      ]
      this.rangesTracker = new RangesTracker(this.changes, this.comments)
    })

    it('places a tracked insert at the same position before both the delete and the insert', function () {
      this.rangesTracker.track_changes = true
      this.rangesTracker.applyOp(
        { p: 10, i: 'incoming' },
        { user_id: 'user-id' }
      )
      expect(this.rangesTracker.changes.map(change => change.op)).to.deep.equal(
        [
          { p: 5, d: 'before' },
          { p: 10, i: 'incoming' },
          { p: 18, d: 'delete' },
          { p: 18, i: 'insert' },
        ]
      )
    })
  })
})
