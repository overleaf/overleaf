const SandboxedModule = require('sandboxed-module')
const path = require('path')
const sinon = require('sinon')

const modulePath = path.join(
  __dirname,
  '../../../../app/src/Features/BetaProgram/BetaProgramController'
)

describe('BetaProgramController', function () {
  beforeEach(function () {
    this.user = {
      _id: (this.user_id = 'a_simple_id'),
      email: 'user@example.com',
      features: {},
      betaProgram: false
    }
    this.req = {
      query: {},
      session: {
        user: this.user
      }
    }
    this.BetaProgramController = SandboxedModule.require(modulePath, {
      requires: {
        './BetaProgramHandler': (this.BetaProgramHandler = {
          optIn: sinon.stub(),
          optOut: sinon.stub()
        }),
        '../User/UserGetter': (this.UserGetter = {
          getUser: sinon.stub()
        }),
        'settings-sharelatex': (this.settings = {
          languages: {}
        }),
        '../Authentication/AuthenticationController': (this.AuthenticationController = {
          getLoggedInUserId: sinon.stub().returns(this.user._id)
        })
      }
    })
    this.res = {
      send: sinon.stub(),
      redirect: sinon.stub(),
      render: sinon.stub()
    }
    this.next = sinon.stub()
  })

  describe('optIn', function () {
    beforeEach(function () {
      this.BetaProgramHandler.optIn.callsArgWith(1, null)
    })

    it("should redirect to '/beta/participate'", function () {
      this.BetaProgramController.optIn(this.req, this.res, this.next)
      this.res.redirect.callCount.should.equal(1)
      this.res.redirect.firstCall.args[0].should.equal('/beta/participate')
    })

    it('should not call next with an error', function () {
      this.BetaProgramController.optIn(this.req, this.res, this.next)
      this.next.callCount.should.equal(0)
    })

    it('should call BetaProgramHandler.optIn', function () {
      this.BetaProgramController.optIn(this.req, this.res, this.next)
      this.BetaProgramHandler.optIn.callCount.should.equal(1)
    })

    describe('when BetaProgramHandler.opIn produces an error', function () {
      beforeEach(function () {
        this.BetaProgramHandler.optIn.callsArgWith(1, new Error('woops'))
      })

      it("should not redirect to '/beta/participate'", function () {
        this.BetaProgramController.optIn(this.req, this.res, this.next)
        this.res.redirect.callCount.should.equal(0)
      })

      it('should produce an error', function () {
        this.BetaProgramController.optIn(this.req, this.res, this.next)
        this.next.callCount.should.equal(1)
        this.next.firstCall.args[0].should.be.instanceof(Error)
      })
    })
  })

  describe('optOut', function () {
    beforeEach(function () {
      this.BetaProgramHandler.optOut.callsArgWith(1, null)
    })

    it("should redirect to '/beta/participate'", function () {
      this.BetaProgramController.optOut(this.req, this.res, this.next)
      this.res.redirect.callCount.should.equal(1)
      this.res.redirect.firstCall.args[0].should.equal('/beta/participate')
    })

    it('should not call next with an error', function () {
      this.BetaProgramController.optOut(this.req, this.res, this.next)
      this.next.callCount.should.equal(0)
    })

    it('should call BetaProgramHandler.optOut', function () {
      this.BetaProgramController.optOut(this.req, this.res, this.next)
      this.BetaProgramHandler.optOut.callCount.should.equal(1)
    })

    describe('when BetaProgramHandler.optOut produces an error', function () {
      beforeEach(function () {
        this.BetaProgramHandler.optOut.callsArgWith(1, new Error('woops'))
      })

      it("should not redirect to '/beta/participate'", function () {
        this.BetaProgramController.optOut(this.req, this.res, this.next)
        this.res.redirect.callCount.should.equal(0)
      })

      it('should produce an error', function () {
        this.BetaProgramController.optOut(this.req, this.res, this.next)
        this.next.callCount.should.equal(1)
        this.next.firstCall.args[0].should.be.instanceof(Error)
      })
    })
  })

  describe('optInPage', function () {
    beforeEach(function () {
      this.UserGetter.getUser.callsArgWith(1, null, this.user)
    })

    it('should render the opt-in page', function () {
      this.BetaProgramController.optInPage(this.req, this.res, this.next)
      this.res.render.callCount.should.equal(1)
      const { args } = this.res.render.firstCall
      args[0].should.equal('beta_program/opt_in')
    })

    describe('when UserGetter.getUser produces an error', function () {
      beforeEach(function () {
        this.UserGetter.getUser.callsArgWith(1, new Error('woops'))
      })

      it('should not render the opt-in page', function () {
        this.BetaProgramController.optInPage(this.req, this.res, this.next)
        this.res.render.callCount.should.equal(0)
      })

      it('should produce an error', function () {
        this.BetaProgramController.optInPage(this.req, this.res, this.next)
        this.next.callCount.should.equal(1)
        this.next.firstCall.args[0].should.be.instanceof(Error)
      })
    })
  })
})
