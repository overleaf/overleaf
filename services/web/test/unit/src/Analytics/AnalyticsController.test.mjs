import { vi } from 'vitest'
import sinon from 'sinon'
import MockResponse from '../helpers/MockResponse.mjs'
const modulePath = new URL(
  '../../../../app/src/Features/Analytics/AnalyticsController.mjs',
  import.meta.url
).pathname

describe('AnalyticsController', function () {
  beforeEach(async function (ctx) {
    ctx.SessionManager = { getLoggedInUserId: sinon.stub() }

    ctx.AnalyticsManager = {
      updateEditingSession: sinon.stub(),
      recordEventForSession: sinon.stub(),
    }

    ctx.Features = {
      hasFeature: sinon.stub().returns(true),
    }

    vi.doMock(
      '../../../../app/src/Features/Analytics/AnalyticsManager.mjs',
      () => ({
        default: ctx.AnalyticsManager,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Authentication/SessionManager.mjs',
      () => ({
        default: ctx.SessionManager,
      })
    )

    vi.doMock('../../../../app/src/infrastructure/Features.mjs', () => ({
      default: ctx.Features,
    }))

    vi.doMock('../../../../app/src/infrastructure/GeoIpLookup.mjs', () => ({
      default: (ctx.GeoIpLookup = {
        promises: {
          getDetails: sinon.stub().resolves(),
        },
      }),
    }))

    ctx.controller = (await import(modulePath)).default

    ctx.res = new MockResponse(vi)
  })

  describe('updateEditingSession', function () {
    beforeEach(function (ctx) {
      ctx.req = {
        params: {
          projectId: 'a project id',
        },
        session: {},
        body: {
          segmentation: {
            editorType: 'abc',
          },
        },
      }
      ctx.GeoIpLookup.promises.getDetails = sinon
        .stub()
        .resolves({ country_code: 'XY' })
    })

    it('delegates to the AnalyticsManager', async function (ctx) {
      await new Promise(resolve => {
        ctx.SessionManager.getLoggedInUserId.returns('1234')
        ctx.res.callback = () => {
          sinon.assert.calledWith(
            ctx.AnalyticsManager.updateEditingSession,
            '1234',
            'a project id',
            'XY',
            { editorType: 'abc' }
          )
          resolve()
        }
        ctx.controller.updateEditingSession(ctx.req, ctx.res)
      })
    })
  })

  describe('recordEvent', function () {
    beforeEach(function (ctx) {
      const body = {
        foo: 'stuff',
        _csrf: 'atoken123',
      }
      ctx.req = {
        params: {
          event: 'i_did_something',
        },
        body,
        sessionID: 'sessionIDHere',
        session: {},
      }

      ctx.expectedData = Object.assign({}, body)
      delete ctx.expectedData._csrf
    })

    it('should use the session', async function (ctx) {
      await new Promise(resolve => {
        ctx.controller.recordEvent(ctx.req, ctx.res)
        sinon.assert.calledWith(
          ctx.AnalyticsManager.recordEventForSession,
          ctx.req.session,
          ctx.req.params.event,
          ctx.expectedData
        )
        resolve()
      })
    })

    it('should remove the CSRF token before sending to the manager', async function (ctx) {
      await new Promise(resolve => {
        ctx.controller.recordEvent(ctx.req, ctx.res)
        sinon.assert.calledWith(
          ctx.AnalyticsManager.recordEventForSession,
          ctx.req.session,
          ctx.req.params.event,
          ctx.expectedData
        )
        resolve()
      })
    })
  })
})
