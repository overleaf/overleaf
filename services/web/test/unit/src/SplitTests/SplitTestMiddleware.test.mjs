import { vi } from 'vitest'
import sinon from 'sinon'
import MockResponse from '../helpers/MockResponse.mjs'
import MockRequest from '../helpers/MockRequest.mjs'

const modulePath = '../../../../app/src/Features/SplitTests/SplitTestMiddleware'

describe('SplitTestMiddleware', function () {
  beforeEach(async function (ctx) {
    vi.doMock(
      '../../../../app/src/Features/SplitTests/SplitTestHandler.mjs',
      () => ({
        default: (ctx.SplitTestHandler = {
          promises: {
            getAssignment: sinon.stub().resolves(),
          },
        }),
      })
    )

    ctx.SplitTestMiddleware = (await import(modulePath)).default

    ctx.req = new MockRequest(vi)
    ctx.res = new MockResponse(vi)
    ctx.next = sinon.stub()
  })

  it('assign multiple split test variants in locals', async function (ctx) {
    ctx.SplitTestHandler.promises.getAssignment
      .withArgs(ctx.req, 'ui-overhaul')
      .resolves({
        variant: 'default',
      })
    ctx.SplitTestHandler.promises.getAssignment
      .withArgs(ctx.req, 'other-test')
      .resolves({
        variant: 'foobar',
      })

    const middleware = ctx.SplitTestMiddleware.loadAssignmentsInLocals([
      'ui-overhaul',
      'other-test',
    ])
    await middleware(ctx.req, ctx.res, ctx.next)

    sinon.assert.calledWith(
      ctx.SplitTestHandler.promises.getAssignment,
      ctx.req,
      ctx.res,
      'ui-overhaul'
    )
    sinon.assert.calledWith(
      ctx.SplitTestHandler.promises.getAssignment,
      ctx.req,
      ctx.res,
      'other-test'
    )
    sinon.assert.calledOnce(ctx.next)
  })

  it('assign no split test variant in locals', async function (ctx) {
    const middleware = ctx.SplitTestMiddleware.loadAssignmentsInLocals([])

    await middleware(ctx.req, ctx.res, ctx.next)

    sinon.assert.notCalled(ctx.SplitTestHandler.promises.getAssignment)
    sinon.assert.calledOnce(ctx.next)
  })

  it('exception thrown by assignment does not fail the request', async function (ctx) {
    ctx.SplitTestHandler.promises.getAssignment
      .withArgs(ctx.req, ctx.res, 'some-test')
      .throws(new Error('failure'))

    const middleware = ctx.SplitTestMiddleware.loadAssignmentsInLocals([
      'some-test',
    ])

    await middleware(ctx.req, ctx.res, ctx.next)

    sinon.assert.calledWith(
      ctx.SplitTestHandler.promises.getAssignment,
      ctx.req,
      ctx.res,
      'some-test'
    )
    sinon.assert.calledOnce(ctx.next)
  })
})
