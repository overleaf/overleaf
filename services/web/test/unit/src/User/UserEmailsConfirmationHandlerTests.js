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
const should = require('chai').should()
const SandboxedModule = require('sandboxed-module')
const assert = require('assert')
const path = require('path')
const sinon = require('sinon')
const modulePath = path.join(
  __dirname,
  '../../../../app/src/Features/User/UserEmailsConfirmationHandler'
)
const { expect } = require('chai')
const Errors = require('../../../../app/src/Features/Errors/Errors')
const EmailHelper = require('../../../../app/src/Features/Helpers/EmailHelper')

describe('UserEmailsConfirmationHandler', function() {
  beforeEach(function() {
    this.UserEmailsConfirmationHandler = SandboxedModule.require(modulePath, {
      globals: {
        console: console
      },
      requires: {
        'settings-sharelatex': (this.settings = {
          siteUrl: 'emails.example.com'
        }),
        'logger-sharelatex': (this.logger = { log: sinon.stub() }),
        '../Security/OneTimeTokenHandler': (this.OneTimeTokenHandler = {}),
        '../Errors/Errors': Errors,
        './UserUpdater': (this.UserUpdater = {}),
        './UserGetter': (this.UserGetter = {
          getUser: sinon.stub().yields(null, this.mockUser)
        }),
        '../Email/EmailHandler': (this.EmailHandler = {}),
        '../Helpers/EmailHelper': EmailHelper
      }
    })
    this.mockUser = { _id: 'mock-user-id' }
    this.user_id = this.mockUser._id
    this.email = 'mock@example.com'
    return (this.callback = sinon.stub())
  })

  describe('sendConfirmationEmail', function() {
    beforeEach(function() {
      this.OneTimeTokenHandler.getNewToken = sinon
        .stub()
        .yields(null, (this.token = 'new-token'))
      return (this.EmailHandler.sendEmail = sinon.stub().yields())
    })

    describe('successfully', function() {
      beforeEach(function() {
        return this.UserEmailsConfirmationHandler.sendConfirmationEmail(
          this.user_id,
          this.email,
          this.callback
        )
      })

      it('should generate a token for the user which references their id and email', function() {
        return this.OneTimeTokenHandler.getNewToken
          .calledWith(
            'email_confirmation',
            { user_id: this.user_id, email: this.email },
            { expiresIn: 365 * 24 * 60 * 60 }
          )
          .should.equal(true)
      })

      it('should send an email to the user', function() {
        return this.EmailHandler.sendEmail
          .calledWith('confirmEmail', {
            to: this.email,
            confirmEmailUrl:
              'emails.example.com/user/emails/confirm?token=new-token',
            sendingUser_id: this.user_id
          })
          .should.equal(true)
      })

      it('should call the callback', function() {
        return this.callback.called.should.equal(true)
      })
    })

    describe('with invalid email', function() {
      beforeEach(function() {
        return this.UserEmailsConfirmationHandler.sendConfirmationEmail(
          this.user_id,
          '!"£$%^&*()',
          this.callback
        )
      })

      it('should return an error', function() {
        return this.callback
          .calledWith(sinon.match.instanceOf(Error))
          .should.equal(true)
      })
    })

    describe('a custom template', function() {
      beforeEach(function() {
        return this.UserEmailsConfirmationHandler.sendConfirmationEmail(
          this.user_id,
          this.email,
          'myCustomTemplate',
          this.callback
        )
      })

      it('should send an email with the given template', function() {
        return this.EmailHandler.sendEmail
          .calledWith('myCustomTemplate')
          .should.equal(true)
      })
    })
  })

  describe('confirmEmailFromToken', function() {
    beforeEach(function() {
      this.OneTimeTokenHandler.getValueFromTokenAndExpire = sinon
        .stub()
        .yields(null, { user_id: this.user_id, email: this.email })
      return (this.UserUpdater.confirmEmail = sinon.stub().yields())
    })

    describe('successfully', function() {
      beforeEach(function() {
        return this.UserEmailsConfirmationHandler.confirmEmailFromToken(
          (this.token = 'mock-token'),
          this.callback
        )
      })

      it('should call getValueFromTokenAndExpire', function() {
        return this.OneTimeTokenHandler.getValueFromTokenAndExpire
          .calledWith('email_confirmation', this.token)
          .should.equal(true)
      })

      it('should confirm the email of the user_id', function() {
        return this.UserUpdater.confirmEmail
          .calledWith(this.user_id, this.email)
          .should.equal(true)
      })

      it('should call the callback', function() {
        return this.callback.called.should.equal(true)
      })
    })

    describe('with an expired token', function() {
      beforeEach(function() {
        this.OneTimeTokenHandler.getValueFromTokenAndExpire = sinon
          .stub()
          .yields(null, null)
        return this.UserEmailsConfirmationHandler.confirmEmailFromToken(
          (this.token = 'mock-token'),
          this.callback
        )
      })

      it('should call the callback with a NotFoundError', function() {
        return this.callback
          .calledWith(sinon.match.instanceOf(Errors.NotFoundError))
          .should.equal(true)
      })
    })

    describe('with no user_id in the token', function() {
      beforeEach(function() {
        this.OneTimeTokenHandler.getValueFromTokenAndExpire = sinon
          .stub()
          .yields(null, { email: this.email })
        return this.UserEmailsConfirmationHandler.confirmEmailFromToken(
          (this.token = 'mock-token'),
          this.callback
        )
      })

      it('should call the callback with a NotFoundError', function() {
        return this.callback
          .calledWith(sinon.match.instanceOf(Errors.NotFoundError))
          .should.equal(true)
      })
    })

    describe('with no email in the token', function() {
      beforeEach(function() {
        this.OneTimeTokenHandler.getValueFromTokenAndExpire = sinon
          .stub()
          .yields(null, { user_id: this.user_id })
        return this.UserEmailsConfirmationHandler.confirmEmailFromToken(
          (this.token = 'mock-token'),
          this.callback
        )
      })

      it('should call the callback with a NotFoundError', function() {
        return this.callback
          .calledWith(sinon.match.instanceOf(Errors.NotFoundError))
          .should.equal(true)
      })
    })

    describe('with no user found', function() {
      beforeEach(function() {
        this.UserGetter.getUser.yields(null, null)
        return this.UserEmailsConfirmationHandler.confirmEmailFromToken(
          (this.token = 'mock-token'),
          this.callback
        )
      })

      it('should call the callback with a NotFoundError', function() {
        return this.callback
          .calledWith(sinon.match.instanceOf(Errors.NotFoundError))
          .should.equal(true)
      })
    })
  })
})
