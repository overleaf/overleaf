import { beforeEach, describe, expect, it, vi } from 'vitest'
import sinon from 'sinon'

const MODULE_PATH = '../../../../app/src/Features/Captcha/CaptchaMiddleware.mjs'

describe('CaptchaMiddleware', function () {
  beforeEach(async function (ctx) {
    // No siteKey configured -> validateCaptcha takes its "disabled" branch
    // and calls next() right after stripRecaptchaField, without needing to
    // stub the recaptcha siteverify network call or DeviceHistory.
    ctx.Settings = {
      recaptcha: {
        siteKey: undefined,
        disabled: {},
        trustedUsers: [],
      },
      deviceHistory: {
        cookieName: 'deviceHistory',
        entryExpiry: 90 * 24 * 60 * 60 * 1000,
        maxEntries: 10,
        secret: undefined,
      },
    }

    ctx.Metrics = {
      inc: sinon.stub(),
    }

    ctx.AuthenticationController = {
      setAuditInfo: sinon.stub(),
    }

    ctx.fetchJson = sinon
      .stub()
      .rejects(new Error('fetchJson should not be called in this test'))

    vi.doMock('@overleaf/settings', () => ({ default: ctx.Settings }))

    vi.doMock('@overleaf/metrics', () => ({ default: ctx.Metrics }))

    vi.doMock('@overleaf/fetch-utils', () => ({ fetchJson: ctx.fetchJson }))

    vi.doMock(
      '../../../../app/src/Features/Authentication/AuthenticationController',
      () => ({ default: ctx.AuthenticationController })
    )

    ctx.CaptchaMiddleware = (await import(MODULE_PATH)).default

    ctx.res = {
      status: sinon.stub().returnsThis(),
      json: sinon.stub(),
    }
    ctx.next = sinon.stub()
  })

  describe('stripRecaptchaField (via validateCaptcha)', function () {
    async function runValidateCaptcha(ctx, body) {
      ctx.req = { body }
      await ctx.CaptchaMiddleware.validateCaptcha('login')(
        ctx.req,
        ctx.res,
        ctx.next
      )
    }

    it('strips a captcha-token string', async function (ctx) {
      await runValidateCaptcha(ctx, {
        email: 'user@example.com',
        'g-recaptcha-response': 'some-captcha-token',
      })
      expect(ctx.next).to.have.been.calledWithExactly()
      expect(ctx.req.body).to.not.have.property('g-recaptcha-response')
      expect(ctx.req.body).to.deep.equal({ email: 'user@example.com' })
    })

    it('strips an explicit null', async function (ctx) {
      await runValidateCaptcha(ctx, {
        email: 'user@example.com',
        'g-recaptcha-response': null,
      })
      expect(ctx.next).to.have.been.calledWithExactly()
      expect(ctx.req.body).to.not.have.property('g-recaptcha-response')
      expect(ctx.req.body).to.deep.equal({ email: 'user@example.com' })
    })

    it('strips an empty string', async function (ctx) {
      await runValidateCaptcha(ctx, {
        email: 'user@example.com',
        'g-recaptcha-response': '',
      })
      expect(ctx.next).to.have.been.calledWithExactly()
      expect(ctx.req.body).to.not.have.property('g-recaptcha-response')
      expect(ctx.req.body).to.deep.equal({ email: 'user@example.com' })
    })

    it('leaves a body without the field unchanged', async function (ctx) {
      const body = { email: 'user@example.com', otherField: 'value' }
      await runValidateCaptcha(ctx, body)
      expect(ctx.next).to.have.been.calledWithExactly()
      // stripRecaptchaField only reassigns req.body when the key is
      // present, so the original object reference is preserved here.
      expect(ctx.req.body).to.equal(body)
      expect(ctx.req.body).to.deep.equal({
        email: 'user@example.com',
        otherField: 'value',
      })
    })
  })
})
