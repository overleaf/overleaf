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
const path = require('path')
const sinon = require('sinon')
const modulePath = path.join(
  __dirname,
  '../../../../app/src/Features/User/UserEmailsConfirmationHandler'
)
const { expect } = require('chai')
const Errors = require('../../../../app/src/Features/Errors/Errors')
const EmailHelper = require('../../../../app/src/Features/Helpers/EmailHelper')

describe('UserEmailsConfirmationHandler', function () {
  beforeEach(function () {
    this.mockUser = {
      _id: 'mock-user-id',
      email: 'mock@example.com',
      emails: [{ email: 'mock@example.com' }],
    }
    this.user_id = this.mockUser._id
    this.email = this.mockUser.email
    this.req = {}
    this.UserEmailsConfirmationHandler = SandboxedModule.require(modulePath, {
      requires: {
        '@overleaf/settings': (this.settings = {
          siteUrl: 'https://emails.example.com',
        }),
        '../Security/OneTimeTokenHandler': (this.OneTimeTokenHandler = {
          promises: {},
        }),
        './UserUpdater': (this.UserUpdater = {
          promises: {},
        }),
        './UserGetter': (this.UserGetter = {
          getUser: sinon.stub().yields(null, this.mockUser),
          promises: {
            getUser: sinon.stub().resolves(this.mockUser),
          },
        }),
        '../Email/EmailHandler': (this.EmailHandler = {}),
        '../Helpers/EmailHelper': EmailHelper,
        '../Authentication/SessionManager': (this.SessionManager = {
          getLoggedInUserId: sinon.stub().returns(this.mockUser._id),
        }),
      },
    })
    return (this.callback = sinon.stub())
  })

  describe('sendConfirmationEmail', function () {
    beforeEach(function () {
      this.OneTimeTokenHandler.getNewToken = sinon
        .stub()
        .yields(null, (this.token = 'new-token'))
      return (this.EmailHandler.sendEmail = sinon.stub().yields())
    })

    describe('successfully', function () {
      beforeEach(function () {
        return this.UserEmailsConfirmationHandler.sendConfirmationEmail(
          this.user_id,
          this.email,
          this.callback
        )
      })

      it('should generate a token for the user which references their id and email', function () {
        return this.OneTimeTokenHandler.getNewToken
          .calledWith(
            'email_confirmation',
            { user_id: this.user_id, email: this.email },
            { expiresIn: 90 * 24 * 60 * 60 }
          )
          .should.equal(true)
      })

      it('should send an email to the user', function () {
        return this.EmailHandler.sendEmail
          .calledWith('confirmEmail', {
            to: this.email,
            confirmEmailUrl:
              'https://emails.example.com/user/emails/confirm?token=new-token',
            sendingUser_id: this.user_id,
          })
          .should.equal(true)
      })

      it('should call the callback', function () {
        return this.callback.called.should.equal(true)
      })
    })

    describe('with invalid email', function () {
      beforeEach(function () {
        return this.UserEmailsConfirmationHandler.sendConfirmationEmail(
          this.user_id,
          '!"£$%^&*()',
          this.callback
        )
      })

      it('should return an error', function () {
        return this.callback
          .calledWith(sinon.match.instanceOf(Error))
          .should.equal(true)
      })
    })

    describe('a custom template', function () {
      beforeEach(function () {
        return this.UserEmailsConfirmationHandler.sendConfirmationEmail(
          this.user_id,
          this.email,
          'myCustomTemplate',
          this.callback
        )
      })

      it('should send an email with the given template', function () {
        return this.EmailHandler.sendEmail
          .calledWith('myCustomTemplate')
          .should.equal(true)
      })
    })
  })

  describe('confirmEmailFromToken', function () {
    beforeEach(function () {
      this.OneTimeTokenHandler.promises.peekValueFromToken = sinon
        .stub()
        .resolves({ data: { user_id: this.user_id, email: this.email } })
      this.OneTimeTokenHandler.promises.expireToken = sinon.stub().resolves()
      this.UserUpdater.promises.confirmEmail = sinon.stub().resolves()
    })

    describe('successfully', function () {
      beforeEach(async function () {
        await this.UserEmailsConfirmationHandler.promises.confirmEmailFromToken(
          this.req,
          (this.token = 'mock-token')
        )
      })

      it('should call peekValueFromToken', function () {
        return this.OneTimeTokenHandler.promises.peekValueFromToken
          .calledWith('email_confirmation', this.token)
          .should.equal(true)
      })

      it('should call expireToken', function () {
        return this.OneTimeTokenHandler.promises.expireToken
          .calledWith('email_confirmation', this.token)
          .should.equal(true)
      })

      it('should confirm the email of the user_id', function () {
        return this.UserUpdater.promises.confirmEmail
          .calledWith(this.user_id, this.email)
          .should.equal(true)
      })
    })

    describe('with an expired token', function () {
      beforeEach(function () {
        this.OneTimeTokenHandler.promises.peekValueFromToken = sinon
          .stub()
          .rejects(new Errors.NotFoundError('no token found'))
      })

      it('should reject with a NotFoundError', async function () {
        await expect(
          this.UserEmailsConfirmationHandler.promises.confirmEmailFromToken(
            this.req,
            (this.token = 'mock-token')
          )
        ).to.be.rejectedWith(Errors.NotFoundError)
      })
    })

    describe('with no user_id in the token', function () {
      beforeEach(function () {
        this.OneTimeTokenHandler.promises.peekValueFromToken = sinon
          .stub()
          .resolves({ data: { email: this.email } })
      })

      it('should reject with a NotFoundError', async function () {
        await expect(
          this.UserEmailsConfirmationHandler.promises.confirmEmailFromToken(
            this.req,
            (this.token = 'mock-token')
          )
        ).to.be.rejectedWith(Errors.NotFoundError)
      })
    })

    describe('with no email in the token', function () {
      beforeEach(function () {
        this.OneTimeTokenHandler.promises.peekValueFromToken = sinon
          .stub()
          .resolves({ data: { user_id: this.user_id } })
      })

      it('should reject with a NotFoundError', async function () {
        await expect(
          this.UserEmailsConfirmationHandler.promises.confirmEmailFromToken(
            this.req,
            (this.token = 'mock-token')
          )
        ).to.be.rejectedWith(Errors.NotFoundError)
      })
    })

    describe('with no user found', function () {
      beforeEach(function () {
        this.UserGetter.promises.getUser.resolves(null)
      })

      it('should reject with a NotFoundError', async function () {
        await expect(
          this.UserEmailsConfirmationHandler.promises.confirmEmailFromToken(
            this.req,
            (this.token = 'mock-token')
          )
        ).to.be.rejectedWith(Errors.NotFoundError)
      })
    })

    describe('with secondary email missing on user', function () {
      beforeEach(function () {
        this.OneTimeTokenHandler.promises.peekValueFromToken = sinon
          .stub()
          .resolves({
            data: { user_id: this.user_id, email: 'deleted@email.com' },
          })
      })

      it('should reject with a NotFoundError', async function () {
        await expect(
          this.UserEmailsConfirmationHandler.promises.confirmEmailFromToken(
            this.req,
            (this.token = 'mock-token')
          )
        ).to.be.rejectedWith(Errors.NotFoundError)
      })
    })

    describe('when the logged in user is not the token user', function () {
      beforeEach(function () {
        this.SessionManager.getLoggedInUserId = sinon
          .stub()
          .returns('other-user-id')
      })

      it('should reject with a ForbiddenError', async function () {
        await expect(
          this.UserEmailsConfirmationHandler.promises.confirmEmailFromToken(
            this.req,
            (this.token = 'mock-token')
          )
        ).to.be.rejectedWith(Errors.ForbiddenError)
      })
    })
  })
})
