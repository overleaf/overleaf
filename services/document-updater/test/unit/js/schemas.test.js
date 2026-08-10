const { expect } = require('chai')
const { insertOp, deleteOp } = require('../../../app/js/schemas')

describe('schemas', function () {
  describe('insertOp', function () {
    it('accepts a legacy fixedRemoveChange flag', function () {
      const result = insertOp.safeParse({
        i: 'foo',
        p: 0,
        fixedRemoveChange: true,
      })
      expect(result.success).to.equal(true)
    })

    it('rejects an unrecognized key', function () {
      const result = insertOp.safeParse({ i: 'foo', p: 0, somethingElse: true })
      expect(result.success).to.equal(false)
    })
  })

  describe('deleteOp', function () {
    it('accepts a legacy fixedRemoveChange flag', function () {
      const result = deleteOp.safeParse({
        d: 'foo',
        p: 0,
        fixedRemoveChange: true,
      })
      expect(result.success).to.equal(true)
    })

    it('rejects an unrecognized key', function () {
      const result = deleteOp.safeParse({ d: 'foo', p: 0, somethingElse: true })
      expect(result.success).to.equal(false)
    })
  })
})
