import { expect } from 'chai'
import fetch from 'node-fetch'
import Settings from '@overleaf/settings'

const BASE_URL = `http://${process.env.HTTP_TEST_HOST || '127.0.0.1'}:23000`

describe('HttpPermissionsPolicy', function () {
  it('should have permissions-policy header on user-facing pages', async function () {
    const response = await fetch(BASE_URL)

    expect(response.headers.get('permissions-policy')).to.equal(
      'accelerometer=(), attribution-reporting=(), browsing-topics=(), camera=(), display-capture=(), encrypted-media=(), gamepad=(), geolocation=(), gyroscope=(), hid=(), identity-credentials-get=(), idle-detection=(), local-fonts=(), magnetometer=(), microphone=(), midi=(), otp-credentials=(), payment=(), picture-in-picture=(), screen-wake-lock=(), serial=(), storage-access=(), usb=(), window-management=(), xr-spatial-tracking=(), autoplay=(self "https://videos.ctfassets.net"), fullscreen=(self)'
    )
  })

  it('should not have permissions-policy header on requests for non-rendered content', async function () {
    const response = await fetch(`${BASE_URL}/dev/csrf`)

    expect(response.headers.get('permissions-policy')).to.be.null
  })

  describe('when permissions policy is disabled', function () {
    it('it adds no additional headers', async function () {
      Settings.useHttpPermissionsPolicy = false
      const response = await fetch(BASE_URL)
      expect(response.headers.get('permissions-policy')).to.be.null
    })
  })
})
