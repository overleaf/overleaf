const { expect } = require('chai')
const async = require('async')
const User = require('./helpers/User')
const redis = require('./helpers/redis')

describe('Sessions', function() {
  beforeEach(function(done) {
    this.timeout(20000)
    this.user1 = new User()
    this.site_admin = new User({ email: 'admin@example.com' })
    async.series(
      [cb => this.user1.login(cb), cb => this.user1.logout(cb)],
      done
    )
  })

  describe('one session', function() {
    it('should have one session in UserSessions set', function(done) {
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
          }
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

  describe('two sessions', function() {
    beforeEach(function() {
      // set up second session for this user
      this.user2 = new User()
      this.user2.email = this.user1.email
      this.user2.password = this.user1.password
    })

    it('should have two sessions in UserSessions set', function(done) {
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
          }
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

  describe('three sessions, password reset', function() {
    beforeEach(function() {
      // set up second session for this user
      this.user2 = new User()
      this.user2.email = this.user1.email
      this.user2.password = this.user1.password
      this.user3 = new User()
      this.user3.email = this.user1.email
      this.user3.password = this.user1.password
    })

    it('should erase both sessions when password is reset', function(done) {
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
            this.user2.changePassword(err => next(err))
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
          }
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

  describe('three sessions, sessions page', function() {
    beforeEach(function(done) {
      // set up second session for this user
      this.user2 = new User()
      this.user2.email = this.user1.email
      this.user2.password = this.user1.password
      this.user3 = new User()
      this.user3.email = this.user1.email
      this.user3.password = this.user1.password
      async.series(
        [
          this.user2.login.bind(this.user2),
          this.user2.activateSudoMode.bind(this.user2)
        ],
        done
      )
    })

    it('should allow the user to erase the other two sessions', function(done) {
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

          // enter sudo-mode
          next => {
            this.user2.getCsrfToken(err => {
              expect(err).to.be.oneOf([null, undefined])
              this.user2.request.post(
                {
                  uri: '/confirm-password',
                  json: {
                    password: this.user2.password
                  }
                },
                (err, response, body) => {
                  expect(err).to.be.oneOf([null, undefined])
                  expect(response.statusCode).to.equal(200)
                  next()
                }
              )
            })
          },

          // check the sessions page
          next => {
            this.user2.request.get(
              {
                uri: '/user/sessions'
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
                  uri: '/user/sessions/clear'
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
            this.user1.get((error, user) => {
              expect(error).not.to.exist
              expect(user.auditLog).to.exist
              expect(user.auditLog[0].operation).to.equal('clear-sessions')
              expect(user.auditLog[0].ipAddress).to.exist
              expect(user.auditLog[0].initiatorId).to.exist
              expect(user.auditLog[0].timestamp).to.exist
              expect(user.auditLog[0].info.sessions.length).to.equal(2)
              next()
            })
          }
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
})
