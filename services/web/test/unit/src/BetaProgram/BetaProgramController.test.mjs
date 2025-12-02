import { expect, vi } from 'vitest'
import path from 'node:path'
import sinon from 'sinon'
import MockResponse from '../helpers/MockResponse.mjs'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

const modulePath = path.join(
  __dirname,
  '../../../../app/src/Features/BetaProgram/BetaProgramController'
)

describe('BetaProgramController', function () {
  beforeEach(async function (ctx) {
    ctx.user = {
      _id: (ctx.user_id = 'a_simple_id'),
      email: 'user@example.com',
      features: {},
      betaProgram: false,
    }
    ctx.req = {
      query: {},
      session: {
        user: ctx.user,
      },
    }
    ctx.SplitTestSessionHandler = {
      promises: {
        sessionMaintenance: sinon.stub(),
      },
    }

    vi.doMock(
      '../../../../app/src/Features/SplitTests/SplitTestSessionHandler',
      () => ({
        default: ctx.SplitTestSessionHandler,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/BetaProgram/BetaProgramHandler',
      () => ({
        default: (ctx.BetaProgramHandler = {
          promises: {
            optIn: sinon.stub().resolves(),
            optOut: sinon.stub().resolves(),
          },
        }),
      })
    )

    vi.doMock('../../../../app/src/Features/User/UserGetter', () => ({
      default: (ctx.UserGetter = {
        promises: {
          getUser: sinon.stub().resolves(),
        },
      }),
    }))

    vi.doMock('@overleaf/settings', () => ({
      default: (ctx.settings = {
        languages: {},
      }),
    }))

    vi.doMock(
      '../../../../app/src/Features/Authentication/AuthenticationController',
      () => ({
        default: (ctx.AuthenticationController = {
          getLoggedInUserId: sinon.stub().returns(ctx.user._id),
        }),
      })
    )

    ctx.BetaProgramController = (await import(modulePath)).default
    ctx.res = new MockResponse(vi)
    ctx.next = sinon.stub()
  })

  describe('optIn', function () {
    it("should redirect to '/beta/participate'", async function (ctx) {
      await new Promise((resolve, reject) => {
        ctx.res.callback = () => {
          ctx.res.redirectedTo.should.equal('/beta/participate')
          resolve()
        }
        ctx.BetaProgramController.optIn(
          ctx.req,
          ctx.res,
          ctx.rejectOnError(reject)
        )
      })
    })

    it('should not call next with an error', function (ctx) {
      ctx.BetaProgramController.optIn(ctx.req, ctx.res, ctx.next)
      ctx.next.callCount.should.equal(0)
    })

    it('should call BetaProgramHandler.optIn', function (ctx) {
      ctx.BetaProgramController.optIn(ctx.req, ctx.res, ctx.next)
      ctx.BetaProgramHandler.promises.optIn.callCount.should.equal(1)
    })

    it('should invoke the session maintenance', async function (ctx) {
      await new Promise(resolve => {
        ctx.res.callback = () => {
          ctx.SplitTestSessionHandler.promises.sessionMaintenance.should.have.been.calledWith(
            ctx.req
          )
          resolve()
        }
        ctx.BetaProgramController.optIn(ctx.req, ctx.res)
      })
    })

    describe('when BetaProgramHandler.opIn produces an error', function () {
      beforeEach(function (ctx) {
        ctx.BetaProgramHandler.promises.optIn.throws(new Error('woops'))
      })

      it("should not redirect to '/beta/participate'", function (ctx) {
        ctx.BetaProgramController.optIn(ctx.req, ctx.res, ctx.next)
        expect(ctx.res.redirect).not.toHaveBeenCalled()
      })

      it('should produce an error', async function (ctx) {
        await new Promise(resolve => {
          ctx.BetaProgramController.optIn(ctx.req, ctx.res, err => {
            expect(err).to.be.instanceof(Error)
            resolve()
          })
        })
      })
    })
  })

  describe('optOut', function () {
    it("should redirect to '/beta/participate'", async function (ctx) {
      await new Promise((resolve, reject) => {
        ctx.res.callback = () => {
          expect(ctx.res.redirectedTo).to.equal('/beta/participate')
          resolve()
        }
        ctx.BetaProgramController.optOut(
          ctx.req,
          ctx.res,
          ctx.rejectOnError(reject)
        )
      })
    })

    it('should not call next with an error', async function (ctx) {
      await new Promise((resolve, reject) => {
        ctx.res.callback = () => {
          ctx.next.callCount.should.equal(0)
          resolve()
        }
        ctx.BetaProgramController.optOut(
          ctx.req,
          ctx.res,
          ctx.rejectOnError(reject)
        )
      })
    })

    it('should call BetaProgramHandler.optOut', async function (ctx) {
      await new Promise((resolve, reject) => {
        ctx.res.callback = () => {
          ctx.BetaProgramHandler.promises.optOut.callCount.should.equal(1)
          resolve()
        }
        ctx.BetaProgramController.optOut(
          ctx.req,
          ctx.res,
          ctx.rejectOnError(reject)
        )
      })
    })

    it('should invoke the session maintenance', async function (ctx) {
      await new Promise((resolve, reject) => {
        ctx.res.callback = () => {
          ctx.SplitTestSessionHandler.promises.sessionMaintenance.should.have.been.calledWith(
            ctx.req,
            null
          )
          resolve()
        }
        ctx.BetaProgramController.optOut(
          ctx.req,
          ctx.res,
          ctx.rejectOnError(reject)
        )
      })
    })

    describe('when BetaProgramHandler.optOut produces an error', function () {
      beforeEach(function (ctx) {
        ctx.BetaProgramHandler.promises.optOut.throws(new Error('woops'))
      })

      it("should not redirect to '/beta/participate'", async function (ctx) {
        await new Promise(resolve => {
          ctx.BetaProgramController.optOut(ctx.req, ctx.res, error => {
            expect(error).to.exist
            expect(ctx.res.redirected).to.equal(false)
            resolve()
          })
        })
      })

      it('should produce an error', async function (ctx) {
        await new Promise(resolve => {
          ctx.BetaProgramController.optOut(ctx.req, ctx.res, error => {
            expect(error).to.exist
            resolve()
          })
        })
      })
    })
  })

  describe('optInPage', function () {
    beforeEach(function (ctx) {
      ctx.UserGetter.promises.getUser.resolves(ctx.user)
    })

    it('should render the opt-in page', async function (ctx) {
      await new Promise((resolve, reject) => {
        ctx.res.callback = () => {
          expect(ctx.res.renderedTemplate).to.equal('beta_program/opt_in')
          resolve()
        }
        ctx.BetaProgramController.optInPage(
          ctx.req,
          ctx.res,
          ctx.rejectOnError(reject)
        )
      })
    })

    describe('when UserGetter.getUser produces an error', function () {
      beforeEach(function (ctx) {
        ctx.UserGetter.promises.getUser.throws(new Error('woops'))
      })

      it('should not render the opt-in page', function (ctx) {
        ctx.BetaProgramController.optInPage(ctx.req, ctx.res, ctx.next)
        expect(ctx.res.render).not.toHaveBeenCalled()
      })

      it('should produce an error', async function (ctx) {
        await new Promise(resolve => {
          ctx.BetaProgramController.optInPage(ctx.req, ctx.res, error => {
            expect(error).to.exist
            expect(error).to.be.instanceof(Error)
            resolve()
          })
        })
      })
    })
  })
})
