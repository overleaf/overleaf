import { describe, expect, it } from 'vitest'
import {
  annualSavings,
  getRoundedTwelfth,
} from '../../../../app/src/Features/Subscription/PriceVersions.mjs'

describe('PlansHelper', function () {
  describe('roundedTwelfth', function () {
    it('divides by twelve when the result is already a multiple of 0.05', function () {
      const roundedTwelfth = getRoundedTwelfth('feb2026')
      expect(roundedTwelfth(120)).to.equal(10)
      expect(roundedTwelfth(180)).to.equal(15)
    })

    it('rounds up to the nearest 0.05 for display', function () {
      const roundedTwelfth = getRoundedTwelfth('feb2026')
      // 263 / 12 = 21.9166… -> 21.95
      expect(roundedTwelfth(263)).to.equal(21.95)
      // 505 / 12 = 42.0833… -> 42.1
      expect(roundedTwelfth(505)).to.equal(42.1)
    })

    it('rounds up to the nearest 0.25 when given a 0.25 increment', function () {
      const roundedTwelfth = getRoundedTwelfth('aug2026')
      // 159 / 12 = 13.25 -> already a multiple of 0.25
      expect(roundedTwelfth(159)).to.equal(13.25)
      // 76 / 12 = 6.3333… -> 6.5
      expect(roundedTwelfth(76)).to.equal(6.5)
      // 319 / 12 = 26.5833… -> 26.75
      expect(roundedTwelfth(319)).to.equal(26.75)
    })
  })

  describe('annualSavings', function () {
    it('gives the saving against a year of monthly billing', function () {
      // 120/year against 20/month, which would be 240
      expect(annualSavings(20, 120)).to.equal(0.5)
      // 100/year against 10/month, which would be 120
      expect(annualSavings(10, 100)).to.be.closeTo(1 / 6, 1e-9)
    })

    it('ignores the rounding applied to the displayed per-month price', function () {
      let roundedTwelfth = getRoundedTwelfth('feb2026')
      // 100/year displays as 8.35 or 8.50 a month depending on the increment;
      // rounding up understates the saving, so neither stands in for it
      expect(annualSavings(10, 100)).to.be.greaterThan(
        1 - roundedTwelfth(100) / 10
      )

      roundedTwelfth = getRoundedTwelfth('aug2026')
      expect(annualSavings(10, 100)).to.be.greaterThan(
        1 - roundedTwelfth(100) / 10
      )
    })

    it('is not positive when annual billing saves nothing', function () {
      expect(annualSavings(10, 120)).to.equal(0)
      expect(annualSavings(10, 132)).to.be.lessThan(0)
    })
  })
})
