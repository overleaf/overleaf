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
const sinon = require('sinon')
const should = require('chai').should()
const { expect } = require('chai')
const MockRequest = require('../helpers/MockRequest')
const MockResponse = require('../helpers/MockResponse')
const modulePath = '../../../../app/src/Features/SudoMode/SudoModeController'

describe('SudoModeController', function() {
  beforeEach(function() {
    this.user = {
      _id: 'abcd',
      email: 'user@example.com'
    }
    this.UserGetter = { getUser: sinon.stub().callsArgWith(2, null, this.user) }
    this.SudoModeHandler = {
      authenticate: sinon.stub(),
      isSudoModeActive: sinon.stub(),
      activateSudoMode: sinon.stub()
    }
    this.AuthenticationController = {
      getLoggedInUserId: sinon.stub().returns(this.user._id),
      _getRediretFromSession: sinon.stub()
    }
    this.UserGetter = { getUser: sinon.stub() }
    return (this.SudoModeController = SandboxedModule.require(modulePath, {
      globals: {
        console: console
      },
      requires: {
        'logger-sharelatex': {
          log: sinon.stub(),
          warn: sinon.stub(),
          err: sinon.stub()
        },
        './SudoModeHandler': this.SudoModeHandler,
        '../Authentication/AuthenticationController': this
          .AuthenticationController,
        '../../infrastructure/Mongoose': {
          mongo: {
            ObjectId() {
              return 'some_object_id'
            }
          }
        },
        '../User/UserGetter': this.UserGetter,
        'settings-sharelatex': (this.Settings = {})
      }
    }))
  })

  describe('sudoModePrompt', function() {
    beforeEach(function() {
      this.SudoModeHandler.isSudoModeActive = sinon
        .stub()
        .callsArgWith(1, null, false)
      this.req = {
        externalAuthenticationSystemUsed: sinon.stub().returns(false)
      }
      this.res = { redirect: sinon.stub(), render: sinon.stub() }
      return (this.next = sinon.stub())
    })

    it('should get the logged in user id', function() {
      this.SudoModeController.sudoModePrompt(this.req, this.res, this.next)
      this.AuthenticationController.getLoggedInUserId.callCount.should.equal(1)
      return this.AuthenticationController.getLoggedInUserId
        .calledWith(this.req)
        .should.equal(true)
    })

    it('should check if sudo-mode is active', function() {
      this.SudoModeController.sudoModePrompt(this.req, this.res, this.next)
      this.SudoModeHandler.isSudoModeActive.callCount.should.equal(1)
      return this.SudoModeHandler.isSudoModeActive
        .calledWith(this.user._id)
        .should.equal(true)
    })

    it('should redirect when sudo-mode is active', function() {
      this.SudoModeHandler.isSudoModeActive = sinon
        .stub()
        .callsArgWith(1, null, true)
      this.SudoModeController.sudoModePrompt(this.req, this.res, this.next)
      this.res.redirect.callCount.should.equal(1)
      return this.res.redirect.calledWith('/project').should.equal(true)
    })

    it('should render the sudo_mode_prompt page when sudo mode is not active', function() {
      this.SudoModeHandler.isSudoModeActive = sinon
        .stub()
        .callsArgWith(1, null, false)
      this.SudoModeController.sudoModePrompt(this.req, this.res, this.next)
      this.res.render.callCount.should.equal(1)
      return this.res.render
        .calledWith('sudo_mode/sudo_mode_prompt')
        .should.equal(true)
    })

    describe('when isSudoModeActive produces an error', function() {
      beforeEach(function() {
        this.SudoModeHandler.isSudoModeActive = sinon
          .stub()
          .callsArgWith(1, new Error('woops'))
        return (this.next = sinon.stub())
      })

      it('should call next with an error', function() {
        this.SudoModeController.sudoModePrompt(this.req, this.res, this.next)
        this.next.callCount.should.equal(1)
        return expect(this.next.lastCall.args[0]).to.be.instanceof(Error)
      })

      it('should not render page', function() {
        this.SudoModeController.sudoModePrompt(this.req, this.res, this.next)
        return this.res.render.callCount.should.equal(0)
      })
    })

    describe('when external auth system is used', function() {
      beforeEach(function() {
        return (this.req.externalAuthenticationSystemUsed = sinon
          .stub()
          .returns(true))
      })

      it('should redirect', function() {
        this.SudoModeController.sudoModePrompt(this.req, this.res, this.next)
        this.res.redirect.callCount.should.equal(1)
        return this.res.redirect.calledWith('/project').should.equal(true)
      })

      it('should not check if sudo mode is active', function() {
        this.SudoModeController.sudoModePrompt(this.req, this.res, this.next)
        return this.SudoModeHandler.isSudoModeActive.callCount.should.equal(0)
      })

      it('should not render page', function() {
        this.SudoModeController.sudoModePrompt(this.req, this.res, this.next)
        return this.res.render.callCount.should.equal(0)
      })
    })
  })

  describe('submitPassword', function() {
    beforeEach(function() {
      this.AuthenticationController._getRedirectFromSession = sinon
        .stub()
        .returns('/somewhere')
      this.UserGetter.getUser = sinon.stub().callsArgWith(2, null, this.user)
      this.SudoModeHandler.authenticate = sinon
        .stub()
        .callsArgWith(2, null, this.user)
      this.SudoModeHandler.activateSudoMode = sinon.stub().callsArgWith(1, null)
      this.password = 'a_terrible_secret'
      this.req = { body: { password: this.password } }
      this.res = { json: sinon.stub() }
      return (this.next = sinon.stub())
    })

    describe('when all goes well', function() {
      beforeEach(function() {})

      it('should get the logged in user id', function() {
        this.SudoModeController.submitPassword(this.req, this.res, this.next)
        this.AuthenticationController.getLoggedInUserId.callCount.should.equal(
          1
        )
        return this.AuthenticationController.getLoggedInUserId
          .calledWith(this.req)
          .should.equal(true)
      })

      it('should get redirect from session', function() {
        this.SudoModeController.submitPassword(this.req, this.res, this.next)
        this.AuthenticationController._getRedirectFromSession.callCount.should.equal(
          1
        )
        return this.AuthenticationController._getRedirectFromSession
          .calledWith(this.req)
          .should.equal(true)
      })

      it('should get the user from storage', function() {
        this.SudoModeController.submitPassword(this.req, this.res, this.next)
        this.UserGetter.getUser.callCount.should.equal(1)
        return this.UserGetter.getUser
          .calledWith('some_object_id', { email: 1 })
          .should.equal(true)
      })

      it('should try to authenticate the user with the password', function() {
        this.SudoModeController.submitPassword(this.req, this.res, this.next)
        this.SudoModeHandler.authenticate.callCount.should.equal(1)
        return this.SudoModeHandler.authenticate
          .calledWith(this.user.email, this.password)
          .should.equal(true)
      })

      it('should activate sudo mode', function() {
        this.SudoModeController.submitPassword(this.req, this.res, this.next)
        this.SudoModeHandler.activateSudoMode.callCount.should.equal(1)
        return this.SudoModeHandler.activateSudoMode
          .calledWith(this.user._id)
          .should.equal(true)
      })

      it('should send back a json response', function() {
        this.SudoModeController.submitPassword(this.req, this.res, this.next)
        this.res.json.callCount.should.equal(1)
        return this.res.json
          .calledWith({ redir: '/somewhere' })
          .should.equal(true)
      })

      it('should not call next', function() {
        this.SudoModeController.submitPassword(this.req, this.res, this.next)
        return this.next.callCount.should.equal(0)
      })

      describe('when no password is supplied', function() {
        beforeEach(function() {
          this.req.body.password = ''
          return (this.next = sinon.stub())
        })

        it('should return next with an error', function() {
          this.SudoModeController.submitPassword(this.req, this.res, this.next)
          this.next.callCount.should.equal(1)
          return expect(this.next.lastCall.args[0]).to.be.instanceof(Error)
        })

        it('should not get the user from storage', function() {
          this.SudoModeController.submitPassword(this.req, this.res, this.next)
          return this.UserGetter.getUser.callCount.should.equal(0)
        })

        it('should not try to authenticate the user with the password', function() {
          this.SudoModeController.submitPassword(this.req, this.res, this.next)
          return this.SudoModeHandler.authenticate.callCount.should.equal(0)
        })

        it('should not activate sudo mode', function() {
          this.SudoModeController.submitPassword(this.req, this.res, this.next)
          return this.SudoModeHandler.activateSudoMode.callCount.should.equal(0)
        })

        it('should not send back a json response', function() {
          this.SudoModeController.submitPassword(this.req, this.res, this.next)
          return this.res.json.callCount.should.equal(0)
        })
      })

      describe('when getUser produces an error', function() {
        beforeEach(function() {
          this.UserGetter.getUser = sinon
            .stub()
            .callsArgWith(2, new Error('woops'))
          return (this.next = sinon.stub())
        })

        it('should return next with an error', function() {
          this.SudoModeController.submitPassword(this.req, this.res, this.next)
          this.next.callCount.should.equal(1)
          return expect(this.next.lastCall.args[0]).to.be.instanceof(Error)
        })

        it('should get the user from storage', function() {
          this.SudoModeController.submitPassword(this.req, this.res, this.next)
          this.UserGetter.getUser.callCount.should.equal(1)
          return this.UserGetter.getUser
            .calledWith('some_object_id', { email: 1 })
            .should.equal(true)
        })

        it('should not try to authenticate the user with the password', function() {
          this.SudoModeController.submitPassword(this.req, this.res, this.next)
          return this.SudoModeHandler.authenticate.callCount.should.equal(0)
        })

        it('should not activate sudo mode', function() {
          this.SudoModeController.submitPassword(this.req, this.res, this.next)
          return this.SudoModeHandler.activateSudoMode.callCount.should.equal(0)
        })

        it('should not send back a json response', function() {
          this.SudoModeController.submitPassword(this.req, this.res, this.next)
          return this.res.json.callCount.should.equal(0)
        })
      })

      describe('when getUser does not find a user', function() {
        beforeEach(function() {
          this.UserGetter.getUser = sinon.stub().callsArgWith(2, null, null)
          return (this.next = sinon.stub())
        })

        it('should return next with an error', function() {
          this.SudoModeController.submitPassword(this.req, this.res, this.next)
          this.next.callCount.should.equal(1)
          return expect(this.next.lastCall.args[0]).to.be.instanceof(Error)
        })

        it('should get the user from storage', function() {
          this.SudoModeController.submitPassword(this.req, this.res, this.next)
          this.UserGetter.getUser.callCount.should.equal(1)
          return this.UserGetter.getUser
            .calledWith('some_object_id', { email: 1 })
            .should.equal(true)
        })

        it('should not try to authenticate the user with the password', function() {
          this.SudoModeController.submitPassword(this.req, this.res, this.next)
          return this.SudoModeHandler.authenticate.callCount.should.equal(0)
        })

        it('should not activate sudo mode', function() {
          this.SudoModeController.submitPassword(this.req, this.res, this.next)
          return this.SudoModeHandler.activateSudoMode.callCount.should.equal(0)
        })

        it('should not send back a json response', function() {
          this.SudoModeController.submitPassword(this.req, this.res, this.next)
          return this.res.json.callCount.should.equal(0)
        })
      })

      describe('when authentication fails', function() {
        beforeEach(function() {
          this.SudoModeHandler.authenticate = sinon
            .stub()
            .callsArgWith(2, null, null)
          this.res.json = sinon.stub()
          return (this.req.i18n = { translate: sinon.stub() })
        })

        it('should send back a failure message', function() {
          this.SudoModeController.submitPassword(this.req, this.res, this.next)
          this.res.json.callCount.should.equal(1)
          expect(this.res.json.lastCall.args[0]).to.have.keys(['message'])
          expect(this.res.json.lastCall.args[0].message).to.have.keys([
            'text',
            'type'
          ])
          this.req.i18n.translate.callCount.should.equal(1)
          return this.req.i18n.translate.calledWith('invalid_password')
        })

        it('should get the user from storage', function() {
          this.SudoModeController.submitPassword(this.req, this.res, this.next)
          this.UserGetter.getUser.callCount.should.equal(1)
          return this.UserGetter.getUser
            .calledWith('some_object_id', { email: 1 })
            .should.equal(true)
        })

        it('should try to authenticate the user with the password', function() {
          this.SudoModeController.submitPassword(this.req, this.res, this.next)
          this.SudoModeHandler.authenticate.callCount.should.equal(1)
          return this.SudoModeHandler.authenticate
            .calledWith(this.user.email, this.password)
            .should.equal(true)
        })

        it('should not activate sudo mode', function() {
          this.SudoModeController.submitPassword(this.req, this.res, this.next)
          return this.SudoModeHandler.activateSudoMode.callCount.should.equal(0)
        })
      })

      describe('when authentication produces an error', function() {
        beforeEach(function() {
          this.SudoModeHandler.authenticate = sinon
            .stub()
            .callsArgWith(2, new Error('woops'))
          return (this.next = sinon.stub())
        })

        it('should return next with an error', function() {
          this.SudoModeController.submitPassword(this.req, this.res, this.next)
          this.next.callCount.should.equal(1)
          return expect(this.next.lastCall.args[0]).to.be.instanceof(Error)
        })

        it('should get the user from storage', function() {
          this.SudoModeController.submitPassword(this.req, this.res, this.next)
          this.UserGetter.getUser.callCount.should.equal(1)
          return this.UserGetter.getUser
            .calledWith('some_object_id', { email: 1 })
            .should.equal(true)
        })

        it('should try to authenticate the user with the password', function() {
          this.SudoModeController.submitPassword(this.req, this.res, this.next)
          this.SudoModeHandler.authenticate.callCount.should.equal(1)
          return this.SudoModeHandler.authenticate
            .calledWith(this.user.email, this.password)
            .should.equal(true)
        })

        it('should not activate sudo mode', function() {
          this.SudoModeController.submitPassword(this.req, this.res, this.next)
          return this.SudoModeHandler.activateSudoMode.callCount.should.equal(0)
        })
      })

      describe('when sudo mode activation produces an error', function() {
        beforeEach(function() {
          this.SudoModeHandler.activateSudoMode = sinon
            .stub()
            .callsArgWith(1, new Error('woops'))
          return (this.next = sinon.stub())
        })

        it('should return next with an error', function() {
          this.SudoModeController.submitPassword(this.req, this.res, this.next)
          this.next.callCount.should.equal(1)
          return expect(this.next.lastCall.args[0]).to.be.instanceof(Error)
        })

        it('should get the user from storage', function() {
          this.SudoModeController.submitPassword(this.req, this.res, this.next)
          this.UserGetter.getUser.callCount.should.equal(1)
          return this.UserGetter.getUser
            .calledWith('some_object_id', { email: 1 })
            .should.equal(true)
        })

        it('should try to authenticate the user with the password', function() {
          this.SudoModeController.submitPassword(this.req, this.res, this.next)
          this.SudoModeHandler.authenticate.callCount.should.equal(1)
          return this.SudoModeHandler.authenticate
            .calledWith(this.user.email, this.password)
            .should.equal(true)
        })

        it('should have tried to activate sudo mode', function() {
          this.SudoModeController.submitPassword(this.req, this.res, this.next)
          this.SudoModeHandler.activateSudoMode.callCount.should.equal(1)
          return this.SudoModeHandler.activateSudoMode
            .calledWith(this.user._id)
            .should.equal(true)
        })
      })
    })
  })
})
