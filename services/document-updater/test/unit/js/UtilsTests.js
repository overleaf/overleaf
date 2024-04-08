// @ts-check

const { expect } = require('chai')
const Utils = require('../../../app/js/Utils')

describe('Utils', function () {
  describe('addTrackedDeletesToContent', function () {
    it("doesn't modify text without tracked deletes", function () {
      const content = 'the quick brown fox'
      const trackedChanges = []
      const result = Utils.addTrackedDeletesToContent(content, trackedChanges)
      expect(result).to.equal(content)
    })

    it('adds tracked deletes to text but skips tracked inserts', function () {
      const content = 'the brown fox jumps over the dog'
      const metadata = { user_id: 'user1', ts: new Date().toString() }
      const trackedChanges = [
        { id: 'tc1', op: { d: 'quick ', p: 4 }, metadata },
        { id: 'tc2', op: { i: 'brown ', p: 5 }, metadata },
        { id: 'tc3', op: { d: 'lazy ', p: 29 }, metadata },
      ]
      const result = Utils.addTrackedDeletesToContent(content, trackedChanges)
      expect(result).to.equal('the quick brown fox jumps over the lazy dog')
    })
  })
})
