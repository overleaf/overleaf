import esmock from 'esmock'
import path from 'node:path'
import sinon from 'sinon'
import { expect } from 'chai'
import MockResponse from '../helpers/MockResponse.js'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

const modulePath = path.join(
  __dirname,
  '../../../../app/src/Features/BetaProgram/BetaProgramController'
)

describe('BetaProgramController', function () {
  beforeEach(async function () {
    this.user = {
      _id: (this.user_id = 'a_simple_id'),
      email: 'user@example.com',
      features: {},
      betaProgram: false,
    }
    this.req = {
      query: {},
      session: {
        user: this.user,
      },
    }
    this.SplitTestSessionHandler = {
      promises: {
        sessionMaintenance: sinon.stub(),
      },
    }
    this.BetaProgramController = await esmock.strict(modulePath, {
      '../../../../app/src/Features/SplitTests/SplitTestSessionHandler':
        this.SplitTestSessionHandler,
      '../../../../app/src/Features/BetaProgram/BetaProgramHandler':
        (this.BetaProgramHandler = {
          promises: {
            optIn: sinon.stub().resolves(),
            optOut: sinon.stub().resolves(),
          },
        }),
      '../../../../app/src/Features/User/UserGetter': (this.UserGetter = {
        promises: {
          getUser: sinon.stub().resolves(),
        },
      }),
      '@overleaf/settings': (this.settings = {
        languages: {},
      }),
      '../../../../app/src/Features/Authentication/AuthenticationController':
        (this.AuthenticationController = {
          getLoggedInUserId: sinon.stub().returns(this.user._id),
        }),
    })
    this.res = new MockResponse()
    this.next = sinon.stub()
  })

  describe('optIn', function () {
    it("should redirect to '/beta/participate'", function (done) {
      this.res.callback = () => {
        this.res.redirectedTo.should.equal('/beta/participate')
        done()
      }
      this.BetaProgramController.optIn(this.req, this.res, done)
    })

    it('should not call next with an error', function () {
      this.BetaProgramController.optIn(this.req, this.res, this.next)
      this.next.callCount.should.equal(0)
    })

    it('should call BetaProgramHandler.optIn', function () {
      this.BetaProgramController.optIn(this.req, this.res, this.next)
      this.BetaProgramHandler.promises.optIn.callCount.should.equal(1)
    })

    it('should invoke the session maintenance', function (done) {
      this.res.callback = () => {
        this.SplitTestSessionHandler.promises.sessionMaintenance.should.have.been.calledWith(
          this.req
        )
        done()
      }
      this.BetaProgramController.optIn(this.req, this.res, done)
    })

    describe('when BetaProgramHandler.opIn produces an error', function () {
      beforeEach(function () {
        this.BetaProgramHandler.promises.optIn.throws(new Error('woops'))
      })

      it("should not redirect to '/beta/participate'", function () {
        this.BetaProgramController.optIn(this.req, this.res, this.next)
        this.res.redirect.callCount.should.equal(0)
      })

      it('should produce an error', function (done) {
        this.BetaProgramController.optIn(this.req, this.res, err => {
          expect(err).to.be.instanceof(Error)
          done()
        })
      })
    })
  })

  describe('optOut', function () {
    it("should redirect to '/beta/participate'", function (done) {
      this.res.callback = () => {
        expect(this.res.redirectedTo).to.equal('/beta/participate')
        done()
      }
      this.BetaProgramController.optOut(this.req, this.res, done)
    })

    it('should not call next with an error', function (done) {
      this.res.callback = () => {
        this.next.callCount.should.equal(0)
        done()
      }
      this.BetaProgramController.optOut(this.req, this.res, done)
    })

    it('should call BetaProgramHandler.optOut', function (done) {
      this.res.callback = () => {
        this.BetaProgramHandler.promises.optOut.callCount.should.equal(1)
        done()
      }
      this.BetaProgramController.optOut(this.req, this.res, done)
    })

    it('should invoke the session maintenance', function (done) {
      this.res.callback = () => {
        this.SplitTestSessionHandler.promises.sessionMaintenance.should.have.been.calledWith(
          this.req,
          null
        )
        done()
      }
      this.BetaProgramController.optOut(this.req, this.res, done)
    })

    describe('when BetaProgramHandler.optOut produces an error', function () {
      beforeEach(function () {
        this.BetaProgramHandler.promises.optOut.throws(new Error('woops'))
      })

      it("should not redirect to '/beta/participate'", function (done) {
        this.BetaProgramController.optOut(this.req, this.res, error => {
          expect(error).to.exist
          expect(this.res.redirected).to.equal(false)
          done()
        })
      })

      it('should produce an error', function (done) {
        this.BetaProgramController.optOut(this.req, this.res, error => {
          expect(error).to.exist
          done()
        })
      })
    })
  })

  describe('optInPage', function () {
    beforeEach(function () {
      this.UserGetter.promises.getUser.resolves(this.user)
    })

    it('should render the opt-in page', function (done) {
      this.res.callback = () => {
        expect(this.res.renderedTemplate).to.equal('beta_program/opt_in')
        done()
      }
      this.BetaProgramController.optInPage(this.req, this.res, done)
    })

    describe('when UserGetter.getUser produces an error', function () {
      beforeEach(function () {
        this.UserGetter.promises.getUser.throws(new Error('woops'))
      })

      it('should not render the opt-in page', function () {
        this.BetaProgramController.optInPage(this.req, this.res, this.next)
        this.res.render.callCount.should.equal(0)
      })

      it('should produce an error', function (done) {
        this.BetaProgramController.optInPage(this.req, this.res, error => {
          expect(error).to.exist
          expect(error).to.be.instanceof(Error)
          done()
        })
      })
    })
  })
})
