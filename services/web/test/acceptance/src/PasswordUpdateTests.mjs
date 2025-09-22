import { expect } from 'chai'
import PasswordResetRouter from '../../../app/src/Features/PasswordReset/PasswordResetRouter.mjs'
import UserHelper from './helpers/UserHelper.mjs'

describe('PasswordUpdate', function () {
  let email, password, response, user, userHelper
  afterEach(async function () {
    await PasswordResetRouter.rateLimiter.delete('127.0.0.1')
  })
  beforeEach(async function () {
    userHelper = new UserHelper()
    email = 'somecooluser@example.com'
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
      response = await userHelper.fetch('/user/password/update', {
        method: 'POST',
        body: new URLSearchParams({
          currentPassword: password,
          newPassword1: 'new-password',
          newPassword2: 'new-password',
        }),
      })
      userHelper = await UserHelper.getUser({ email })
      user = userHelper.user
    })
    it('should return 200', async function () {
      expect(response.status).to.equal(200)
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
        response = await userHelper.fetch('/user/password/update', {
          method: 'POST',
          body: new URLSearchParams({
            newPassword1: 'new-password',
            newPassword2: 'new-password',
          }),
        })
        userHelper = await UserHelper.getUser({ email })
      })
      it('should return 500', async function () {
        expect(response.status).to.equal(500)
      })
      it('should not update audit log', async function () {
        const auditLog = userHelper.getAuditLogWithoutNoise()
        expect(auditLog).to.deep.equal([])
      })
    })
    describe('wrong current password', function () {
      beforeEach(async function () {
        response = await userHelper.fetch('/user/password/update', {
          method: 'POST',
          body: new URLSearchParams({
            currentPassword: 'wrong-password',
            newPassword1: 'new-password',
            newPassword2: 'new-password',
          }),
        })
        userHelper = await UserHelper.getUser({ email })
      })
      it('should return 400', async function () {
        expect(response.status).to.equal(400)
      })
      it('should not update audit log', async function () {
        const auditLog = userHelper.getAuditLogWithoutNoise()
        expect(auditLog).to.deep.equal([])
      })
    })
    describe('newPassword1 does not match newPassword2', function () {
      beforeEach(async function () {
        response = await userHelper.fetch('/user/password/update', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            currentPassword: password,
            newPassword1: 'new-password',
            newPassword2: 'oops-password',
          }),
        })
        userHelper = await UserHelper.getUser({ email })
      })
      it('should return 400', async function () {
        expect(response.status).to.equal(400)
      })
      it('should return error message', async function () {
        const body = await response.json()
        expect(body.message).to.equal('Passwords do not match.')
      })
      it('should not update audit log', async function () {
        const auditLog = userHelper.getAuditLogWithoutNoise()
        expect(auditLog).to.deep.equal([])
      })
    })
    describe('new password is not valid', function () {
      beforeEach(async function () {
        response = await userHelper.fetch('/user/password/update', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            currentPassword: password,
            newPassword1: 'short',
            newPassword2: 'short',
          }),
        })
        userHelper = await UserHelper.getUser({ email })
      })
      it('should return 400', async function () {
        expect(response.status).to.equal(400)
      })
      it('should return error message', async function () {
        const body = await response.json()
        expect(body.message).to.deep.equal({
          type: 'error',
          key: 'password-too-short',
          text: 'Password too short, minimum 8.',
        })
      })
      it('should not update audit log', async function () {
        const auditLog = userHelper.getAuditLogWithoutNoise()
        expect(auditLog).to.deep.equal([])
      })
    })
    describe('new password contains part of email', function () {
      beforeEach(async function () {
        response = await userHelper.fetch('/user/password/update', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            currentPassword: password,
            newPassword1: 'somecooluser123',
            newPassword2: 'somecooluser123',
          }),
        })
        userHelper = await UserHelper.getUser({ email })
      })
      it('should return 400', async function () {
        expect(response.status).to.equal(400)
      })
      it('should return error message', async function () {
        const body = await response.json()
        expect(body.message).to.deep.equal({
          key: 'password-contains-email',
          type: 'error',
          text: 'Password cannot contain parts of email address.',
        })
      })
      it('should not update audit log', async function () {
        const auditLog = userHelper.getAuditLogWithoutNoise()
        expect(auditLog).to.deep.equal([])
      })
    })
    describe('new password is too similar to email', function () {
      beforeEach(async function () {
        response = await userHelper.fetch('/user/password/update', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            currentPassword: password,
            newPassword1: 'coolusersome123',
            newPassword2: 'coolusersome123',
          }),
        })
        userHelper = await UserHelper.getUser({ email })
      })
      it('should return 400', async function () {
        expect(response.status).to.equal(400)
      })
      it('should return error message', async function () {
        const body = await response.json()
        expect(body.message).to.deep.equal({
          key: 'password-too-similar',
          type: 'error',
          text: 'Password is too similar to parts of email address.',
        })
      })
      it('should not update audit log', async function () {
        const auditLog = userHelper.getAuditLogWithoutNoise()
        expect(auditLog).to.deep.equal([])
      })
    })
  })
})
