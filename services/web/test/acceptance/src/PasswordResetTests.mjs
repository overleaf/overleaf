import { expect } from 'chai'
import UserHelper from './helpers/UserHelper.mjs'
import { db } from '../../../app/src/infrastructure/mongodb.js'

describe('PasswordReset', function () {
  let email, response, user, userHelper, token, emailQuery
  beforeEach(async function () {
    userHelper = new UserHelper()
    email = 'somecooluser@example.com'
    emailQuery = `?email=${encodeURIComponent(email)}`
    userHelper = await UserHelper.createUser({ email })
    user = userHelper.user

    // generate the token
    await userHelper.getCsrfToken()
    response = await userHelper.fetch('/user/password/reset', {
      method: 'POST',
      body: new URLSearchParams({ email }),
    })

    token = (
      await db.tokens.findOne({
        'data.user_id': user._id.toString(),
      })
    ).token
  })
  describe('with a valid token', function () {
    describe('when logged in', function () {
      beforeEach(async function () {
        userHelper = await UserHelper.loginUser({
          email,
          password: userHelper.getDefaultPassword(),
        })
        response = await userHelper.fetch(
          `/user/password/set?passwordResetToken=${token}&email=${email}`
        )
        expect(response.status).to.equal(302)
        expect(response.headers.get('location')).to.equal(
          UserHelper.url(`/user/password/set${emailQuery}`).toString()
        )
        // send reset request
        response = await userHelper.fetch('/user/password/set', {
          method: 'POST',
          body: new URLSearchParams({
            passwordResetToken: token,
            password: 'a-password',
          }),
        })
        userHelper = await UserHelper.getUser({ email })
        user = userHelper.user
      })
      it('update the password', async function () {
        expect(user.hashedPassword).to.exist
        expect(user.password).to.not.exist
      })
      it('log the change with initiatorId', async function () {
        const auditLog = userHelper.getAuditLogWithoutNoise()
        expect(auditLog).to.exist
        expect(auditLog[0]).to.exist
        expect(typeof auditLog[0].initiatorId).to.equal('object')
        expect(auditLog[0].initiatorId).to.deep.equal(user._id)
        expect(auditLog[0].operation).to.equal('reset-password')
        expect(auditLog[0].ipAddress).to.equal('127.0.0.1')
        expect(auditLog[0].timestamp).to.exist
      })
    })
    describe('when logged in as another user', function () {
      let otherUser, otherUserEmail
      beforeEach(async function () {
        otherUserEmail = userHelper.getDefaultEmail()
        userHelper = await UserHelper.createUser({ email: otherUserEmail })
        otherUser = userHelper.user
        userHelper = await UserHelper.loginUser({
          email: otherUserEmail,
          password: userHelper.getDefaultPassword(),
        })
        response = await userHelper.fetch(
          `/user/password/set?passwordResetToken=${token}&email=${email}`
        )
        expect(response.status).to.equal(302)
        expect(response.headers.get('location')).to.equal(
          UserHelper.url(`/user/password/set${emailQuery}`).toString()
        )
        // send reset request
        response = await userHelper.fetch('/user/password/set', {
          method: 'POST',
          body: new URLSearchParams({
            passwordResetToken: token,
            password: 'a-password',
          }),
        })
        userHelper = await UserHelper.getUser({ email })
        user = userHelper.user
      })
      it('update the password', async function () {
        expect(user.hashedPassword).to.exist
        expect(user.password).to.not.exist
      })
      it('log the change with the logged in user as the initiatorId', async function () {
        const auditLog = userHelper.getAuditLogWithoutNoise()
        expect(auditLog).to.exist
        expect(auditLog[0]).to.exist
        expect(typeof auditLog[0].initiatorId).to.equal('object')
        expect(auditLog[0].initiatorId).to.deep.equal(otherUser._id)
        expect(auditLog[0].operation).to.equal('reset-password')
        expect(auditLog[0].ipAddress).to.equal('127.0.0.1')
        expect(auditLog[0].timestamp).to.exist
      })
    })
    describe('when not logged in', function () {
      beforeEach(async function () {
        response = await userHelper.fetch(
          `/user/password/set?passwordResetToken=${token}&email=${email}`
        )
        expect(response.status).to.equal(302)
        expect(response.headers.get('location')).to.equal(
          UserHelper.url(`/user/password/set${emailQuery}`).toString()
        )
        // send reset request
        response = await userHelper.fetch('/user/password/set', {
          method: 'POST',
          body: new URLSearchParams({
            passwordResetToken: token,
            password: 'a-password',
          }),
        })
        userHelper = await UserHelper.getUser({ email })
        user = userHelper.user
      })
      it('updates the password', function () {
        expect(user.hashedPassword).to.exist
        expect(user.password).to.not.exist
      })
      it('log the change', async function () {
        const auditLog = userHelper.getAuditLogWithoutNoise()
        expect(auditLog).to.exist
        expect(auditLog[0]).to.exist
        expect(auditLog[0].initiatorId).to.equal(null)
        expect(auditLog[0].operation).to.equal('reset-password')
        expect(auditLog[0].ipAddress).to.equal('127.0.0.1')
        expect(auditLog[0].timestamp).to.exist
      })
    })
    describe('password checks', function () {
      beforeEach(async function () {
        response = await userHelper.fetch(
          `/user/password/set?passwordResetToken=${token}&email=${email}`
        )
        expect(response.status).to.equal(302)
        expect(response.headers.get('location')).to.equal(
          UserHelper.url(`/user/password/set${emailQuery}`).toString()
        )
      })
      it('without a password should return 400 and not log the change', async function () {
        // send reset request
        response = await userHelper.fetch('/user/password/set', {
          method: 'POST',
          body: new URLSearchParams({
            passwordResetToken: token,
          }),
        })
        expect(response.status).to.equal(400)
        userHelper = await UserHelper.getUser({ email })

        const auditLog = userHelper.getAuditLogWithoutNoise()
        expect(auditLog).to.deep.equal([])
      })

      it('without a valid password should return 400 and not log the change', async function () {
        // send reset request
        response = await userHelper.fetch('/user/password/set', {
          method: 'POST',
          body: new URLSearchParams({
            passwordResetToken: token,
            password: 'short',
          }),
        })
        expect(response.status).to.equal(400)
        userHelper = await UserHelper.getUser({ email })

        const auditLog = userHelper.getAuditLogWithoutNoise()
        expect(auditLog).to.deep.equal([])
      })

      it('should flag email in password', async function () {
        const localPart = email.split('@').shift()
        // send bad password
        response = await userHelper.fetch('/user/password/set', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            passwordResetToken: token,
            password: localPart,
            email,
          }),
        })
        expect(response.status).to.equal(400)
        const body = await response.json()
        expect(body).to.deep.equal({
          message: {
            type: 'error',
            key: 'password-contains-email',
            text: 'Password cannot contain parts of email address',
          },
        })
      })

      it('should flag password too similar to email', async function () {
        const localPart = email.split('@').shift()
        const localPartReversed = localPart.split('').reverse().join('')
        // send bad password
        response = await userHelper.fetch('/user/password/set', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            passwordResetToken: token,
            password: `${localPartReversed}123`,
            email,
          }),
        })
        expect(response.status).to.equal(400)
        const body = await response.json()
        expect(body).to.deep.equal({
          message: {
            type: 'error',
            key: 'password-too-similar',
            text: 'Password is too similar to parts of email address',
          },
        })
      })

      it('should be able to retry after providing an invalid password', async function () {
        // send bad password
        response = await userHelper.fetch('/user/password/set', {
          method: 'POST',
          body: new URLSearchParams({
            passwordResetToken: token,
            password: 'short',
          }),
        })
        expect(response.status).to.equal(400)

        // send good password
        response = await userHelper.fetch('/user/password/set', {
          method: 'POST',
          body: new URLSearchParams({
            passwordResetToken: token,
            password: 'SomeThingVeryStrong!11',
          }),
        })
        expect(response.status).to.equal(200)
        userHelper = await UserHelper.getUser({ email })

        const auditLog = userHelper.getAuditLogWithoutNoise()
        expect(auditLog.length).to.equal(1)
      })

      it('when the password is the same as current, should return 400 and log the change', async function () {
        // send reset request
        response = await userHelper.fetch('/user/password/set', {
          method: 'POST',
          body: new URLSearchParams({
            passwordResetToken: token,
            password: userHelper.getDefaultPassword(),
          }),
        })
        expect(response.status).to.equal(400)
        const body = await response.json()
        expect(body.message.key).to.equal('password-must-be-different')
        userHelper = await UserHelper.getUser({ email })

        const auditLog = userHelper.getAuditLogWithoutNoise()
        expect(auditLog.length).to.equal(1)
      })
    })
  })

  describe('multiple attempts to set the password, reaching attempt limit', async function () {
    beforeEach(async function () {
      response = await userHelper.fetch(
        `/user/password/set?passwordResetToken=${token}&email=${email}`
      )
      expect(response.status).to.equal(302)
      expect(response.headers.get('location')).to.equal(
        UserHelper.url(`/user/password/set${emailQuery}`).toString()
      )
    })

    it('should allow multiple attempts with same-password error, then deny further attempts', async function () {
      const sendSamePasswordRequest = async function () {
        return userHelper.fetch('/user/password/set', {
          method: 'POST',
          headers: {
            Accept: 'application/json',
          },
          body: new URLSearchParams({
            passwordResetToken: token,
            password: userHelper.getDefaultPassword(),
          }),
        })
      }
      // Three attempts at setting the password, all rejected for being the same as
      // the current password
      const response1 = await sendSamePasswordRequest()
      expect(response1.status).to.equal(400)
      const body1 = await response1.json()
      expect(body1.message.key).to.equal('password-must-be-different')
      const response2 = await sendSamePasswordRequest()
      expect(response2.status).to.equal(400)
      const body2 = await response2.json()
      expect(body2.message.key).to.equal('password-must-be-different')
      const response3 = await sendSamePasswordRequest()
      expect(response3.status).to.equal(400)
      const body3 = await response3.json()
      expect(body3.message.key).to.equal('password-must-be-different')
      // Fourth attempt is rejected because the token has been used too many times
      const response4 = await sendSamePasswordRequest()
      expect(response4.status).to.equal(404)
      const body4 = await response4.json()
      expect(body4.message.key).to.equal('token-expired')
    })

    it('should allow multiple attempts with same-password error, then set the password', async function () {
      const sendSamePasswordRequest = async function () {
        return userHelper.fetch('/user/password/set', {
          method: 'POST',
          headers: {
            Accept: 'application/json',
          },
          body: new URLSearchParams({
            passwordResetToken: token,
            password: userHelper.getDefaultPassword(),
          }),
        })
      }
      // Two attempts at setting the password, all rejected for being the same as
      // the current password
      const response1 = await sendSamePasswordRequest()
      expect(response1.status).to.equal(400)
      const body1 = await response1.json()
      expect(body1.message.key).to.equal('password-must-be-different')
      const response2 = await sendSamePasswordRequest()
      expect(response2.status).to.equal(400)
      const body2 = await response2.json()
      expect(body2.message.key).to.equal('password-must-be-different')
      // Third attempt is succeeds
      const response3 = await userHelper.fetch('/user/password/set', {
        method: 'POST',
        body: new URLSearchParams({
          passwordResetToken: token,
          password: 'some-new-password',
        }),
      })
      expect(response3.status).to.equal(200)
      // Check the user and audit log
      userHelper = await UserHelper.getUser({ email })
      user = userHelper.user
      expect(user.hashedPassword).to.exist
      expect(user.password).to.not.exist
      const auditLog = userHelper.getAuditLogWithoutNoise()
      expect(auditLog).to.exist
      expect(auditLog[0]).to.exist
      expect(auditLog[0].initiatorId).to.equal(null)
      expect(auditLog[0].operation).to.equal('reset-password')
      expect(auditLog[0].ipAddress).to.equal('127.0.0.1')
      expect(auditLog[0].timestamp).to.exist
    })
  })

  describe('without a valid token', function () {
    it('no token should redirect to page to re-request reset token', async function () {
      response = await userHelper.fetch(`/user/password/set?&email=${email}`)
      expect(response.status).to.equal(302)
      expect(response.headers.get('location')).to.equal(
        UserHelper.url('/user/password/reset').toString()
      )
    })
    it('should show error for invalid tokens and return 404 if used', async function () {
      const invalidToken = 'not-real-token'
      response = await userHelper.fetch(
        `/user/password/set?&passwordResetToken=${invalidToken}&email=${email}`
      )
      expect(response.status).to.equal(302)
      expect(response.headers.get('location')).to.equal(
        UserHelper.url('/user/password/reset?error=token_expired').toString()
      )
      // send reset request
      response = await userHelper.fetch('/user/password/set', {
        method: 'POST',
        body: new URLSearchParams({
          passwordResetToken: invalidToken,
          password: 'a-password',
        }),
      })
      expect(response.status).to.equal(404)
    })
  })
  describe('password reset', function () {
    it('should return 200 if email field is valid', async function () {
      response = await userHelper.fetch(`/user/password/reset`, {
        method: 'POST',
        body: new URLSearchParams({ email }),
      })
      expect(response.status).to.equal(200)
    })

    it('should return 400 if email field is missing', async function () {
      response = await userHelper.fetch(`/user/password/reset`, {
        method: 'POST',
        body: new URLSearchParams({ mail: email }),
      })
      expect(response.status).to.equal(400)
    })
  })
  describe('password set', function () {
    it('should return 200 if password and passwordResetToken fields are valid', async function () {
      response = await userHelper.fetch(`/user/password/set`, {
        method: 'POST',
        body: new URLSearchParams({
          password: 'new-password',
          passwordResetToken: token,
        }),
      })
      expect(response.status).to.equal(200)
    })

    it('should return 400 if password field is missing', async function () {
      response = await userHelper.fetch(`/user/password/set`, {
        method: 'POST',
        body: new URLSearchParams({
          passwordResetToken: token,
        }),
      })
      expect(response.status).to.equal(400)
    })

    it('should return 400 if passwordResetToken field is missing', async function () {
      response = await userHelper.fetch(`/user/password/set`, {
        method: 'POST',
        body: new URLSearchParams({
          password: 'new-password',
        }),
      })
      expect(response.status).to.equal(400)
    })
  })

  describe('reconfirm flag', function () {
    const getReconfirmAuditLogEntry = async function (email) {
      const userHelper = await UserHelper.getUser({ email })
      const auditLog = userHelper.getAuditLogWithoutNoise()
      return auditLog.find(
        entry => entry.operation === 'must-reset-password-unset'
      )
    }
    it('should add audit log entry when flag changes from true to false', async function () {
      // Set must_reconfirm to true
      await db.users.updateOne(
        { _id: user._id },
        { $set: { must_reconfirm: true } }
      )
      response = await userHelper.fetch('/user/password/set', {
        method: 'POST',
        body: new URLSearchParams({
          passwordResetToken: token,
          password: 'a-password',
        }),
      })
      expect(response.status).to.equal(200)

      const reconfirmEntry = await getReconfirmAuditLogEntry(email)
      expect(reconfirmEntry).to.exist
      expect(reconfirmEntry.ipAddress).to.equal('127.0.0.1')
      expect(reconfirmEntry.timestamp).to.exist
    })

    it('should not add audit log entry when flag was already false', async function () {
      await db.users.updateOne(
        { _id: user._id },
        { $set: { must_reconfirm: false } }
      )

      response = await userHelper.fetch('/user/password/set', {
        method: 'POST',
        body: new URLSearchParams({
          passwordResetToken: token,
          password: 'a-password',
        }),
      })
      expect(response.status).to.equal(200)

      const reconfirmEntry = await getReconfirmAuditLogEntry(email)
      expect(reconfirmEntry).to.not.exist
    })
  })
})
