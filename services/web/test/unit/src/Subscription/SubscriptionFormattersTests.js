const chai = require('chai')
const SubscriptionFormatters = require('../../../../app/src/Features/Subscription/SubscriptionFormatters')

const { expect } = chai

describe('SubscriptionFormatters', function () {
  describe('formatDateTime', function () {
    it('should return null if no date', function () {
      const result = SubscriptionFormatters.formatDateTime(null)
      expect(result).to.equal(null)
    })

    it('should format date with time', function () {
      const date = new Date(1639904485000)
      const result = SubscriptionFormatters.formatDateTime(date)
      expect(result).to.equal('December 19th, 2021 9:01 AM UTC')
    })
  })

  describe('formatDate', function () {
    it('should return null if no date', function () {
      const result = SubscriptionFormatters.formatDate(null)
      expect(result).to.equal(null)
    })

    it('should format date', function () {
      const date = new Date(1639904485000)
      const result = SubscriptionFormatters.formatDate(date)
      expect(result).to.equal('December 19th, 2021')
    })
  })
})
