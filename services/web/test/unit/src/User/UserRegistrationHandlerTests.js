/* eslint-disable
    n/handle-callback-err,
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
    this.User = { updateOne: sinon.stub().callsArgWith(2) }
    this.UserGetter = { getUserByAnyEmail: sinon.stub() }
    this.UserCreator = {
      createNewUser: sinon.stub().callsArgWith(2, null, this.user),
    }
    this.AuthenticationManager = {
      validateEmail: sinon.stub().returns(null),
      validatePassword: sinon.stub().returns(null),
      setUserPassword: sinon.stub().callsArgWith(2),
    }
    this.NewsLetterManager = { subscribe: sinon.stub().callsArgWith(1) }
    this.EmailHandler = { sendEmail: sinon.stub().callsArgWith(2) }
    this.OneTimeTokenHandler = { getNewToken: sinon.stub() }
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
      const result = this.handler._registrationRequestIsValid(
        this.passingRequest
      )
      return result.should.equal(true)
    })

    describe('failing email validation', function () {
      beforeEach(function () {
        return this.AuthenticationManager.validateEmail.returns({
          message: 'email not set',
        })
      })

      it('does not allow through', function () {
        const result = this.handler._registrationRequestIsValid(
          this.passingRequest
        )
        return result.should.equal(false)
      })
    })

    describe('failing password validation', function () {
      beforeEach(function () {
        return this.AuthenticationManager.validatePassword.returns({
          message: 'password is too short',
        })
      })

      it('does not allow through', function () {
        const result = this.handler._registrationRequestIsValid(
          this.passingRequest
        )
        return result.should.equal(false)
      })
    })
  })

  describe('registerNewUser', function () {
    describe('holdingAccount', function (done) {
      beforeEach(function () {
        this.user.holdingAccount = true
        this.handler._registrationRequestIsValid = sinon.stub().returns(true)
        return this.UserGetter.getUserByAnyEmail.callsArgWith(
          1,
          null,
          this.user
        )
      })

      it('should not create a new user if there is a holding account there', function (done) {
        return this.handler.registerNewUser(this.passingRequest, err => {
          this.UserCreator.createNewUser.called.should.equal(false)
          return done()
        })
      })

      it('should set holding account to false', function (done) {
        return this.handler.registerNewUser(this.passingRequest, err => {
          const update = this.User.updateOne.args[0]
          assert.deepEqual(update[0], { _id: this.user._id })
          assert.deepEqual(update[1], { $set: { holdingAccount: false } })
          return done()
        })
      })
    })

    describe('invalidRequest', function () {
      it('should not create a new user if the the request is not valid', function (done) {
        this.handler._registrationRequestIsValid = sinon.stub().returns(false)
        return this.handler.registerNewUser(this.passingRequest, err => {
          expect(err).to.exist
          this.UserCreator.createNewUser.called.should.equal(false)
          return done()
        })
      })

      it('should return email registered in the error if there is a non holdingAccount there', function (done) {
        this.UserGetter.getUserByAnyEmail.callsArgWith(
          1,
          null,
          (this.user = { holdingAccount: false })
        )
        return this.handler.registerNewUser(
          this.passingRequest,
          (err, user) => {
            expect(err).to.be.instanceOf(Error)
            expect(err).to.have.property('message', 'EmailAlreadyRegistered')
            user.should.deep.equal(this.user)
            return done()
          }
        )
      })
    })

    describe('validRequest', function () {
      beforeEach(function () {
        this.handler._registrationRequestIsValid = sinon.stub().returns(true)
        return this.UserGetter.getUserByAnyEmail.callsArgWith(1)
      })

      it('should create a new user', function (done) {
        this.handler.registerNewUser(this.passingRequest, err => {
          sinon.assert.calledWith(this.UserCreator.createNewUser, {
            email: this.passingRequest.email,
            holdingAccount: false,
            first_name: this.passingRequest.first_name,
            last_name: this.passingRequest.last_name,
            analyticsId: this.user.analyticsId,
          })
          done()
        })
      })

      it('lower case email', function (done) {
        this.passingRequest.email = 'soMe@eMail.cOm'
        return this.handler.registerNewUser(this.passingRequest, err => {
          this.UserCreator.createNewUser.args[0][0].email.should.equal(
            'some@email.com'
          )
          return done()
        })
      })

      it('trim white space from email', function (done) {
        this.passingRequest.email = ' some@email.com '
        return this.handler.registerNewUser(this.passingRequest, err => {
          this.UserCreator.createNewUser.args[0][0].email.should.equal(
            'some@email.com'
          )
          return done()
        })
      })

      it('should set the password', function (done) {
        return this.handler.registerNewUser(this.passingRequest, err => {
          this.AuthenticationManager.setUserPassword
            .calledWith(this.user, this.passingRequest.password)
            .should.equal(true)
          return done()
        })
      })

      it('should add the user to the newsletter if accepted terms', function (done) {
        this.passingRequest.subscribeToNewsletter = 'true'
        return this.handler.registerNewUser(this.passingRequest, err => {
          this.NewsLetterManager.subscribe
            .calledWith(this.user)
            .should.equal(true)
          return done()
        })
      })

      it('should not add the user to the newsletter if not accepted terms', function (done) {
        return this.handler.registerNewUser(this.passingRequest, err => {
          this.NewsLetterManager.subscribe
            .calledWith(this.user)
            .should.equal(false)
          return done()
        })
      })
    })

    it('should call the ReferalAllocator', function (done) {
      return done()
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
      this.OneTimeTokenHandler.getNewToken.yields(
        null,
        (this.token = 'mock-token')
      )
      this.handler.registerNewUser = sinon.stub()
      return (this.callback = sinon.stub())
    })

    describe('with a new user', function () {
      beforeEach(function () {
        this.user.email = this.email.toLowerCase()
        this.handler.registerNewUser.callsArgWith(1, null, this.user)
        return this.handler.registerNewUserAndSendActivationEmail(
          this.email,
          this.callback
        )
      })

      it('should ask the UserRegistrationHandler to register user', function () {
        sinon.assert.calledWith(this.handler.registerNewUser, {
          email: this.email,
          password: this.password,
        })
      })

      it('should generate a new password reset token', function () {
        const data = {
          user_id: this.user._id.toString(),
          email: this.user.email,
        }
        return this.OneTimeTokenHandler.getNewToken
          .calledWith('password', data, { expiresIn: 7 * 24 * 60 * 60 })
          .should.equal(true)
      })

      it('should send a registered email', function () {
        return this.EmailHandler.sendEmail
          .calledWith('registered', {
            to: this.user.email,
            setNewPasswordUrl: `${this.settings.siteUrl}/user/activate?token=${this.token}&user_id=${this.user_id}`,
          })
          .should.equal(true)
      })

      it('should return the user', function () {
        return this.callback
          .calledWith(
            null,
            this.user,
            `${this.settings.siteUrl}/user/activate?token=${this.token}&user_id=${this.user_id}`
          )
          .should.equal(true)
      })
    })

    describe('with a user that already exists', function () {
      beforeEach(function () {
        this.handler.registerNewUser.callsArgWith(
          1,
          new Error('EmailAlreadyRegistered'),
          this.user
        )
        return this.handler.registerNewUserAndSendActivationEmail(
          this.email,
          this.callback
        )
      })

      it('should still generate a new password token and email', function () {
        this.OneTimeTokenHandler.getNewToken.called.should.equal(true)
        return this.EmailHandler.sendEmail.called.should.equal(true)
      })
    })
  })
})
