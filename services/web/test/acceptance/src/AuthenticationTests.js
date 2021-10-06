const { expect } = require('chai')
const { ObjectId } = require('mongodb')
const Settings = require('@overleaf/settings')
const User = require('./helpers/User').promises

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
      const {
        auditLog: [auditLogEntry],
      } = await user.get()
      expect(auditLogEntry).to.exist
      expect(auditLogEntry.timestamp).to.exist
      delete auditLogEntry.timestamp
      expect(auditLogEntry).to.deep.equal({
        operation: 'login',
        ipAddress: '127.0.0.1',
        initiatorId: ObjectId(user.id),
      })
    })
  })

  describe('failed login', function () {
    beforeEach('fetchCsrfToken', async function () {
      await user.getCsrfToken()
    })
    it('should return a 401', async function () {
      const {
        response: { statusCode },
      } = await user.doRequest('POST', {
        url: Settings.enableLegacyLogin ? '/login/legacy' : '/login',
        json: {
          email: user.email,
          password: 'foo-bar-baz',
        },
      })
      expect(statusCode).to.equal(401)
    })
  })
})
