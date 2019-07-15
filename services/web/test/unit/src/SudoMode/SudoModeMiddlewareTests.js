/* eslint-disable
    max-len,
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
const SandboxedModule = require('sandboxed-module')
const assert = require('assert')
require('chai').should()
const { expect } = require('chai')
const sinon = require('sinon')
const modulePath = require('path').join(
  __dirname,
  '../../../../app/src/Features/SudoMode/SudoModeMiddleware'
)

describe('SudoModeMiddleware', function() {
  beforeEach(function() {
    this.userId = 'some_user_id'
    this.SudoModeHandler = { isSudoModeActive: sinon.stub() }
    this.AuthenticationController = {
      getLoggedInUserId: sinon.stub().returns(this.userId),
      setRedirectInSession: sinon.stub()
    }
    return (this.SudoModeMiddleware = SandboxedModule.require(modulePath, {
      globals: {
        console: console
      },
      requires: {
        './SudoModeHandler': this.SudoModeHandler,
        '../Authentication/AuthenticationController': this
          .AuthenticationController,
        'logger-sharelatex': {
          log: sinon.stub(),
          warn: sinon.stub(),
          err: sinon.stub()
        },
        'settings-sharelatex': (this.Settings = {})
      }
    }))
  })

  describe('protectPage', function() {
    beforeEach(function() {
      this.externalAuth = false
      return (this.call = cb => {
        this.req = {
          externalAuthenticationSystemUsed: sinon
            .stub()
            .returns(this.externalAuth)
        }
        this.res = { redirect: sinon.stub() }
        this.next = sinon.stub()
        this.SudoModeMiddleware.protectPage(this.req, this.res, this.next)
        return cb()
      })
    })

    describe('when sudo mode is active', function() {
      beforeEach(function() {
        this.AuthenticationController.getLoggedInUserId = sinon
          .stub()
          .returns(this.userId)
        return (this.SudoModeHandler.isSudoModeActive = sinon
          .stub()
          .callsArgWith(1, null, true))
      })

      it('should get the current user id', function(done) {
        return this.call(() => {
          this.AuthenticationController.getLoggedInUserId.callCount.should.equal(
            1
          )
          return done()
        })
      })

      it('should check if sudo-mode is active', function(done) {
        return this.call(() => {
          this.SudoModeHandler.isSudoModeActive.callCount.should.equal(1)
          this.SudoModeHandler.isSudoModeActive
            .calledWith(this.userId)
            .should.equal(true)
          return done()
        })
      })

      it('should call next', function(done) {
        return this.call(() => {
          this.next.callCount.should.equal(1)
          expect(this.next.lastCall.args[0]).to.equal(undefined)
          return done()
        })
      })
    })

    describe('when sudo mode is not active', function() {
      beforeEach(function() {
        this.AuthenticationController.setRedirectInSession = sinon.stub()
        this.AuthenticationController.getLoggedInUserId = sinon
          .stub()
          .returns(this.userId)
        return (this.SudoModeHandler.isSudoModeActive = sinon
          .stub()
          .callsArgWith(1, null, false))
      })

      it('should get the current user id', function(done) {
        return this.call(() => {
          this.AuthenticationController.getLoggedInUserId.callCount.should.equal(
            1
          )
          return done()
        })
      })

      it('should check if sudo-mode is active', function(done) {
        return this.call(() => {
          this.SudoModeHandler.isSudoModeActive.callCount.should.equal(1)
          this.SudoModeHandler.isSudoModeActive
            .calledWith(this.userId)
            .should.equal(true)
          return done()
        })
      })

      it('should set redirect in session', function(done) {
        return this.call(() => {
          this.AuthenticationController.setRedirectInSession.callCount.should.equal(
            1
          )
          this.AuthenticationController.setRedirectInSession
            .calledWith(this.req)
            .should.equal(true)
          return done()
        })
      })

      it('should redirect to the password-prompt page', function(done) {
        return this.call(() => {
          this.res.redirect.callCount.should.equal(1)
          this.res.redirect.calledWith('/confirm-password').should.equal(true)
          return done()
        })
      })
    })

    describe('when isSudoModeActive produces an error', function() {
      beforeEach(function() {
        this.AuthenticationController.getLoggedInUserId = sinon
          .stub()
          .returns(this.userId)
        return (this.SudoModeHandler.isSudoModeActive = sinon
          .stub()
          .callsArgWith(1, new Error('woops')))
      })

      it('should get the current user id', function(done) {
        return this.call(() => {
          this.AuthenticationController.getLoggedInUserId.callCount.should.equal(
            1
          )
          return done()
        })
      })

      it('should check if sudo-mode is active', function(done) {
        return this.call(() => {
          this.SudoModeHandler.isSudoModeActive.callCount.should.equal(1)
          this.SudoModeHandler.isSudoModeActive
            .calledWith(this.userId)
            .should.equal(true)
          return done()
        })
      })

      it('should call next with an error', function(done) {
        return this.call(() => {
          this.next.callCount.should.equal(1)
          expect(this.next.lastCall.args[0]).to.be.instanceof(Error)
          return done()
        })
      })
    })

    describe('when external auth is being used', function() {
      beforeEach(function() {
        this.externalAuth = true
        return (this.call = cb => {
          this.req = {
            externalAuthenticationSystemUsed: sinon
              .stub()
              .returns(this.externalAuth)
          }
          this.res = { redirect: sinon.stub() }
          this.next = sinon.stub()
          this.SudoModeMiddleware.protectPage(this.req, this.res, this.next)
          return cb()
        })
      })

      it('should immediately return next with no args', function(done) {
        return this.call(() => {
          this.next.callCount.should.equal(1)
          expect(this.next.lastCall.args[0]).to.not.exist
          return done()
        })
      })

      it('should not get the current user id', function(done) {
        return this.call(() => {
          this.AuthenticationController.getLoggedInUserId.callCount.should.equal(
            0
          )
          return done()
        })
      })

      it('should not check if sudo-mode is active', function(done) {
        return this.call(() => {
          this.SudoModeHandler.isSudoModeActive.callCount.should.equal(0)
          return done()
        })
      })
    })
  })
})
