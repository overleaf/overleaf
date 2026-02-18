import { expect } from 'chai'
import mongodb from 'mongodb-legacy'
import Settings from '@overleaf/settings'
import UserHelper from './helpers/User.mjs'

const ObjectId = mongodb.ObjectId

const User = UserHelper.promises

describe('Authentication', function () {
  let user
  beforeEach('init vars', function () {
    user = new User()
  })

  describe('CSRF regeneration on login', function () {
    it('should prevent use of csrf token from before login', function (done) {
      user.logout(err => {
        if (err) {
          return done(err)
        }
        user.getCsrfToken(err => {
          if (err) {
            return done(err)
          }
          const oldToken = user.csrfToken
          user.login(err => {
            if (err) {
              return done(err)
            }
            expect(oldToken === user.csrfToken).to.equal(false)
            user.request.post(
              {
                headers: {
                  'x-csrf-token': oldToken,
                },
                url: '/project/new',
                json: { projectName: 'test' },
              },
              (err, response, body) => {
                expect(err).to.not.exist
                expect(response.statusCode).to.equal(403)
                expect(body).to.equal('Forbidden')
                done()
              }
            )
          })
        })
      })
    })
  })

  describe('login', function () {
    beforeEach('doLogin', async function () {
      await user.login()
    })

    it('should log the user in', async function () {
      const {
        response: { statusCode },
      } = await user.doRequest('GET', '/project')
      expect(statusCode).to.equal(200)
    })

    it('should emit an user auditLog entry for the login', async function () {
      const auditLog = await user.getAuditLog()
      const auditLogEntry = auditLog[0]
      expect(auditLogEntry).to.exist
      expect(auditLogEntry.timestamp).to.exist
      expect(auditLogEntry.initiatorId).to.deep.equal(new ObjectId(user.id))
      expect(auditLogEntry.userId).to.deep.equal(new ObjectId(user.id))
      expect(auditLogEntry.operation).to.equal('login')
      expect(auditLogEntry.info).to.deep.equal({
        method: 'Password login',
        captcha: 'solved',
        fromKnownDevice: false,
      })
      expect(auditLogEntry.ipAddress).to.equal('127.0.0.1')
    })
  })

  describe('failed login', function () {
    beforeEach('fetchCsrfToken', async function () {
      await user.login()
      await user.logout()
      await user.getCsrfToken()
    })
    it('should return a 401, and add an entry to the audit log', async function () {
      const {
        response: { statusCode },
      } = await user.doRequest('POST', {
        url: Settings.enableLegacyLogin ? '/login/legacy' : '/login',
        json: {
          email: user.email,
          password: 'foo-bar-baz',
          'g-recaptcha-response': 'valid',
        },
      })
      expect(statusCode).to.equal(401)
      const auditLog = await user.getAuditLog()
      const auditLogEntry = auditLog.pop()
      expect(auditLogEntry).to.exist
      expect(auditLogEntry.timestamp).to.exist
      expect(auditLogEntry.initiatorId).to.deep.equal(new ObjectId(user.id))
      expect(auditLogEntry.userId).to.deep.equal(new ObjectId(user.id))
      expect(auditLogEntry.operation).to.equal('failed-password-match')
      expect(auditLogEntry.info).to.deep.equal({
        method: 'Password login',
        fromKnownDevice: true,
      })
      expect(auditLogEntry.ipAddress).to.equal('127.0.0.1')
    })
  })

  describe('rate-limit', function () {
    const RATE_LIMIT = 10

    beforeEach('fetchCsrfToken', async function () {
      await user.login()
      await user.logout()
      await user.getCsrfToken()
    })
    async function tryLogin(i = 0, prefix = '') {
      const { statusCode } = await tryLoginWithEmail(
        `${prefix}${user.email}${' '.repeat(i)}`
      )
      return statusCode
    }
    async function tryLoginWithEmail(email) {
      const {
        response: { statusCode },
        body,
      } = await user.doRequest('POST', {
        url: Settings.enableLegacyLogin ? '/login/legacy' : '/login',
        json: {
          email,
          password: 'wrong-password',
          'g-recaptcha-response': 'valid',
        },
      })
      return { statusCode, body }
    }
    it('should return 429 after 10 unsuccessful login attempts', async function () {
      for (let i = 0; i < RATE_LIMIT; i++) {
        const statusCode = await tryLogin()
        expect(statusCode).to.equal(401)
      }
      for (let i = 0; i < 10; i++) {
        const statusCode = await tryLogin()
        expect(statusCode).to.equal(429)
      }
    })
    it('ignore extra spaces in email address', async function () {
      for (let i = 0; i < RATE_LIMIT; i++) {
        const statusCode = await tryLogin(i)
        expect(statusCode).to.equal(401)
      }
      for (let i = 0; i < 10; i++) {
        const statusCode = await tryLogin(i)
        expect(statusCode).to.equal(429)
      }
    })
    it('normalizes the email address', async function () {
      for (let i = 0; i < RATE_LIMIT / 2; i++) {
        const statusCode = await tryLogin(i, 'x') // lower
        expect(statusCode).to.equal(401)
      }
      for (let i = 0; i < RATE_LIMIT / 2; i++) {
        const statusCode = await tryLogin(i, 'X') // upper
        expect(statusCode).to.equal(401)
      }
      // combined, they exceed the rate-limit
      for (let i = 0; i < 10; i++) {
        const statusCode = await tryLogin(i, 'x')
        expect(statusCode).to.equal(429)
      }
    })
    it('should return 400 with bad email (missing @)', async function () {
      const { statusCode, body } = await tryLoginWithEmail('foo')
      expect(statusCode).to.equal(400)
      expect(body).to.deep.equal({
        name: 'ZodValidationError',
        details: [
          { code: 'custom', path: [], message: 'Invalid email address' },
        ],
        statusCode: 400,
      })
    })
    it('should return 400 with bad email (number)', async function () {
      const { statusCode, body } = await tryLoginWithEmail(1)
      expect(statusCode).to.equal(400)
      expect(body).to.deep.equal({
        name: 'ZodValidationError',
        details: [
          {
            expected: 'string',
            code: 'invalid_type',
            path: [],
            message: 'Invalid input: expected string, received number',
          },
        ],
        statusCode: 400,
      })
    })
  })
})
