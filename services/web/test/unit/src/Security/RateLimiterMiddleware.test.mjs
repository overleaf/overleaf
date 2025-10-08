import { vi } from 'vitest'
import sinon from 'sinon'

const modulePath =
  '../../../../app/src/Features/Security/RateLimiterMiddleware.mjs'

describe('RateLimiterMiddleware', function () {
  beforeEach(async function (ctx) {
    ctx.SessionManager = {
      getLoggedInUserId: () => ctx.req.session?.user?._id,
    }

    vi.doMock('@overleaf/settings', () => ({
      default: (ctx.settings = {}),
    }))

    vi.doMock('../../../../app/src/Features/Security/LoginRateLimiter', () => ({
      default: {},
    }))

    vi.doMock(
      '../../../../app/src/Features/Authentication/SessionManager',
      () => ({
        default: ctx.SessionManager,
      })
    )

    ctx.RateLimiterMiddleware = (await import(modulePath)).default
    ctx.req = { params: {} }
    ctx.res = {
      status: sinon.stub(),
      write: sinon.stub(),
      end: sinon.stub(),
    }
    ctx.next = sinon.stub()
  })

  describe('rateLimit', function () {
    beforeEach(function (ctx) {
      ctx.projectId = 'project-id'
      ctx.docId = 'doc-id'
      ctx.rateLimiter = {
        consume: sinon.stub().resolves({ remainingPoints: 2 }),
      }
      ctx.middleware = ctx.RateLimiterMiddleware.rateLimit(ctx.rateLimiter, {
        params: ['projectId', 'docId'],
      })
      ctx.req.params = { projectId: ctx.projectId, docId: ctx.docId }
    })

    describe('when there is no session', function () {
      beforeEach(async function (ctx) {
        await new Promise(resolve => {
          ctx.req.ip = ctx.ip = '1.2.3.4'
          ctx.middleware(ctx.req, ctx.res, () => {
            resolve()
          })
        })
      })

      it('should call the rate limiter with the ip address', function (ctx) {
        ctx.rateLimiter.consume.should.have.been.calledWith(
          `${ctx.projectId}:${ctx.docId}:${ctx.ip}`
        )
      })
    })

    describe('when smoke test user', function () {
      beforeEach(async function (ctx) {
        await new Promise(resolve => {
          ctx.userId = 'smoke-test-user-id'
          ctx.req.session = {
            user: { _id: ctx.userId },
          }
          ctx.settings.smokeTest = { userId: ctx.userId }
          ctx.middleware(ctx.req, ctx.res, () => {
            resolve()
          })
        })
      })

      it('should not call the rate limiter', function (ctx) {
        ctx.rateLimiter.consume.should.not.have.been.called
      })
    })

    describe('when under the rate limit with logged in user', function () {
      beforeEach(async function (ctx) {
        await new Promise(resolve => {
          ctx.userId = 'user-id'
          ctx.req.session = {
            user: { _id: ctx.userId },
          }
          ctx.middleware(ctx.req, ctx.res, () => {
            resolve()
          })
        })
      })

      it('should call the rate limiter backend with the userId', function (ctx) {
        ctx.rateLimiter.consume.should.have.been.calledWith(
          `${ctx.projectId}:${ctx.docId}:${ctx.userId}`
        )
      })
    })

    describe('when under the rate limit with anonymous user', function () {
      beforeEach(async function (ctx) {
        await new Promise(resolve => {
          ctx.req.ip = '1.2.3.4'
          ctx.middleware(ctx.req, ctx.res, () => {
            resolve()
          })
        })
      })

      it('should call the rate limiter backend with the ip address', function (ctx) {
        ctx.rateLimiter.consume.should.have.been.calledWith(
          `${ctx.projectId}:${ctx.docId}:${ctx.req.ip}`
        )
      })
    })

    describe('when over the rate limit', function () {
      beforeEach(async function (ctx) {
        await new Promise(resolve => {
          ctx.userId = 'user-id'
          ctx.req.session = {
            user: { _id: ctx.userId },
          }
          ctx.res.end.callsFake(() => {
            resolve()
          })
          ctx.rateLimiter.consume.rejects({ remainingPoints: 0 })
          ctx.middleware(ctx.req, ctx.res, ctx.next)
        })
      })

      it('should return a 429', function (ctx) {
        ctx.res.status.should.have.been.calledWith(429)
      })

      it('should not continue', function (ctx) {
        ctx.next.should.not.have.been.called
      })
    })
  })
})
