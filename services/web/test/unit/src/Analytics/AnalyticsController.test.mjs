import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import sinon from 'sinon'
import { setReqValidationModeForTests } from '@overleaf/validation-tools'
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

  afterEach(function () {
    setReqValidationModeForTests(null)
  })

  describe('updateEditingSession', function () {
    beforeEach(function (ctx) {
      // projectId is validated as a Mongo ObjectId
      ctx.projectId = '507f191e810c19729de860ea'
      ctx.req = {
        params: {
          projectId: ctx.projectId,
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
            ctx.projectId,
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
      }
      ctx.req = {
        params: {
          event: 'i_did_something',
        },
        body,
        sessionID: 'sessionIDHere',
        session: {},
      }
    })

    it('should use the session', async function (ctx) {
      await new Promise(resolve => {
        ctx.controller.recordEvent(ctx.req, ctx.res)
        sinon.assert.calledWith(
          ctx.AnalyticsManager.recordEventForSession,
          ctx.req.session,
          ctx.req.params.event,
          ctx.req.body
        )
        resolve()
      })
    })

    it('should reject an event name containing characters outside [a-z0-9-_]', function (ctx) {
      setReqValidationModeForTests('enforce')
      ctx.req.params.event = 'I.did:something,here/now;too'
      expect(() => ctx.controller.recordEvent(ctx.req, ctx.res)).to.throw()
      sinon.assert.notCalled(ctx.AnalyticsManager.recordEventForSession)
    })

    it('should reject an event name containing a disallowed character', function (ctx) {
      setReqValidationModeForTests('enforce')
      ctx.req.params.event = 'bad event!'
      expect(() => ctx.controller.recordEvent(ctx.req, ctx.res)).to.throw()
      sinon.assert.notCalled(ctx.AnalyticsManager.recordEventForSession)
    })
  })
})
