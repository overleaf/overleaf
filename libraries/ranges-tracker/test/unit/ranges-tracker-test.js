const { expect } = require('chai')
const RangesTracker = require('../..')

describe('RangesTracker', function () {
  describe('with duplicate change ids', function () {
    beforeEach(function () {
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
})
