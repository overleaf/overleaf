const { expect } = require('chai')
const RateLimiter = require('../../../app/src/infrastructure/RateLimiter')
const UserHelper = require('./helpers/UserHelper')
const { db } = require('../../../app/src/infrastructure/mongojs')

describe('PasswordReset', function() {
  let email, response, user, userHelper, token
  afterEach(async function() {
    await RateLimiter.promises.clearRateLimit(
      'password_reset_rate_limit',
      '127.0.0.1'
    )
  })
  beforeEach(async function() {
    userHelper = new UserHelper()
    email = userHelper.getDefaultEmail()
    userHelper = await UserHelper.createUser({ email })
    user = userHelper.user

    // generate the token
    await userHelper.getCsrfToken()
    response = await userHelper.request.post('/user/password/reset', {
      form: {
        email
      }
    })

    token = await new Promise(resolve => {
      db.tokens.findOne(
        { 'data.user_id': user._id.toString() },
        (error, tokenData) => {
          expect(error).to.not.exist
          resolve(tokenData.token)
        }
      )
    })
  })
  describe('with a valid token', function() {
    describe('when logged in', function() {
      beforeEach(async function() {
        userHelper = await UserHelper.loginUser({
          email,
          password: userHelper.getDefaultPassword()
        })
        response = await userHelper.request.get(
          `/user/password/set?passwordResetToken=${token}&email=${email}`,
          { simple: false }
        )
        expect(response.statusCode).to.equal(302)
        expect(response.headers.location).to.equal('/user/password/set')
        // send reset request
        response = await userHelper.request.post('/user/password/set', {
          form: {
            passwordResetToken: token,
            password: 'a-password'
          }
        })
        userHelper = await UserHelper.getUser({ email })
        user = userHelper.user
      })
      it('update the password', async function() {
        expect(user.hashedPassword).to.exist
        expect(user.password).to.not.exist
      })
      it('log the change with initiatorId', async function() {
        expect(user.auditLog).to.exist
        expect(user.auditLog[0]).to.exist
        expect(typeof user.auditLog[0].initiatorId).to.equal('object')
        expect(user.auditLog[0].initiatorId).to.deep.equal(user._id)
        expect(user.auditLog[0].operation).to.equal('reset-password')
        expect(user.auditLog[0].ipAddress).to.equal('127.0.0.1')
        expect(user.auditLog[0].timestamp).to.exist
      })
    })
    describe('when logged in as another user', function() {
      let otherUser, otherUserEmail
      beforeEach(async function() {
        otherUserEmail = userHelper.getDefaultEmail()
        userHelper = await UserHelper.createUser({ email: otherUserEmail })
        otherUser = userHelper.user
        userHelper = await UserHelper.loginUser({
          email: otherUserEmail,
          password: userHelper.getDefaultPassword()
        })
        response = await userHelper.request.get(
          `/user/password/set?passwordResetToken=${token}&email=${email}`,
          { simple: false }
        )
        expect(response.statusCode).to.equal(302)
        expect(response.headers.location).to.equal('/user/password/set')
        // send reset request
        response = await userHelper.request.post('/user/password/set', {
          form: {
            passwordResetToken: token,
            password: 'a-password'
          }
        })
        userHelper = await UserHelper.getUser({ email })
        user = userHelper.user
      })
      it('update the password', async function() {
        expect(user.hashedPassword).to.exist
        expect(user.password).to.not.exist
      })
      it('log the change with the logged in user as the initiatorId', async function() {
        expect(user.auditLog).to.exist
        expect(user.auditLog[0]).to.exist
        expect(typeof user.auditLog[0].initiatorId).to.equal('object')
        expect(user.auditLog[0].initiatorId).to.deep.equal(otherUser._id)
        expect(user.auditLog[0].operation).to.equal('reset-password')
        expect(user.auditLog[0].ipAddress).to.equal('127.0.0.1')
        expect(user.auditLog[0].timestamp).to.exist
      })
    })
    describe('when not logged in', function() {
      beforeEach(async function() {
        response = await userHelper.request.get(
          `/user/password/set?passwordResetToken=${token}&email=${email}`,
          { simple: false }
        )
        expect(response.statusCode).to.equal(302)
        expect(response.headers.location).to.equal('/user/password/set')
        // send reset request
        response = await userHelper.request.post('/user/password/set', {
          form: {
            passwordResetToken: token,
            password: 'a-password'
          }
        })
        userHelper = await UserHelper.getUser({ email })
        user = userHelper.user
      })
      it('updates the password', function() {
        expect(user.hashedPassword).to.exist
        expect(user.password).to.not.exist
      })
      it('log the change', async function() {
        expect(user.auditLog).to.exist
        expect(user.auditLog[0]).to.exist
        expect(user.auditLog[0].initiatorId).to.equal(null)
        expect(user.auditLog[0].operation).to.equal('reset-password')
        expect(user.auditLog[0].ipAddress).to.equal('127.0.0.1')
        expect(user.auditLog[0].timestamp).to.exist
      })
    })
    describe('password checks', function() {
      beforeEach(async function() {
        response = await userHelper.request.get(
          `/user/password/set?passwordResetToken=${token}&email=${email}`,
          { simple: false }
        )
        expect(response.statusCode).to.equal(302)
        expect(response.headers.location).to.equal('/user/password/set')
      })
      it('without a password should return 400 and not log the change', async function() {
        // send reset request
        response = await userHelper.request.post('/user/password/set', {
          form: {
            passwordResetToken: token
          },
          simple: false
        })
        expect(response.statusCode).to.equal(400)
        userHelper = await UserHelper.getUser({ email })
        user = userHelper.user
        expect(user.auditLog).to.deep.equal([])
      })

      it('without a valid password should return 400 and not log the change', async function() {
        // send reset request
        response = await userHelper.request.post('/user/password/set', {
          form: {
            passwordResetToken: token,
            password: 'short'
          },
          simple: false
        })
        expect(response.statusCode).to.equal(400)
        userHelper = await UserHelper.getUser({ email })
        user = userHelper.user
        expect(user.auditLog).to.deep.equal([])
      })
    })
  })
  describe('without a valid token', function() {
    it('no token should redirect to page to re-request reset token', async function() {
      response = await userHelper.request.get(
        `/user/password/set?&email=${email}`,
        { simple: false }
      )
      expect(response.statusCode).to.equal(302)
      expect(response.headers.location).to.equal('/user/password/reset')
    })
    it('should return 404 for invalid tokens', async function() {
      const invalidToken = 'not-real-token'
      response = await userHelper.request.get(
        `/user/password/set?&passwordResetToken=${invalidToken}&email=${email}`,
        { simple: false }
      )
      expect(response.statusCode).to.equal(302)
      expect(response.headers.location).to.equal('/user/password/set')
      // send reset request
      response = await userHelper.request.post('/user/password/set', {
        form: {
          passwordResetToken: invalidToken,
          password: 'a-password'
        },
        simple: false
      })
      expect(response.statusCode).to.equal(404)
    })
  })
})
