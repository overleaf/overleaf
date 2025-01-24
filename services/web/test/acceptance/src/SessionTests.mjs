import { expect } from 'chai'
import async from 'async'
import UserHelper from './helpers/User.mjs'
import redis from './helpers/redis.mjs'
import UserSessionsRedis from '../../../app/src/Features/User/UserSessionsRedis.js'
const rclient = UserSessionsRedis.client()

describe('Sessions', function () {
  beforeEach(function (done) {
    this.timeout(20000)
    this.user1 = new UserHelper()
    this.site_admin = new UserHelper({ email: 'admin@example.com' })
    async.series(
      [cb => this.user1.login(cb), cb => this.user1.logout(cb)],
      done
    )
  })

  describe('one session', function () {
    it('should have one session in UserSessions set', function (done) {
      async.series(
        [
          next => {
            redis.clearUserSessions(this.user1, next)
          },

          // login, should add session to set
          next => {
            this.user1.login(err => next(err))
          },

          next => {
            redis.getUserSessions(this.user1, (err, sessions) => {
              expect(err).to.not.exist
              expect(sessions.length).to.equal(1)
              expect(sessions[0].slice(0, 5)).to.equal('sess:')
              next()
            })
          },

          // should be able to access project list page
          next => {
            this.user1.getProjectListPage((err, statusCode) => {
              expect(err).to.equal(null)
              expect(statusCode).to.equal(200)
              next()
            })
          },

          // logout, should remove session from set
          next => {
            this.user1.logout(err => next(err))
          },

          next => {
            redis.getUserSessions(this.user1, (err, sessions) => {
              expect(err).to.not.exist
              expect(sessions.length).to.equal(0)
              next()
            })
          },
        ],
        (err, result) => {
          if (err) {
            throw err
          }
          done()
        }
      )
    })
  })

  describe('two sessions', function () {
    beforeEach(function () {
      // set up second session for this user
      this.user2 = new UserHelper()
      this.user2.email = this.user1.email
      this.user2.emails = this.user1.emails
      this.user2.password = this.user1.password
    })

    it('should have two sessions in UserSessions set', function (done) {
      async.series(
        [
          next => {
            redis.clearUserSessions(this.user1, next)
          },

          // login, should add session to set
          next => {
            this.user1.login(err => next(err))
          },

          next => {
            redis.getUserSessions(this.user1, (err, sessions) => {
              expect(err).to.not.exist
              expect(sessions.length).to.equal(1)
              expect(sessions[0].slice(0, 5)).to.equal('sess:')
              next()
            })
          },

          // login again, should add the second session to set
          next => {
            this.user2.login(err => next(err))
          },

          next => {
            redis.getUserSessions(this.user1, (err, sessions) => {
              expect(err).to.not.exist
              expect(sessions.length).to.equal(2)
              expect(sessions[0].slice(0, 5)).to.equal('sess:')
              expect(sessions[1].slice(0, 5)).to.equal('sess:')
              next()
            })
          },

          // both should be able to access project list page
          next => {
            this.user1.getProjectListPage((err, statusCode) => {
              expect(err).to.equal(null)
              expect(statusCode).to.equal(200)
              next()
            })
          },

          next => {
            this.user2.getProjectListPage((err, statusCode) => {
              expect(err).to.equal(null)
              expect(statusCode).to.equal(200)
              next()
            })
          },

          // logout first session, should remove session from set
          next => {
            this.user1.logout(err => next(err))
          },

          next => {
            redis.getUserSessions(this.user1, (err, sessions) => {
              expect(err).to.not.exist
              expect(sessions.length).to.equal(1)
              next()
            })
          },

          // first session should not have access to project list page
          next => {
            this.user1.getProjectListPage((err, statusCode) => {
              expect(err).to.equal(null)
              expect(statusCode).to.equal(302)
              next()
            })
          },

          // second session should still have access to settings
          next => {
            this.user2.getProjectListPage((err, statusCode) => {
              expect(err).to.equal(null)
              expect(statusCode).to.equal(200)
              next()
            })
          },

          // logout second session, should remove last session from set
          next => {
            this.user2.logout(err => next(err))
          },

          next => {
            redis.getUserSessions(this.user1, (err, sessions) => {
              expect(err).to.not.exist
              expect(sessions.length).to.equal(0)
              next()
            })
          },

          // second session should not have access to project list page
          next => {
            this.user2.getProjectListPage((err, statusCode) => {
              expect(err).to.equal(null)
              expect(statusCode).to.equal(302)
              next()
            })
          },
        ],
        (err, result) => {
          if (err) {
            throw err
          }
          done()
        }
      )
    })
  })

  describe('three sessions, password reset', function () {
    beforeEach(function () {
      // set up second session for this user
      this.user2 = new UserHelper()
      this.user2.email = this.user1.email
      this.user2.emails = this.user1.emails
      this.user2.password = this.user1.password
      this.user3 = new UserHelper()
      this.user3.email = this.user1.email
      this.user3.emails = this.user1.emails
      this.user3.password = this.user1.password
    })

    it('should erase both sessions when password is reset', function (done) {
      async.series(
        [
          next => {
            redis.clearUserSessions(this.user1, next)
          },

          // login, should add session to set
          next => {
            this.user1.login(err => next(err))
          },

          next => {
            redis.getUserSessions(this.user1, (err, sessions) => {
              expect(err).to.not.exist
              expect(sessions.length).to.equal(1)
              expect(sessions[0].slice(0, 5)).to.equal('sess:')
              next()
            })
          },

          // login again, should add the second session to set
          next => {
            this.user2.login(err => next(err))
          },

          next => {
            redis.getUserSessions(this.user1, (err, sessions) => {
              expect(err).to.not.exist
              expect(sessions.length).to.equal(2)
              expect(sessions[0].slice(0, 5)).to.equal('sess:')
              expect(sessions[1].slice(0, 5)).to.equal('sess:')
              next()
            })
          },

          // login third session, should add the second session to set
          next => {
            this.user3.login(err => next(err))
          },

          next => {
            redis.getUserSessions(this.user1, (err, sessions) => {
              expect(err).to.not.exist
              expect(sessions.length).to.equal(3)
              expect(sessions[0].slice(0, 5)).to.equal('sess:')
              expect(sessions[1].slice(0, 5)).to.equal('sess:')
              next()
            })
          },

          // password reset from second session, should erase two of the three sessions
          next => {
            this.user2.changePassword(`password${Date.now()}`, err => next(err))
          },

          next => {
            redis.getUserSessions(this.user2, (err, sessions) => {
              expect(err).to.not.exist
              expect(sessions.length).to.equal(1)
              next()
            })
          },

          // users one and three should not be able to access project list page
          next => {
            this.user1.getProjectListPage((err, statusCode) => {
              expect(err).to.equal(null)
              expect(statusCode).to.equal(302)
              next()
            })
          },

          next => {
            this.user3.getProjectListPage((err, statusCode) => {
              expect(err).to.equal(null)
              expect(statusCode).to.equal(302)
              next()
            })
          },

          // user two should still be logged in, and able to access project list page
          next => {
            this.user2.getProjectListPage((err, statusCode) => {
              expect(err).to.equal(null)
              expect(statusCode).to.equal(200)
              next()
            })
          },

          // logout second session, should remove last session from set
          next => {
            this.user2.logout(err => next(err))
          },

          next => {
            redis.getUserSessions(this.user1, (err, sessions) => {
              expect(err).to.not.exist
              expect(sessions.length).to.equal(0)
              next()
            })
          },
        ],
        (err, result) => {
          if (err) {
            throw err
          }
          done()
        }
      )
    })
  })

  describe('three sessions, sessions page', function () {
    beforeEach(function (done) {
      // set up second session for this user
      this.user2 = new UserHelper()
      this.user2.email = this.user1.email
      this.user2.emails = this.user1.emails
      this.user2.password = this.user1.password
      this.user3 = new UserHelper()
      this.user3.email = this.user1.email
      this.user3.emails = this.user1.emails
      this.user3.password = this.user1.password
      async.series([this.user2.login.bind(this.user2)], done)
    })

    it('should allow the user to erase the other two sessions', function (done) {
      async.series(
        [
          next => {
            redis.clearUserSessions(this.user1, next)
          },

          // login, should add session to set
          next => {
            this.user1.login(err => next(err))
          },

          next => {
            redis.getUserSessions(this.user1, (err, sessions) => {
              expect(err).to.not.exist
              expect(sessions.length).to.equal(1)
              expect(sessions[0].slice(0, 5)).to.equal('sess:')
              next()
            })
          },

          // login again, should add the second session to set
          next => {
            this.user2.login(err => next(err))
          },

          next => {
            redis.getUserSessions(this.user1, (err, sessions) => {
              expect(err).to.not.exist
              expect(sessions.length).to.equal(2)
              expect(sessions[0].slice(0, 5)).to.equal('sess:')
              expect(sessions[1].slice(0, 5)).to.equal('sess:')
              next()
            })
          },

          // login third session, should add the second session to set
          next => {
            this.user3.login(err => next(err))
          },

          next => {
            redis.getUserSessions(this.user1, (err, sessions) => {
              expect(err).to.not.exist
              expect(sessions.length).to.equal(3)
              expect(sessions[0].slice(0, 5)).to.equal('sess:')
              expect(sessions[1].slice(0, 5)).to.equal('sess:')
              next()
            })
          },

          // check the sessions page
          next => {
            this.user2.request.get(
              {
                uri: '/user/sessions',
              },
              (err, response, body) => {
                expect(err).to.be.oneOf([null, undefined])
                expect(response.statusCode).to.equal(200)
                next()
              }
            )
          },

          // clear sessions from second session, should erase two of the three sessions
          next => {
            this.user2.getCsrfToken(err => {
              expect(err).to.be.oneOf([null, undefined])
              this.user2.request.post(
                {
                  uri: '/user/sessions/clear',
                },
                err => next(err)
              )
            })
          },

          next => {
            redis.getUserSessions(this.user2, (err, sessions) => {
              expect(err).to.not.exist
              expect(sessions.length).to.equal(1)
              next()
            })
          },

          // users one and three should not be able to access project list page
          next => {
            this.user1.getProjectListPage((err, statusCode) => {
              expect(err).to.equal(null)
              expect(statusCode).to.equal(302)
              next()
            })
          },

          next => {
            this.user3.getProjectListPage((err, statusCode) => {
              expect(err).to.equal(null)
              expect(statusCode).to.equal(302)
              next()
            })
          },

          // user two should still be logged in, and able to access project list page
          next => {
            this.user2.getProjectListPage((err, statusCode) => {
              expect(err).to.equal(null)
              expect(statusCode).to.equal(200)
              next()
            })
          },

          // logout second session, should remove last session from set
          next => {
            this.user2.logout(err => next(err))
          },

          next => {
            redis.getUserSessions(this.user1, (err, sessions) => {
              expect(err).to.not.exist
              expect(sessions.length).to.equal(0)
              next()
            })
          },

          // the user audit log should have been updated
          next => {
            this.user1.getAuditLogWithoutNoise((error, auditLog) => {
              expect(error).not.to.exist
              expect(auditLog).to.exist
              expect(auditLog[0].operation).to.equal('clear-sessions')
              expect(auditLog[0].ipAddress).to.exist
              expect(auditLog[0].initiatorId).to.exist
              expect(auditLog[0].timestamp).to.exist
              expect(auditLog[0].info.sessions.length).to.equal(2)
              next()
            })
          },
        ],
        (err, result) => {
          if (err) {
            throw err
          }
          done()
        }
      )
    })
  })

  describe('validationToken', function () {
    const User = UserHelper.promises

    async function tryWithValidationToken(validationToken) {
      const user = new User()
      await user.login()

      await checkSessionIsValid(user)

      const [, sid] = user.sessionCookie().value.match(/^s:(.+?)\./)
      const key = `sess:${sid}`
      const sess = JSON.parse(await rclient.get(key))

      expect(sess.validationToken).to.equal('v1:' + sid.slice(-4))

      sess.validationToken = validationToken
      await rclient.set(key, JSON.stringify(sess))

      {
        // The current code destroys the session and throws an error/500.
        // Check for login redirect on page reload.
        await user.doRequest('GET', '/project')

        const { response } = await user.doRequest('GET', '/project')
        expect(response.statusCode).to.equal(302)
        expect(response.headers.location).to.equal('/login?')
      }
    }

    async function getOtherUsersValidationToken() {
      const otherUser = new User()
      await otherUser.login()
      await checkSessionIsValid(otherUser)
      const { validationToken } = await otherUser.getSession()
      expect(validationToken).to.match(/^v1:.{4}$/)
      return validationToken
    }
    async function checkSessionIsValid(user) {
      const { response } = await user.doRequest('GET', '/project')
      expect(response.statusCode).to.equal(200)
    }

    it('should reject the redis value when missing', async function () {
      await tryWithValidationToken(undefined)
    })
    it('should reject the redis value when empty', async function () {
      await tryWithValidationToken('')
    })
    it('should reject the redis value when out of sync', async function () {
      await tryWithValidationToken(await getOtherUsersValidationToken())
    })
    it('should ignore overwrites in app code', async function () {
      const otherUsersValidationToken = await getOtherUsersValidationToken()

      const user = new User()
      await user.login()
      await checkSessionIsValid(user)

      const { validationToken: token1 } = await user.getSession()
      const allowedUpdateValue = 'allowed-update-value'
      await user.setInSession({
        validationToken: otherUsersValidationToken,
        // also update another field to check that the write operation went through
        allowedUpdate: allowedUpdateValue,
      })
      const { validationToken: token2, allowedUpdate } = await user.getSession()
      expect(allowedUpdate).to.equal(allowedUpdateValue)
      expect(token1).to.equal(token2)

      await checkSessionIsValid(user)
    })
  })
})
