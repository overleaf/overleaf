import accepts from 'accepts'
import { expect, vi } from 'vitest'
import MockRequest from '../helpers/MockRequest.mjs'
const MODULE_PATH =
  '../../../../app/src/infrastructure/RequestContentTypeDetection.mjs'

describe('RequestContentTypeDetection', function () {
  beforeEach(async function (ctx) {
    ctx.RequestContentTypeDetection = await import(MODULE_PATH)
    ctx.req = new MockRequest(vi)
    ctx.req.accepts = function (...args) {
      return accepts(this).type(...args)
    }
  })

  describe('isJson=true', function () {
    function expectJson(type) {
      it(type, function (ctx) {
        ctx.req.headers.accept = type
        expect(ctx.RequestContentTypeDetection.acceptsJson(ctx.req)).to.equal(
          true
        )
      })
    }

    expectJson('application/json')
    expectJson('application/json, text/plain, */*')
    expectJson('application/json, text/html, */*')
  })

  describe('isJson=false', function () {
    function expectNonJson(type) {
      it(type, function (ctx) {
        ctx.req.headers.accept = type
        expect(ctx.RequestContentTypeDetection.acceptsJson(ctx.req)).to.equal(
          false
        )
      })
    }

    expectNonJson('*/*')
    expectNonJson('text/html')
    expectNonJson('text/html, application/json')
    expectNonJson('image/png')
  })
})
