import { describe, it, expect } from 'vitest'
import { ranges } from '../../../app/js/schemas.js'

describe('schemas', function () {
  describe('ranges', function () {
    it('accepts a legacy fixedRemoveChange flag on an insert op', function () {
      const result = ranges.safeParse({
        changes: [{ op: { i: 'foo', p: 0, fixedRemoveChange: true } }],
      })
      expect(result.success).to.equal(true)
    })

    it('accepts a legacy fixedRemoveChange flag on a delete op', function () {
      const result = ranges.safeParse({
        changes: [{ op: { d: 'foo', p: 0, fixedRemoveChange: true } }],
      })
      expect(result.success).to.equal(true)
    })

    it('rejects an unrecognized key on an insert op', function () {
      const result = ranges.safeParse({
        changes: [{ op: { i: 'foo', p: 0, somethingElse: true } }],
      })
      expect(result.success).to.equal(false)
    })
  })
})
