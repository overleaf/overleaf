import { expect } from 'chai'

import { getHueForUserId } from '@/shared/utils/colors'

describe('colors', function () {
  const currentUserId = '5bf7dab7a18b0b7a1cf6738c'

  beforeEach(function () {
    window.metaAttributesCache.set('ol-user_id', currentUserId)
  })

  describe('getHueForUserId', function () {
    it('returns the OWN_HUE for the current user', function () {
      expect(getHueForUserId(currentUserId)).to.equal(200)
    })

    it('returns the ANONYMOUS_HUE for an anonymous user', function () {
      expect(getHueForUserId()).to.equal(100)
      expect(getHueForUserId('anonymous-user')).to.equal(100)
    })

    it('generates a hue based on user id', function () {
      expect(
        getHueForUserId('59ad79f46337430b3d37cb9e', currentUserId)
      ).to.equal(146)
    })

    it('shifts the hue away from the OWN_HUE if it is within a threshold', function () {
      // Ordinarily, this user id would generate a hue of 183. However, this is
      // visually "too close" to the OWN_HUE, meaning that it could be
      // misinterpreted. Therefore we shift it away
      expect(getHueForUserId('20ad79f46337430b3d37cb9f')).to.equal(323)
    })
  })
})
