import { vi, expect } from 'vitest'
import path from 'node:path'

const modulePath = path.join(
  import.meta.dirname,
  '../../../../app/src/Features/Helpers/UrlHelper.mjs'
)

describe('UrlHelper', function () {
  beforeEach(async function (ctx) {
    ctx.settings = {
      apis: { linkedUrlProxy: { url: undefined } },
      siteUrl: 'http://127.0.0.1:3000',
    }

    vi.doMock('@overleaf/settings', () => ({
      default: ctx.settings,
    }))

    ctx.UrlHelper = (await import(modulePath)).default
  })
  describe('getSafeRedirectPath', function () {
    it('sanitize redirect path to prevent open redirects', function (ctx) {
      expect(ctx.UrlHelper.getSafeRedirectPath('https://evil.com')).to.be
        .undefined

      expect(ctx.UrlHelper.getSafeRedirectPath('//evil.com')).to.be.undefined

      expect(ctx.UrlHelper.getSafeRedirectPath('//ol.com/evil')).to.equal(
        '/evil'
      )

      expect(ctx.UrlHelper.getSafeRedirectPath('////evil.com')).to.be.undefined

      expect(ctx.UrlHelper.getSafeRedirectPath('%2F%2Fevil.com')).to.equal(
        '/%2F%2Fevil.com'
      )

      expect(
        ctx.UrlHelper.getSafeRedirectPath('http://foo.com//evil.com/bad')
      ).to.equal('/evil.com/bad')

      return expect(ctx.UrlHelper.getSafeRedirectPath('.evil.com')).to.equal(
        '/.evil.com'
      )
    })
  })
})
