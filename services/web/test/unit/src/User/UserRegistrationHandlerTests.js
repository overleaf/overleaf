const SandboxedModule = require('sandboxed-module')
const assert = require('assert')
const path = require('path')
const modulePath = path.join(
  __dirname,
  '../../../../app/src/Features/User/UserRegistrationHandler'
)
const sinon = require('sinon')
const { expect } = require('chai')
const EmailHelper = require('../../../../app/src/Features/Helpers/EmailHelper')

describe('UserRegistrationHandler', function () {
  beforeEach(function () {
    this.analyticsId = '123456'
    this.user = {
      _id: (this.user_id = '31j2lk21kjl'),
      analyticsId: this.analyticsId,
    }
    this.User = {
      updateOne: sinon.stub().returns({ exec: sinon.stub().resolves() }),
    }
    this.UserGetter = {
      promises: {
        getUserByAnyEmail: sinon.stub(),
      },
    }
    this.UserCreator = {
      promises: {
        createNewUser: sinon.stub().resolves(this.user),
      },
    }
    this.AuthenticationManager = {
      validateEmail: sinon.stub().returns(null),
      validatePassword: sinon.stub().returns(null),
      promises: {
        setUserPassword: sinon.stub().resolves(this.user),
      },
    }
    this.NewsLetterManager = {
      subscribe: sinon.stub(),
    }
    this.EmailHandler = {
      promises: { sendEmail: sinon.stub().resolves() },
    }
    this.OneTimeTokenHandler = { promises: { getNewToken: sinon.stub() } }
    this.handler = SandboxedModule.require(modulePath, {
      requires: {
        '../../models/User': { User: this.User },
        './UserGetter': this.UserGetter,
        './UserCreator': this.UserCreator,
        '../Authentication/AuthenticationManager': this.AuthenticationManager,
        '../Newsletter/NewsletterManager': this.NewsLetterManager,
        crypto: (this.crypto = {}),
        '../Email/EmailHandler': this.EmailHandler,
        '../Security/OneTimeTokenHandler': this.OneTimeTokenHandler,
        '../Analytics/AnalyticsManager': (this.AnalyticsManager = {
          recordEventForUser: sinon.stub(),
          setUserPropertyForUser: sinon.stub(),
          identifyUser: sinon.stub(),
        }),
        '@overleaf/settings': (this.settings = {
          siteUrl: 'http://sl.example.com',
        }),
        '../Helpers/EmailHelper': EmailHelper,
      },
    })

    this.passingRequest = {
      email: 'something@email.com',
      password: '123',
      analyticsId: this.analyticsId,
    }
  })

  describe('validate Register Request', function () {
    it('allows passing validation through', function () {
      const result = this.handler.promises._registrationRequestIsValid(
        this.passingRequest
      )
      result.should.equal(true)
    })

    describe('failing email validation', function () {
      beforeEach(function () {
        this.AuthenticationManager.validateEmail.returns({
          message: 'email not set',
        })
      })

      it('does not allow through', function () {
        const result = this.handler.promises._registrationRequestIsValid(
          this.passingRequest
        )
        return result.should.equal(false)
      })
    })

    describe('failing password validation', function () {
      beforeEach(function () {
        this.AuthenticationManager.validatePassword.returns({
          message: 'password is too short',
        })
      })

      it('does not allow through', function () {
        const result = this.handler.promises._registrationRequestIsValid(
          this.passingRequest
        )
        result.should.equal(false)
      })
    })
  })

  describe('registerNewUser', function () {
    describe('holdingAccount', function (done) {
      beforeEach(function () {
        this.user.holdingAccount = true
        this.handler.promises._registrationRequestIsValid = sinon
          .stub()
          .returns(true)
        this.UserGetter.promises.getUserByAnyEmail.resolves(this.user)
      })

      it('should not create a new user if there is a holding account there', async function () {
        await this.handler.promises.registerNewUser(this.passingRequest)
        this.UserCreator.promises.createNewUser.called.should.equal(false)
      })

      it('should set holding account to false', async function () {
        await this.handler.promises.registerNewUser(this.passingRequest)
        const update = this.User.updateOne.args[0]
        assert.deepEqual(update[0], { _id: this.user._id })
        assert.deepEqual(update[1], { $set: { holdingAccount: false } })
      })
    })

    describe('invalidRequest', function () {
      it('should not create a new user if the the request is not valid', async function () {
        this.handler.promises._registrationRequestIsValid = sinon
          .stub()
          .returns(false)
        expect(this.handler.promises.registerNewUser(this.passingRequest)).to.be
          .rejected
        this.UserCreator.promises.createNewUser.called.should.equal(false)
      })

      it('should return email registered in the error if there is a non holdingAccount there', async function () {
        this.UserGetter.promises.getUserByAnyEmail.resolves(
          (this.user = { holdingAccount: false })
        )
        expect(
          this.handler.promises.registerNewUser(this.passingRequest)
        ).to.be.rejectedWith('EmailAlreadyRegistered')
      })
    })

    describe('validRequest', function () {
      beforeEach(function () {
        this.handler.promises._registrationRequestIsValid = sinon
          .stub()
          .returns(true)
        this.UserGetter.promises.getUserByAnyEmail.resolves()
      })

      it('should create a new user', async function () {
        await this.handler.promises.registerNewUser(this.passingRequest)
        sinon.assert.calledWith(this.UserCreator.promises.createNewUser, {
          email: this.passingRequest.email,
          holdingAccount: false,
          first_name: this.passingRequest.first_name,
          last_name: this.passingRequest.last_name,
          analyticsId: this.user.analyticsId,
        })
      })

      it('lower case email', async function () {
        this.passingRequest.email = 'soMe@eMail.cOm'
        await this.handler.promises.registerNewUser(this.passingRequest)
        this.UserCreator.promises.createNewUser.args[0][0].email.should.equal(
          'some@email.com'
        )
      })

      it('trim white space from email', async function () {
        this.passingRequest.email = ' some@email.com '
        await this.handler.promises.registerNewUser(this.passingRequest)
        this.UserCreator.promises.createNewUser.args[0][0].email.should.equal(
          'some@email.com'
        )
      })

      it('should set the password', async function () {
        await this.handler.promises.registerNewUser(this.passingRequest)
        this.AuthenticationManager.promises.setUserPassword
          .calledWith(this.user, this.passingRequest.password)
          .should.equal(true)
      })

      it('should add the user to the newsletter if accepted terms', async function () {
        this.passingRequest.subscribeToNewsletter = 'true'
        await this.handler.promises.registerNewUser(this.passingRequest)
        this.NewsLetterManager.subscribe
          .calledWith(this.user)
          .should.equal(true)
      })

      it('should not add the user to the newsletter if not accepted terms', async function () {
        await this.handler.promises.registerNewUser(this.passingRequest)
        this.NewsLetterManager.subscribe
          .calledWith(this.user)
          .should.equal(false)
      })
    })
  })

  describe('registerNewUserAndSendActivationEmail', function () {
    beforeEach(function () {
      this.email = 'Email@example.com'
      this.crypto.randomBytes = sinon.stub().returns({
        toString: () => {
          return (this.password = 'mock-password')
        },
      })
      this.OneTimeTokenHandler.promises.getNewToken.resolves(
        (this.token = 'mock-token')
      )
      this.handler.promises.registerNewUser = sinon.stub()
    })

    describe('with a new user', function () {
      beforeEach(async function () {
        this.user.email = this.email.toLowerCase()
        this.handler.promises.registerNewUser.resolves(this.user)
        this.result =
          await this.handler.promises.registerNewUserAndSendActivationEmail(
            this.email
          )
      })

      it('should ask the UserRegistrationHandler to register user', function () {
        sinon.assert.calledWith(this.handler.promises.registerNewUser, {
          email: this.email,
          password: this.password,
        })
      })

      it('should generate a new password reset token', function () {
        const data = {
          user_id: this.user._id.toString(),
          email: this.user.email,
        }
        this.OneTimeTokenHandler.promises.getNewToken
          .calledWith('password', data, { expiresIn: 7 * 24 * 60 * 60 })
          .should.equal(true)
      })

      it('should send a registered email', function () {
        this.EmailHandler.promises.sendEmail
          .calledWith('registered', {
            to: this.user.email,
            setNewPasswordUrl: `${this.settings.siteUrl}/user/activate?token=${this.token}&user_id=${this.user_id}`,
          })
          .should.equal(true)
      })

      it('should return the user and new password url', function () {
        const { user, setNewPasswordUrl } = this.result
        expect(user).to.deep.equal(this.user)
        expect(setNewPasswordUrl).to.equal(
          `${this.settings.siteUrl}/user/activate?token=${this.token}&user_id=${this.user_id}`
        )
      })
    })

    describe('with a user that already exists', function () {
      beforeEach(async function () {
        this.handler.promises.registerNewUser.rejects(
          new Error('EmailAlreadyRegistered')
        )
        this.UserGetter.promises.getUserByAnyEmail.resolves(this.user)
        await this.handler.promises.registerNewUserAndSendActivationEmail(
          this.email
        )
      })

      it('should still generate a new password token and email', function () {
        this.OneTimeTokenHandler.promises.getNewToken.called.should.equal(true)
        this.EmailHandler.promises.sendEmail.called.should.equal(true)
      })
    })
  })
})
