import { describe, expect, it } from 'vitest'
import { roundedTwelfth } from '../../../../app/src/Features/Subscription/PlansHelper.mjs'

describe('PlansHelper', function () {
  describe('roundedTwelfth', function () {
    it('divides by twelve when the result is already a multiple of 0.05', function () {
      expect(roundedTwelfth(120)).to.equal(10)
      expect(roundedTwelfth(180)).to.equal(15)
    })

    it('rounds up to the nearest 0.05 for display', function () {
      // 263 / 12 = 21.9166… -> 21.95
      expect(roundedTwelfth(263)).to.equal(21.95)
      // 505 / 12 = 42.0833… -> 42.1
      expect(roundedTwelfth(505)).to.equal(42.1)
    })
  })
})
