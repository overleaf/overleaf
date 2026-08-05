import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import sinon from 'sinon'
import {
  InvalidRequestError,
  setReqValidationModeForTests,
} from '@overleaf/validation-tools'
import MockRequest from '../helpers/MockRequest.mjs'
import MockResponse from '../helpers/MockResponse.mjs'

const MODULE_PATH =
  '../../../../app/src/infrastructure/UnsupportedBrowserMiddleware.mjs'

describe('UnsupportedBrowserMiddleware', function () {
  beforeEach(async function (ctx) {
    vi.doMock('@overleaf/settings', () => ({
      default: (ctx.settings = {
        unsupportedBrowsers: { chrome: '<50' },
        siteUrl: 'https://www.overleaf.com',
      }),
    }))

    ctx.UnsupportedBrowserMiddleware = (await import(MODULE_PATH)).default
    ctx.req = new MockRequest(vi)
    ctx.req.path = '/project'
    ctx.res = new MockResponse(vi)
    ctx.next = sinon.stub()
  })

  afterEach(function () {
    setReqValidationModeForTests(null)
  })

  describe('unsupportedBrowserMiddleware', function () {
    describe('request validation', function () {
      beforeEach(function (ctx) {
        setReqValidationModeForTests('enforce')
        ctx.req.headers = { 'user-agent': ['a', 'b'] }
      })

      it('rejects a non-string user-agent header', function (ctx) {
        let error
        try {
          ctx.UnsupportedBrowserMiddleware.unsupportedBrowserMiddleware(
            ctx.req,
            ctx.res,
            ctx.next
          )
        } catch (err) {
          error = err
        }
        expect(error).to.be.instanceOf(InvalidRequestError)
        sinon.assert.notCalled(ctx.next)
      })
    })
  })
})
