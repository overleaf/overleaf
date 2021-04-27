const { expect } = require('chai')
const RateLimiter = require('../../../app/src/infrastructure/RateLimiter')
const UserHelper = require('./helpers/UserHelper')

describe('PasswordUpdate', function () {
  let email, password, response, user, userHelper
  afterEach(async function () {
    await RateLimiter.promises.clearRateLimit(
      'password_reset_rate_limit',
      '127.0.0.1'
    )
  })
  beforeEach(async function () {
    userHelper = new UserHelper()
    email = userHelper.getDefaultEmail()
    password = 'old-password'
    userHelper = await UserHelper.createUser({ email, password })
    userHelper = await UserHelper.loginUser({
      email,
      password,
    })
    await userHelper.getCsrfToken()
  })
  describe('success', function () {
    beforeEach(async function () {
      response = await userHelper.request.post('/user/password/update', {
        form: {
          currentPassword: password,
          newPassword1: 'new-password',
          newPassword2: 'new-password',
        },
        simple: false,
      })
      userHelper = await UserHelper.getUser({ email })
      user = userHelper.user
    })
    it('should return 200', async function () {
      expect(response.statusCode).to.equal(200)
    })
    it('should update the audit log', function () {
      const auditLog = userHelper.getAuditLogWithoutNoise()
      expect(auditLog[0]).to.exist
      expect(typeof auditLog[0].initiatorId).to.equal('object')
      expect(auditLog[0].initiatorId).to.deep.equal(user._id)
      expect(auditLog[0].operation).to.equal('update-password')
      expect(auditLog[0].ipAddress).to.equal('127.0.0.1')
      expect(auditLog[0].timestamp).to.exist
    })
  })
  describe('errors', function () {
    describe('missing current password', function () {
      beforeEach(async function () {
        response = await userHelper.request.post('/user/password/update', {
          form: {
            newPassword1: 'new-password',
            newPassword2: 'new-password',
          },
          simple: false,
        })
        userHelper = await UserHelper.getUser({ email })
      })
      it('should return 500', async function () {
        expect(response.statusCode).to.equal(500)
      })
      it('should not update audit log', async function () {
        const auditLog = userHelper.getAuditLogWithoutNoise()
        expect(auditLog).to.deep.equal([])
      })
    })
    describe('wrong current password', function () {
      beforeEach(async function () {
        response = await userHelper.request.post('/user/password/update', {
          form: {
            currentPassword: 'wrong-password',
            newPassword1: 'new-password',
            newPassword2: 'new-password',
          },
          simple: false,
        })
        userHelper = await UserHelper.getUser({ email })
      })
      it('should return 400', async function () {
        expect(response.statusCode).to.equal(400)
      })
      it('should not update audit log', async function () {
        const auditLog = userHelper.getAuditLogWithoutNoise()
        expect(auditLog).to.deep.equal([])
      })
    })
    describe('newPassword1 does not match newPassword2', function () {
      beforeEach(async function () {
        response = await userHelper.request.post('/user/password/update', {
          form: {
            currentPassword: password,
            newPassword1: 'new-password',
            newPassword2: 'oops-password',
          },
          json: true,
          simple: false,
        })
        userHelper = await UserHelper.getUser({ email })
      })
      it('should return 400', async function () {
        expect(response.statusCode).to.equal(400)
      })
      it('should return error message', async function () {
        expect(response.body.message).to.equal('Passwords do not match')
      })
      it('should not update audit log', async function () {
        const auditLog = userHelper.getAuditLogWithoutNoise()
        expect(auditLog).to.deep.equal([])
      })
    })
    describe('new password is not valid', function () {
      beforeEach(async function () {
        response = await userHelper.request.post('/user/password/update', {
          form: {
            currentPassword: password,
            newPassword1: 'short',
            newPassword2: 'short',
          },
          json: true,
          simple: false,
        })
        userHelper = await UserHelper.getUser({ email })
      })
      it('should return 400', async function () {
        expect(response.statusCode).to.equal(400)
      })
      it('should return error message', async function () {
        expect(response.body.message).to.equal('password is too short')
      })
      it('should not update audit log', async function () {
        const auditLog = userHelper.getAuditLogWithoutNoise()
        expect(auditLog).to.deep.equal([])
      })
    })
  })
})
