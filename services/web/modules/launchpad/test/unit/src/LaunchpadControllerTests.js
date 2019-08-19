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
const { ObjectId } = require('mongojs')
const modulePath = require('path').join(
  __dirname,
  '../../../app/src/LaunchpadController.js'
)

describe('LaunchpadController', function() {
  beforeEach(function() {
    this.user = {
      _id: '323123',
      first_name: 'fn',
      last_name: 'ln',
      save: sinon.stub().callsArgWith(0)
    }

    this.User = {}
    this.LaunchpadController = SandboxedModule.require(modulePath, {
      globals: {
        console: console
      },
      requires: {
        'settings-sharelatex': (this.Settings = {}),
        'logger-sharelatex': (this.Logger = {
          log() {},
          warn() {},
          err() {},
          error() {}
        }),
        'metrics-sharelatex': (this.Metrics = {}),
        '../../../../app/src/Features/User/UserRegistrationHandler': (this.UserRegistrationHandler = {}),
        '../../../../app/src/Features/Email/EmailHandler': (this.EmailHandler = {}),
        '../../../../app/src/Features/User/UserGetter': (this.UserGetter = {}),
        '../../../../app/src/models/User': { User: this.User },
        '../../../../app/src/Features/Authentication/AuthenticationController': (this.AuthenticationController = {}),
        '../../../overleaf-integration/app/src/SharelatexAuth/SharelatexAuthController': (this.SharelatexAuthController = {})
      }
    })

    this.email = 'bob@smith.com'

    this.req = {
      query: {},
      body: {},
      session: {}
    }

    this.res = {
      render: sinon.stub(),
      send: sinon.stub(),
      sendStatus: sinon.stub()
    }

    return (this.next = sinon.stub())
  })

  describe('launchpadPage', function() {
    beforeEach(function() {
      this._atLeastOneAdminExists = sinon.stub(
        this.LaunchpadController,
        '_atLeastOneAdminExists'
      )
      return (this.AuthenticationController._redirectToLoginPage = sinon.stub())
    })

    afterEach(function() {
      return this._atLeastOneAdminExists.restore()
    })

    describe('when the user is not logged in', function() {
      beforeEach(function() {
        this.AuthenticationController.getSessionUser = sinon
          .stub()
          .returns(null)
        return (this.res.render = sinon.stub())
      })

      describe('when there are no admins', function() {
        beforeEach(function() {
          this._atLeastOneAdminExists.callsArgWith(0, null, false)
          return this.LaunchpadController.launchpadPage(
            this.req,
            this.res,
            this.next
          )
        })

        it('should render the launchpad page', function() {
          const viewPath = require('path').join(
            __dirname,
            '../../../app/views/launchpad'
          )
          this.res.render.callCount.should.equal(1)
          return this.res.render
            .calledWith(viewPath, {
              adminUserExists: false,
              authMethod: 'local'
            })
            .should.equal(true)
        })
      })

      describe('when there is at least one admin', function() {
        beforeEach(function() {
          this._atLeastOneAdminExists.callsArgWith(0, null, true)
          return this.LaunchpadController.launchpadPage(
            this.req,
            this.res,
            this.next
          )
        })

        it('should redirect to login page', function() {
          return this.AuthenticationController._redirectToLoginPage.callCount.should.equal(
            1
          )
        })

        it('should not render the launchpad page', function() {
          return this.res.render.callCount.should.equal(0)
        })
      })
    })

    describe('when the user is logged in', function() {
      beforeEach(function() {
        this.user = {
          _id: 'abcd',
          email: 'abcd@example.com'
        }
        this.AuthenticationController.getSessionUser = sinon
          .stub()
          .returns(this.user)
        this._atLeastOneAdminExists.callsArgWith(0, null, true)
        this.res.render = sinon.stub()
        return (this.res.redirect = sinon.stub())
      })

      describe('when the user is an admin', function() {
        beforeEach(function() {
          this.UserGetter.getUser = sinon
            .stub()
            .callsArgWith(2, null, { isAdmin: true })
          return this.LaunchpadController.launchpadPage(
            this.req,
            this.res,
            this.next
          )
        })

        it('should render the launchpad page', function() {
          const viewPath = require('path').join(
            __dirname,
            '../../../app/views/launchpad'
          )
          this.res.render.callCount.should.equal(1)
          return this.res.render
            .calledWith(viewPath, {
              adminUserExists: true,
              authMethod: 'local'
            })
            .should.equal(true)
        })
      })

      describe('when the user is not an admin', function() {
        beforeEach(function() {
          this.UserGetter.getUser = sinon
            .stub()
            .callsArgWith(2, null, { isAdmin: false })
          return this.LaunchpadController.launchpadPage(
            this.req,
            this.res,
            this.next
          )
        })

        it('should redirect to restricted page', function() {
          this.res.redirect.callCount.should.equal(1)
          return this.res.redirect.calledWith('/restricted').should.equal(true)
        })
      })
    })
  })

  describe('_atLeastOneAdminExists', function() {
    describe('when there are no admins', function() {
      beforeEach(function() {
        return (this.UserGetter.getUser = sinon
          .stub()
          .callsArgWith(2, null, null))
      })

      it('should callback with false', function(done) {
        return this.LaunchpadController._atLeastOneAdminExists(
          (err, exists) => {
            expect(err).to.equal(null)
            expect(exists).to.equal(false)
            return done()
          }
        )
      })
    })

    describe('when there are some admins', function() {
      beforeEach(function() {
        return (this.UserGetter.getUser = sinon
          .stub()
          .callsArgWith(2, null, { _id: 'abcd' }))
      })

      it('should callback with true', function(done) {
        return this.LaunchpadController._atLeastOneAdminExists(
          (err, exists) => {
            expect(err).to.equal(null)
            expect(exists).to.equal(true)
            return done()
          }
        )
      })
    })

    describe('when getUser produces an error', function() {
      beforeEach(function() {
        return (this.UserGetter.getUser = sinon
          .stub()
          .callsArgWith(2, new Error('woops')))
      })

      it('should produce an error', function(done) {
        return this.LaunchpadController._atLeastOneAdminExists(
          (err, exists) => {
            expect(err).to.not.equal(null)
            expect(err).to.be.instanceof(Error)
            expect(exists).to.equal(undefined)
            return done()
          }
        )
      })
    })
  })

  describe('sendTestEmail', function() {
    beforeEach(function() {
      this.EmailHandler.sendEmail = sinon.stub().callsArgWith(2, null)
      this.req.body.email = 'someone@example.com'
      this.res.sendStatus = sinon.stub()
      return (this.next = sinon.stub())
    })

    it('should produce a 201 response', function() {
      this.LaunchpadController.sendTestEmail(this.req, this.res, this.next)
      this.res.sendStatus.callCount.should.equal(1)
      return this.res.sendStatus.calledWith(201).should.equal(true)
    })

    it('should not call next with an error', function() {
      this.LaunchpadController.sendTestEmail(this.req, this.res, this.next)
      return this.next.callCount.should.equal(0)
    })

    it('should have called sendEmail', function() {
      this.LaunchpadController.sendTestEmail(this.req, this.res, this.next)
      this.EmailHandler.sendEmail.callCount.should.equal(1)
      return this.EmailHandler.sendEmail
        .calledWith('testEmail')
        .should.equal(true)
    })

    describe('when sendEmail produces an error', function() {
      beforeEach(function() {
        return (this.EmailHandler.sendEmail = sinon
          .stub()
          .callsArgWith(2, new Error('woops')))
      })

      it('should call next with an error', function() {
        this.LaunchpadController.sendTestEmail(this.req, this.res, this.next)
        this.next.callCount.should.equal(1)
        return expect(this.next.lastCall.args[0]).to.be.instanceof(Error)
      })
    })

    describe('when no email address is supplied', function() {
      beforeEach(function() {
        return (this.req.body.email = undefined)
      })

      it('should produce a 400 response', function() {
        this.LaunchpadController.sendTestEmail(this.req, this.res, this.next)
        this.res.sendStatus.callCount.should.equal(1)
        return this.res.sendStatus.calledWith(400).should.equal(true)
      })
    })
  })

  describe('registerAdmin', function() {
    beforeEach(function() {
      return (this._atLeastOneAdminExists = sinon.stub(
        this.LaunchpadController,
        '_atLeastOneAdminExists'
      ))
    })

    afterEach(function() {
      return this._atLeastOneAdminExists.restore()
    })

    describe('when all goes well', function() {
      beforeEach(function() {
        this._atLeastOneAdminExists.callsArgWith(0, null, false)
        this.email = 'someone@example.com'
        this.password = 'a_really_bad_password'
        this.req.body.email = this.email
        this.req.body.password = this.password
        this.user = {
          _id: 'abcdef',
          email: this.email
        }
        this.UserRegistrationHandler.registerNewUser = sinon
          .stub()
          .callsArgWith(1, null, this.user)
        this.User.update = sinon.stub().callsArgWith(2, null)
        this.AuthenticationController.setRedirectInSession = sinon.stub()
        this.res.json = sinon.stub()
        this.next = sinon.stub()
        return this.LaunchpadController.registerAdmin(
          this.req,
          this.res,
          this.next
        )
      })

      it('should send back a json response', function() {
        this.res.json.callCount.should.equal(1)
        return expect(this.res.json.lastCall.args[0].email).to.equal(this.email)
      })

      it('should have checked for existing admins', function() {
        return this._atLeastOneAdminExists.callCount.should.equal(1)
      })

      it('should have called registerNewUser', function() {
        this.UserRegistrationHandler.registerNewUser.callCount.should.equal(1)
        return this.UserRegistrationHandler.registerNewUser
          .calledWith({ email: this.email, password: this.password })
          .should.equal(true)
      })

      it('should have updated the user to make them an admin', function() {
        this.User.update.callCount.should.equal(1)
        return this.User.update
          .calledWithMatch(
            { _id: this.user._id },
            {
              $set: {
                isAdmin: true,
                emails: [{ email: this.user.email }]
              }
            }
          )
          .should.equal(true)
      })

      it('should have set a redirect in session', function() {
        this.AuthenticationController.setRedirectInSession.callCount.should.equal(
          1
        )
        return this.AuthenticationController.setRedirectInSession
          .calledWith(this.req, '/launchpad')
          .should.equal(true)
      })
    })

    describe('when no email is supplied', function() {
      beforeEach(function() {
        this._atLeastOneAdminExists.callsArgWith(0, null, false)
        this.email = undefined
        this.password = 'a_really_bad_password'
        this.req.body.email = this.email
        this.req.body.password = this.password
        this.user = {
          _id: 'abcdef',
          email: this.email
        }
        this.UserRegistrationHandler.registerNewUser = sinon.stub()
        this.User.update = sinon.stub()
        this.AuthenticationController.setRedirectInSession = sinon.stub()
        this.res.sendStatus = sinon.stub()
        this.next = sinon.stub()
        return this.LaunchpadController.registerAdmin(
          this.req,
          this.res,
          this.next
        )
      })

      it('should send a 400 response', function() {
        this.res.sendStatus.callCount.should.equal(1)
        return this.res.sendStatus.calledWith(400).should.equal(true)
      })

      it('should not check for existing admins', function() {
        return this._atLeastOneAdminExists.callCount.should.equal(0)
      })

      it('should not call registerNewUser', function() {
        return this.UserRegistrationHandler.registerNewUser.callCount.should.equal(
          0
        )
      })
    })

    describe('when no password is supplied', function() {
      beforeEach(function() {
        this._atLeastOneAdminExists.callsArgWith(0, null, false)
        this.email = 'someone@example.com'
        this.password = undefined
        this.req.body.email = this.email
        this.req.body.password = this.password
        this.user = {
          _id: 'abcdef',
          email: this.email
        }
        this.UserRegistrationHandler.registerNewUser = sinon.stub()
        this.User.update = sinon.stub()
        this.AuthenticationController.setRedirectInSession = sinon.stub()
        this.res.sendStatus = sinon.stub()
        this.next = sinon.stub()
        return this.LaunchpadController.registerAdmin(
          this.req,
          this.res,
          this.next
        )
      })

      it('should send a 400 response', function() {
        this.res.sendStatus.callCount.should.equal(1)
        return this.res.sendStatus.calledWith(400).should.equal(true)
      })

      it('should not check for existing admins', function() {
        return this._atLeastOneAdminExists.callCount.should.equal(0)
      })

      it('should not call registerNewUser', function() {
        return this.UserRegistrationHandler.registerNewUser.callCount.should.equal(
          0
        )
      })
    })

    describe('when there are already existing admins', function() {
      beforeEach(function() {
        this._atLeastOneAdminExists.callsArgWith(0, null, true)
        this.email = 'someone@example.com'
        this.password = 'a_really_bad_password'
        this.req.body.email = this.email
        this.req.body.password = this.password
        this.user = {
          _id: 'abcdef',
          email: this.email
        }
        this.UserRegistrationHandler.registerNewUser = sinon.stub()
        this.User.update = sinon.stub()
        this.AuthenticationController.setRedirectInSession = sinon.stub()
        this.res.sendStatus = sinon.stub()
        this.next = sinon.stub()
        return this.LaunchpadController.registerAdmin(
          this.req,
          this.res,
          this.next
        )
      })

      it('should send a 403 response', function() {
        this.res.sendStatus.callCount.should.equal(1)
        return this.res.sendStatus.calledWith(403).should.equal(true)
      })

      it('should not call registerNewUser', function() {
        return this.UserRegistrationHandler.registerNewUser.callCount.should.equal(
          0
        )
      })
    })

    describe('when checking admins produces an error', function() {
      beforeEach(function() {
        this._atLeastOneAdminExists.callsArgWith(0, new Error('woops'))
        this.email = 'someone@example.com'
        this.password = 'a_really_bad_password'
        this.req.body.email = this.email
        this.req.body.password = this.password
        this.user = {
          _id: 'abcdef',
          email: this.email
        }
        this.UserRegistrationHandler.registerNewUser = sinon.stub()
        this.User.update = sinon.stub()
        this.AuthenticationController.setRedirectInSession = sinon.stub()
        this.res.sendStatus = sinon.stub()
        this.next = sinon.stub()
        return this.LaunchpadController.registerAdmin(
          this.req,
          this.res,
          this.next
        )
      })

      it('should call next with an error', function() {
        this.next.callCount.should.equal(1)
        return expect(this.next.lastCall.args[0]).to.be.instanceof(Error)
      })

      it('should have checked for existing admins', function() {
        return this._atLeastOneAdminExists.callCount.should.equal(1)
      })

      it('should not call registerNewUser', function() {
        return this.UserRegistrationHandler.registerNewUser.callCount.should.equal(
          0
        )
      })
    })

    describe('when registerNewUser produces an error', function() {
      beforeEach(function() {
        this._atLeastOneAdminExists.callsArgWith(0, null, false)
        this.email = 'someone@example.com'
        this.password = 'a_really_bad_password'
        this.req.body.email = this.email
        this.req.body.password = this.password
        this.user = {
          _id: 'abcdef',
          email: this.email
        }
        this.UserRegistrationHandler.registerNewUser = sinon
          .stub()
          .callsArgWith(1, new Error('woops'))
        this.User.update = sinon.stub()
        this.AuthenticationController.setRedirectInSession = sinon.stub()
        this.res.json = sinon.stub()
        this.next = sinon.stub()
        return this.LaunchpadController.registerAdmin(
          this.req,
          this.res,
          this.next
        )
      })

      it('should call next with an error', function() {
        this.next.callCount.should.equal(1)
        return expect(this.next.lastCall.args[0]).to.be.instanceof(Error)
      })

      it('should have checked for existing admins', function() {
        return this._atLeastOneAdminExists.callCount.should.equal(1)
      })

      it('should have called registerNewUser', function() {
        this.UserRegistrationHandler.registerNewUser.callCount.should.equal(1)
        return this.UserRegistrationHandler.registerNewUser
          .calledWith({ email: this.email, password: this.password })
          .should.equal(true)
      })

      it('should not call update', function() {
        return this.User.update.callCount.should.equal(0)
      })
    })

    describe('when user update produces an error', function() {
      beforeEach(function() {
        this._atLeastOneAdminExists.callsArgWith(0, null, false)
        this.email = 'someone@example.com'
        this.password = 'a_really_bad_password'
        this.req.body.email = this.email
        this.req.body.password = this.password
        this.user = {
          _id: 'abcdef',
          email: this.email
        }
        this.UserRegistrationHandler.registerNewUser = sinon
          .stub()
          .callsArgWith(1, null, this.user)
        this.User.update = sinon.stub().callsArgWith(2, new Error('woops'))
        this.AuthenticationController.setRedirectInSession = sinon.stub()
        this.res.json = sinon.stub()
        this.next = sinon.stub()
        return this.LaunchpadController.registerAdmin(
          this.req,
          this.res,
          this.next
        )
      })

      it('should call next with an error', function() {
        this.next.callCount.should.equal(1)
        return expect(this.next.lastCall.args[0]).to.be.instanceof(Error)
      })

      it('should have checked for existing admins', function() {
        return this._atLeastOneAdminExists.callCount.should.equal(1)
      })

      it('should have called registerNewUser', function() {
        this.UserRegistrationHandler.registerNewUser.callCount.should.equal(1)
        return this.UserRegistrationHandler.registerNewUser
          .calledWith({ email: this.email, password: this.password })
          .should.equal(true)
      })
    })

    describe('when overleaf', function() {
      beforeEach(function() {
        this.Settings.overleaf = { one: 1 }
        this.Settings.createV1AccountOnLogin = true
        this._atLeastOneAdminExists.callsArgWith(0, null, false)
        this.email = 'someone@example.com'
        this.password = 'a_really_bad_password'
        this.req.body.email = this.email
        this.req.body.password = this.password
        this.user = {
          _id: 'abcdef',
          email: this.email
        }
        this.UserRegistrationHandler.registerNewUser = sinon
          .stub()
          .callsArgWith(1, null, this.user)
        this.User.update = sinon.stub().callsArgWith(2, null)
        this.AuthenticationController.setRedirectInSession = sinon.stub()
        this.SharelatexAuthController._createBackingAccountIfNeeded = sinon
          .stub()
          .callsArgWith(2, null)
        this.UserGetter.getUser = sinon
          .stub()
          .callsArgWith(1, null, { _id: '1234' })
        this.res.json = sinon.stub()
        this.next = sinon.stub()
        return this.LaunchpadController.registerAdmin(
          this.req,
          this.res,
          this.next
        )
      })

      it('should send back a json response', function() {
        this.res.json.callCount.should.equal(1)
        return expect(this.res.json.lastCall.args[0].email).to.equal(this.email)
      })

      it('should have checked for existing admins', function() {
        return this._atLeastOneAdminExists.callCount.should.equal(1)
      })

      it('should have called registerNewUser', function() {
        this.UserRegistrationHandler.registerNewUser.callCount.should.equal(1)
        return this.UserRegistrationHandler.registerNewUser
          .calledWith({ email: this.email, password: this.password })
          .should.equal(true)
      })

      it('should have created a backing account for the user', function() {
        return this.SharelatexAuthController._createBackingAccountIfNeeded.callCount.should.equal(
          1
        )
      })

      it('should have updated the user to make them an admin', function() {
        return this.User.update
          .calledWith(
            { _id: this.user._id },
            {
              $set: {
                isAdmin: true,
                emails: [{ email: this.user.email }]
              }
            }
          )
          .should.equal(true)
      })

      it('should have set a redirect in session', function() {
        this.AuthenticationController.setRedirectInSession.callCount.should.equal(
          1
        )
        return this.AuthenticationController.setRedirectInSession
          .calledWith(this.req, '/launchpad')
          .should.equal(true)
      })
    })
  })

  describe('registerExternalAuthAdmin', function() {
    beforeEach(function() {
      this.Settings.ldap = { one: 1 }
      return (this._atLeastOneAdminExists = sinon.stub(
        this.LaunchpadController,
        '_atLeastOneAdminExists'
      ))
    })

    afterEach(function() {
      return this._atLeastOneAdminExists.restore()
    })

    describe('when all goes well', function() {
      beforeEach(function() {
        this._atLeastOneAdminExists.callsArgWith(0, null, false)
        this.email = 'someone@example.com'
        this.req.body.email = this.email
        this.user = {
          _id: 'abcdef',
          email: this.email
        }
        this.UserRegistrationHandler.registerNewUser = sinon
          .stub()
          .callsArgWith(1, null, this.user)
        this.User.update = sinon.stub().callsArgWith(2, null)
        this.AuthenticationController.setRedirectInSession = sinon.stub()
        this.res.json = sinon.stub()
        this.next = sinon.stub()
        return this.LaunchpadController.registerExternalAuthAdmin('ldap')(
          this.req,
          this.res,
          this.next
        )
      })

      it('should send back a json response', function() {
        this.res.json.callCount.should.equal(1)
        return expect(this.res.json.lastCall.args[0].email).to.equal(this.email)
      })

      it('should have checked for existing admins', function() {
        return this._atLeastOneAdminExists.callCount.should.equal(1)
      })

      it('should have called registerNewUser', function() {
        this.UserRegistrationHandler.registerNewUser.callCount.should.equal(1)
        return this.UserRegistrationHandler.registerNewUser
          .calledWith({
            email: this.email,
            password: 'password_here',
            first_name: this.email,
            last_name: ''
          })
          .should.equal(true)
      })

      it('should have updated the user to make them an admin', function() {
        this.User.update.callCount.should.equal(1)
        return this.User.update
          .calledWith(
            { _id: this.user._id },
            {
              $set: { isAdmin: true },
              emails: [{ email: this.user.email }]
            }
          )
          .should.equal(true)
      })

      it('should have set a redirect in session', function() {
        this.AuthenticationController.setRedirectInSession.callCount.should.equal(
          1
        )
        return this.AuthenticationController.setRedirectInSession
          .calledWith(this.req, '/launchpad')
          .should.equal(true)
      })
    })

    describe('when the authMethod is invalid', function() {
      beforeEach(function() {
        this._atLeastOneAdminExists.callsArgWith(0, null, false)
        this.email = undefined
        this.req.body.email = this.email
        this.user = {
          _id: 'abcdef',
          email: this.email
        }
        this.UserRegistrationHandler.registerNewUser = sinon.stub()
        this.User.update = sinon.stub()
        this.AuthenticationController.setRedirectInSession = sinon.stub()
        this.res.sendStatus = sinon.stub()
        this.next = sinon.stub()
        return this.LaunchpadController.registerExternalAuthAdmin(
          'NOTAVALIDAUTHMETHOD'
        )(this.req, this.res, this.next)
      })

      it('should send a 403 response', function() {
        this.res.sendStatus.callCount.should.equal(1)
        return this.res.sendStatus.calledWith(403).should.equal(true)
      })

      it('should not check for existing admins', function() {
        return this._atLeastOneAdminExists.callCount.should.equal(0)
      })

      it('should not call registerNewUser', function() {
        return this.UserRegistrationHandler.registerNewUser.callCount.should.equal(
          0
        )
      })
    })

    describe('when no email is supplied', function() {
      beforeEach(function() {
        this._atLeastOneAdminExists.callsArgWith(0, null, false)
        this.email = undefined
        this.req.body.email = this.email
        this.user = {
          _id: 'abcdef',
          email: this.email
        }
        this.UserRegistrationHandler.registerNewUser = sinon.stub()
        this.User.update = sinon.stub()
        this.AuthenticationController.setRedirectInSession = sinon.stub()
        this.res.sendStatus = sinon.stub()
        this.next = sinon.stub()
        return this.LaunchpadController.registerExternalAuthAdmin('ldap')(
          this.req,
          this.res,
          this.next
        )
      })

      it('should send a 400 response', function() {
        this.res.sendStatus.callCount.should.equal(1)
        return this.res.sendStatus.calledWith(400).should.equal(true)
      })

      it('should not check for existing admins', function() {
        return this._atLeastOneAdminExists.callCount.should.equal(0)
      })

      it('should not call registerNewUser', function() {
        return this.UserRegistrationHandler.registerNewUser.callCount.should.equal(
          0
        )
      })
    })

    describe('when there are already existing admins', function() {
      beforeEach(function() {
        this._atLeastOneAdminExists.callsArgWith(0, null, true)
        this.email = 'someone@example.com'
        this.req.body.email = this.email
        this.user = {
          _id: 'abcdef',
          email: this.email
        }
        this.UserRegistrationHandler.registerNewUser = sinon.stub()
        this.User.update = sinon.stub()
        this.AuthenticationController.setRedirectInSession = sinon.stub()
        this.res.sendStatus = sinon.stub()
        this.next = sinon.stub()
        return this.LaunchpadController.registerExternalAuthAdmin('ldap')(
          this.req,
          this.res,
          this.next
        )
      })

      it('should send a 403 response', function() {
        this.res.sendStatus.callCount.should.equal(1)
        return this.res.sendStatus.calledWith(403).should.equal(true)
      })

      it('should not call registerNewUser', function() {
        return this.UserRegistrationHandler.registerNewUser.callCount.should.equal(
          0
        )
      })
    })

    describe('when checking admins produces an error', function() {
      beforeEach(function() {
        this._atLeastOneAdminExists.callsArgWith(0, new Error('woops'))
        this.email = 'someone@example.com'
        this.req.body.email = this.email
        this.user = {
          _id: 'abcdef',
          email: this.email
        }
        this.UserRegistrationHandler.registerNewUser = sinon.stub()
        this.User.update = sinon.stub()
        this.AuthenticationController.setRedirectInSession = sinon.stub()
        this.res.sendStatus = sinon.stub()
        this.next = sinon.stub()
        return this.LaunchpadController.registerExternalAuthAdmin('ldap')(
          this.req,
          this.res,
          this.next
        )
      })

      it('should call next with an error', function() {
        this.next.callCount.should.equal(1)
        return expect(this.next.lastCall.args[0]).to.be.instanceof(Error)
      })

      it('should have checked for existing admins', function() {
        return this._atLeastOneAdminExists.callCount.should.equal(1)
      })

      it('should not call registerNewUser', function() {
        return this.UserRegistrationHandler.registerNewUser.callCount.should.equal(
          0
        )
      })
    })

    describe('when registerNewUser produces an error', function() {
      beforeEach(function() {
        this._atLeastOneAdminExists.callsArgWith(0, null, false)
        this.email = 'someone@example.com'
        this.req.body.email = this.email
        this.user = {
          _id: 'abcdef',
          email: this.email
        }
        this.UserRegistrationHandler.registerNewUser = sinon
          .stub()
          .callsArgWith(1, new Error('woops'))
        this.User.update = sinon.stub()
        this.AuthenticationController.setRedirectInSession = sinon.stub()
        this.res.json = sinon.stub()
        this.next = sinon.stub()
        return this.LaunchpadController.registerExternalAuthAdmin('ldap')(
          this.req,
          this.res,
          this.next
        )
      })

      it('should call next with an error', function() {
        this.next.callCount.should.equal(1)
        return expect(this.next.lastCall.args[0]).to.be.instanceof(Error)
      })

      it('should have checked for existing admins', function() {
        return this._atLeastOneAdminExists.callCount.should.equal(1)
      })

      it('should have called registerNewUser', function() {
        this.UserRegistrationHandler.registerNewUser.callCount.should.equal(1)
        return this.UserRegistrationHandler.registerNewUser
          .calledWith({
            email: this.email,
            password: 'password_here',
            first_name: this.email,
            last_name: ''
          })
          .should.equal(true)
      })

      it('should not call update', function() {
        return this.User.update.callCount.should.equal(0)
      })
    })

    describe('when user update produces an error', function() {
      beforeEach(function() {
        this._atLeastOneAdminExists.callsArgWith(0, null, false)
        this.email = 'someone@example.com'
        this.req.body.email = this.email
        this.user = {
          _id: 'abcdef',
          email: this.email
        }
        this.UserRegistrationHandler.registerNewUser = sinon
          .stub()
          .callsArgWith(1, null, this.user)
        this.User.update = sinon.stub().callsArgWith(2, new Error('woops'))
        this.AuthenticationController.setRedirectInSession = sinon.stub()
        this.res.json = sinon.stub()
        this.next = sinon.stub()
        return this.LaunchpadController.registerExternalAuthAdmin('ldap')(
          this.req,
          this.res,
          this.next
        )
      })

      it('should call next with an error', function() {
        this.next.callCount.should.equal(1)
        return expect(this.next.lastCall.args[0]).to.be.instanceof(Error)
      })

      it('should have checked for existing admins', function() {
        return this._atLeastOneAdminExists.callCount.should.equal(1)
      })

      it('should have called registerNewUser', function() {
        this.UserRegistrationHandler.registerNewUser.callCount.should.equal(1)
        return this.UserRegistrationHandler.registerNewUser
          .calledWith({
            email: this.email,
            password: 'password_here',
            first_name: this.email,
            last_name: ''
          })
          .should.equal(true)
      })
    })
  })
})
