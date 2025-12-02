import { expect, vi } from 'vitest'
import Path from 'node:path'
import sinon from 'sinon'
import MockResponse from '../helpers/MockResponse.mjs'
import MockRequest from '../helpers/MockRequest.mjs'

const modulePath = Path.join(
  import.meta.dirname,
  '../../../../app/src/infrastructure/ServeStaticWrapper'
)

describe('ServeStaticWrapperTests', function () {
  let error = null

  beforeEach(async function (ctx) {
    ctx.req = new MockRequest(vi)
    ctx.res = new MockResponse(vi)
    ctx.express = {
      static: () => (req, res, next) => {
        if (error) {
          next(error)
        } else {
          next()
        }
      },
    }

    vi.doMock('express', () => ({
      default: ctx.express,
    }))

    ctx.serveStaticWrapper = (await import(modulePath)).default
  })

  afterEach(() => {
    error = null
  })

  it('Premature close error thrown', async function (ctx) {
    error = new Error()
    error.code = 'ERR_STREAM_PREMATURE_CLOSE'
    const middleware = ctx.serveStaticWrapper('test_folder', {})
    const next = sinon.stub()
    middleware(ctx.req, ctx.res, next)
    expect(next.called).to.be.false
  })

  it('No error thrown', async function (ctx) {
    const middleware = ctx.serveStaticWrapper('test_folder', {})
    const next = sinon.stub()
    middleware(ctx.req, ctx.res, next)
    expect(next).to.be.calledWith()
  })

  it('Other error thrown', async function (ctx) {
    error = new Error()
    const middleware = ctx.serveStaticWrapper('test_folder', {})
    const next = sinon.stub()
    middleware(ctx.req, ctx.res, next)
    expect(next).to.be.calledWith(error)
  })
})
