import { afterEach, beforeEach, describe, it, vi } from 'vitest'
import sinon from 'sinon'
import { setReqValidationModeForTests } from '@overleaf/validation-tools'
import MockRequest from '../helpers/MockRequest.mjs'
import MockResponse from '../helpers/MockResponse.mjs'

const MODULE_PATH = new URL(
  '../../../../app/src/Features/Analytics/AnalyticsRegistrationSourceMiddleware',
  import.meta.url
).pathname

describe('AnalyticsRegistrationSourceMiddleware', function () {
  beforeEach(async function (ctx) {
    ctx.req = new MockRequest(vi)
    ctx.req.header = name => ctx.req.headers[name]
    ctx.res = new MockResponse(vi)
    ctx.next = sinon.stub()

    ctx.AnalyticsRegistrationSourceHelper = {
      clearSource: sinon.stub(),
      setInbound: sinon.stub(),
    }
    vi.doMock(
      '../../../../app/src/Features/Analytics/AnalyticsRegistrationSourceHelper.mjs',
      () => ({ default: ctx.AnalyticsRegistrationSourceHelper })
    )

    ctx.SessionManager = {
      isUserLoggedIn: sinon.stub().returns(false),
    }
    vi.doMock(
      '../../../../app/src/Features/Authentication/SessionManager.mjs',
      () => ({ default: ctx.SessionManager })
    )

    ctx.AnalyticsRegistrationSourceMiddleware = (
      await import(MODULE_PATH)
    ).default
  })

  afterEach(function () {
    setReqValidationModeForTests(null)
  })

  describe('setInbound', function () {
    beforeEach(function (ctx) {
      ctx.req.url = '/project'
      ctx.req.session = {}
      ctx.middleware = ctx.AnalyticsRegistrationSourceMiddleware.setInbound()
    })

    describe('when the session already has an inbound referrer', function () {
      beforeEach(function (ctx) {
        ctx.req.session.inbound = { referrer: { medium: 'direct' } }
        ctx.middleware(ctx.req, ctx.res, ctx.next)
      })

      it('does not overwrite it', function (ctx) {
        sinon.assert.notCalled(ctx.AnalyticsRegistrationSourceHelper.setInbound)
      })

      it('calls next', function (ctx) {
        sinon.assert.calledOnce(ctx.next)
      })
    })

    describe('when the user is already logged in', function () {
      beforeEach(function (ctx) {
        ctx.SessionManager.isUserLoggedIn.returns(true)
        ctx.req.query = { utm_campaign: 'spring-sale' }
        ctx.middleware(ctx.req, ctx.res, ctx.next)
      })

      it('does not record a referrer', function (ctx) {
        sinon.assert.notCalled(ctx.AnalyticsRegistrationSourceHelper.setInbound)
      })

      it('calls next', function (ctx) {
        sinon.assert.calledOnce(ctx.next)
      })
    })

    describe('with well-formed utm query params', function () {
      beforeEach(function (ctx) {
        ctx.req.query = {
          utm_campaign: 'spring-sale',
          utm_source: 'newsletter',
        }
        ctx.req.headers.referrer = 'https://example.com'
        ctx.middleware(ctx.req, ctx.res, ctx.next)
      })

      it('forwards the parsed utm query to the helper', function (ctx) {
        sinon.assert.calledWith(
          ctx.AnalyticsRegistrationSourceHelper.setInbound,
          ctx.req.session,
          ctx.req.url,
          { utm_campaign: 'spring-sale', utm_source: 'newsletter' },
          'https://example.com'
        )
      })

      it('calls next', function (ctx) {
        sinon.assert.calledOnce(ctx.next)
      })
    })

    describe('with a malformed utm query value', function () {
      beforeEach(function (ctx) {
        ctx.req.query = { utm_campaign: ['spring-sale', 'other'] }
      })

      describe('in the default log-only validation mode', function () {
        beforeEach(function (ctx) {
          setReqValidationModeForTests('log')
          ctx.middleware(ctx.req, ctx.res, ctx.next)
        })

        it('falls back to the raw, unvalidated query', function (ctx) {
          sinon.assert.calledWith(
            ctx.AnalyticsRegistrationSourceHelper.setInbound,
            ctx.req.session,
            ctx.req.url,
            ctx.req.query,
            undefined
          )
        })

        it('calls next', function (ctx) {
          sinon.assert.calledOnce(ctx.next)
        })
      })

      describe('with request validation enforced', function () {
        beforeEach(function (ctx) {
          setReqValidationModeForTests('enforce')
          ctx.middleware(ctx.req, ctx.res, ctx.next)
        })

        it('fails silently without recording a referrer', function (ctx) {
          sinon.assert.notCalled(
            ctx.AnalyticsRegistrationSourceHelper.setInbound
          )
        })

        it('still calls next', function (ctx) {
          sinon.assert.calledOnce(ctx.next)
        })
      })
    })
  })
})
