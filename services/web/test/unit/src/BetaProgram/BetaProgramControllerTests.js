/* eslint-disable
    max-len,
    mocha/no-identical-title,
    no-return-assign,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const should = require('chai').should()
const SandboxedModule = require('sandboxed-module')
const assert = require('assert')
const path = require('path')
const sinon = require('sinon')
const modulePath = path.join(
  __dirname,
  '../../../../app/src/Features/BetaProgram/BetaProgramController'
)
const { expect } = require('chai')

describe('BetaProgramController', function() {
  beforeEach(function() {
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
      globals: {
        console: console
      },
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
        'logger-sharelatex': (this.logger = {
          log: sinon.stub(),
          warn: sinon.stub(),
          err: sinon.stub(),
          error: sinon.stub()
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
    return (this.next = sinon.stub())
  })

  describe('optIn', function() {
    beforeEach(function() {
      return this.BetaProgramHandler.optIn.callsArgWith(1, null)
    })

    it("should redirect to '/beta/participate'", function() {
      this.BetaProgramController.optIn(this.req, this.res, this.next)
      this.res.redirect.callCount.should.equal(1)
      return this.res.redirect.firstCall.args[0].should.equal(
        '/beta/participate'
      )
    })

    it('should not call next with an error', function() {
      this.BetaProgramController.optIn(this.req, this.res, this.next)
      return this.next.callCount.should.equal(0)
    })

    it('should not call next with an error', function() {
      this.BetaProgramController.optIn(this.req, this.res, this.next)
      return this.next.callCount.should.equal(0)
    })

    it('should call BetaProgramHandler.optIn', function() {
      this.BetaProgramController.optIn(this.req, this.res, this.next)
      return this.BetaProgramHandler.optIn.callCount.should.equal(1)
    })

    describe('when BetaProgramHandler.opIn produces an error', function() {
      beforeEach(function() {
        return this.BetaProgramHandler.optIn.callsArgWith(1, new Error('woops'))
      })

      it("should not redirect to '/beta/participate'", function() {
        this.BetaProgramController.optIn(this.req, this.res, this.next)
        return this.res.redirect.callCount.should.equal(0)
      })

      it('should produce an error', function() {
        this.BetaProgramController.optIn(this.req, this.res, this.next)
        this.next.callCount.should.equal(1)
        return this.next.firstCall.args[0].should.be.instanceof(Error)
      })
    })
  })

  describe('optOut', function() {
    beforeEach(function() {
      return this.BetaProgramHandler.optOut.callsArgWith(1, null)
    })

    it("should redirect to '/beta/participate'", function() {
      this.BetaProgramController.optOut(this.req, this.res, this.next)
      this.res.redirect.callCount.should.equal(1)
      return this.res.redirect.firstCall.args[0].should.equal(
        '/beta/participate'
      )
    })

    it('should not call next with an error', function() {
      this.BetaProgramController.optOut(this.req, this.res, this.next)
      return this.next.callCount.should.equal(0)
    })

    it('should not call next with an error', function() {
      this.BetaProgramController.optOut(this.req, this.res, this.next)
      return this.next.callCount.should.equal(0)
    })

    it('should call BetaProgramHandler.optOut', function() {
      this.BetaProgramController.optOut(this.req, this.res, this.next)
      return this.BetaProgramHandler.optOut.callCount.should.equal(1)
    })

    describe('when BetaProgramHandler.optOut produces an error', function() {
      beforeEach(function() {
        return this.BetaProgramHandler.optOut.callsArgWith(
          1,
          new Error('woops')
        )
      })

      it("should not redirect to '/beta/participate'", function() {
        this.BetaProgramController.optOut(this.req, this.res, this.next)
        return this.res.redirect.callCount.should.equal(0)
      })

      it('should produce an error', function() {
        this.BetaProgramController.optOut(this.req, this.res, this.next)
        this.next.callCount.should.equal(1)
        return this.next.firstCall.args[0].should.be.instanceof(Error)
      })
    })
  })

  describe('optInPage', function() {
    beforeEach(function() {
      return this.UserGetter.getUser.callsArgWith(1, null, this.user)
    })

    it('should render the opt-in page', function() {
      this.BetaProgramController.optInPage(this.req, this.res, this.next)
      this.res.render.callCount.should.equal(1)
      const { args } = this.res.render.firstCall
      return args[0].should.equal('beta_program/opt_in')
    })

    describe('when UserGetter.getUser produces an error', function() {
      beforeEach(function() {
        return this.UserGetter.getUser.callsArgWith(1, new Error('woops'))
      })

      it('should not render the opt-in page', function() {
        this.BetaProgramController.optInPage(this.req, this.res, this.next)
        return this.res.render.callCount.should.equal(0)
      })

      it('should produce an error', function() {
        this.BetaProgramController.optInPage(this.req, this.res, this.next)
        this.next.callCount.should.equal(1)
        return this.next.firstCall.args[0].should.be.instanceof(Error)
      })
    })
  })
})
