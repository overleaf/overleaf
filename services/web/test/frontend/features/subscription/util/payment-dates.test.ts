import { expect } from 'chai'
import {
  formatPaymentDate,
  formatPaymentDateTime,
} from '../../../../../frontend/js/features/subscription/util/payment-dates'

describe('payment-dates', function () {
  describe('formatPaymentDate', function () {
    it('formats a date in UTC', function () {
      expect(formatPaymentDate('2025-02-20T12:00:00.000Z')).to.equal(
        'February 20th, 2025'
      )
    })
    it('returns null for missing dates', function () {
      expect(formatPaymentDate(null)).to.be.null
      expect(formatPaymentDate(undefined)).to.be.null
    })
  })

  describe('formatPaymentDateTime', function () {
    it('formats a date and time in UTC', function () {
      expect(formatPaymentDateTime('2025-02-20T12:00:00.000Z')).to.equal(
        'February 20th, 2025 12:00 PM UTC'
      )
    })
    it('returns null for missing dates', function () {
      expect(formatPaymentDateTime(null)).to.be.null
      expect(formatPaymentDateTime(undefined)).to.be.null
    })
  })
})
