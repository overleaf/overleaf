import { assert, vi } from 'vitest'
import sinon from 'sinon'
import MockRequest from '../helpers/MockRequest.mjs'
import MockResponse from '../helpers/MockResponse.mjs'

const MODULE_PATH = new URL(
  '../../../../app/src/Features/Analytics/AnalyticsUTMTrackingMiddleware',
  import.meta.url
).pathname

describe('AnalyticsUTMTrackingMiddleware', function () {
  beforeEach(async function (ctx) {
    ctx.analyticsId = 'ecdb935a-52f3-4f91-aebc-7a70d2ffbb55'
    ctx.userId = '61795fcb013504bb7b663092'

    ctx.req = new MockRequest(vi)
    ctx.res = new MockResponse(vi)
    ctx.next = sinon.stub().returns()
    ctx.req.session = {
      user: {
        _id: ctx.userId,
        analyticsId: ctx.analyticsId,
      },
    }

    vi.doMock(
      '../../../../app/src/Features/Analytics/AnalyticsManager.mjs',
      () => ({
        default: (ctx.AnalyticsManager = {
          recordEventForSession: sinon.stub().resolves(),
          setUserPropertyForSessionInBackground: sinon.stub(),
        }),
      })
    )

    vi.doMock('@overleaf/settings', () => ({
      default: {
        siteUrl: 'https://www.overleaf.com',
      },
    }))

    ctx.AnalyticsUTMTrackingMiddleware = (await import(MODULE_PATH)).default

    ctx.middleware = ctx.AnalyticsUTMTrackingMiddleware.recordUTMTags()
  })

  describe('without UTM tags in query', function () {
    beforeEach(function (ctx) {
      ctx.req.url = '/project'
      ctx.middleware(ctx.req, ctx.res, ctx.next)
    })

    it('user is not redirected', function (ctx) {
      assert.isFalse(ctx.res.redirected)
    })

    it('next middleware is executed', function (ctx) {
      sinon.assert.calledOnce(ctx.next)
    })

    it('no event or user property is recorded', function (ctx) {
      sinon.assert.notCalled(ctx.AnalyticsManager.recordEventForSession)
      sinon.assert.notCalled(
        ctx.AnalyticsManager.setUserPropertyForSessionInBackground
      )
    })
  })

  describe('with all UTM tags in query', function () {
    beforeEach(function (ctx) {
      ctx.req.url =
        '/project?utm_source=Organic&utm_medium=Facebook&utm_campaign=Some%20Campaign&utm_content=foo-bar&utm_term=overridden'
      ctx.req.query = {
        utm_source: 'Organic',
        utm_medium: 'Facebook',
        utm_campaign: 'Some Campaign',
        utm_content: 'foo-bar',
        utm_term: 'overridden',
      }

      ctx.req.headers = {
        host: 'test-domain.overleaf.com',
      }
      ctx.middleware(ctx.req, ctx.res, ctx.next)
    })

    it('user is redirected', function (ctx) {
      assert.isTrue(ctx.res.redirected)
      assert.equal('/project', ctx.res.redirectedTo)
    })

    it('next middleware is not executed', function (ctx) {
      sinon.assert.notCalled(ctx.next)
    })

    it('page-view event is recorded for session', function (ctx) {
      sinon.assert.calledWith(
        ctx.AnalyticsManager.recordEventForSession,
        ctx.req.session,
        'page-view',
        {
          path: '/project',
          utm_source: 'Organic',
          utm_medium: 'Facebook',
          utm_campaign: 'Some Campaign',
          utm_content: 'foo-bar',
          utm_term: 'overridden',
          domain: 'test-domain',
        }
      )
    })

    it('utm-tags user property is set for session', function (ctx) {
      sinon.assert.calledWith(
        ctx.AnalyticsManager.setUserPropertyForSessionInBackground,
        ctx.req.session,
        'utm-tags',
        'Organic;Facebook;Some Campaign;foo-bar'
      )
    })
  })

  describe('with some UTM tags in query', function () {
    beforeEach(function (ctx) {
      ctx.req.url =
        '/project?utm_medium=Facebook&utm_campaign=Some%20Campaign&utm_term=foo'
      ctx.req.query = {
        utm_medium: 'Facebook',
        utm_campaign: 'Some Campaign',
        utm_term: 'foo',
      }
      ctx.req.headers = {
        host: 'test-domain.overleaf.com',
      }
      ctx.middleware(ctx.req, ctx.res, ctx.next)
    })

    it('user is redirected', function (ctx) {
      assert.isTrue(ctx.res.redirected)
      assert.equal('/project', ctx.res.redirectedTo)
    })

    it('next middleware is not executed', function (ctx) {
      sinon.assert.notCalled(ctx.next)
    })

    it('page-view event is recorded for session', function (ctx) {
      sinon.assert.calledWith(
        ctx.AnalyticsManager.recordEventForSession,
        ctx.req.session,
        'page-view',
        {
          path: '/project',
          utm_medium: 'Facebook',
          utm_campaign: 'Some Campaign',
          utm_term: 'foo',
          domain: 'test-domain',
        }
      )
    })

    it('utm-tags user property is set for session', function (ctx) {
      sinon.assert.calledWith(
        ctx.AnalyticsManager.setUserPropertyForSessionInBackground,
        ctx.req.session,
        'utm-tags',
        'N/A;Facebook;Some Campaign;foo'
      )
    })
  })

  describe('with some UTM tags and additional parameters in query', function () {
    beforeEach(function (ctx) {
      ctx.req.url =
        '/project?utm_medium=Facebook&utm_campaign=Some%20Campaign&other_param=some-value'
      ctx.req.query = {
        utm_medium: 'Facebook',
        utm_campaign: 'Some Campaign',
        other_param: 'some-value',
      }
      ctx.req.headers = {
        host: 'test-domain.overleaf.com',
      }
      ctx.middleware(ctx.req, ctx.res, ctx.next)
    })

    it('user is redirected', function (ctx) {
      assert.isTrue(ctx.res.redirected)
      assert.equal('/project?other_param=some-value', ctx.res.redirectedTo)
    })

    it('next middleware is not executed', function (ctx) {
      sinon.assert.notCalled(ctx.next)
    })

    it('page-view event is recorded for session', function (ctx) {
      sinon.assert.calledWith(
        ctx.AnalyticsManager.recordEventForSession,
        ctx.req.session,
        'page-view',
        {
          path: '/project',
          utm_medium: 'Facebook',
          utm_campaign: 'Some Campaign',
          domain: 'test-domain',
        }
      )
    })

    it('utm-tags user property is set for session', function (ctx) {
      sinon.assert.calledWith(
        ctx.AnalyticsManager.setUserPropertyForSessionInBackground,
        ctx.req.session,
        'utm-tags',
        'N/A;Facebook;Some Campaign;N/A'
      )
    })
  })
})
