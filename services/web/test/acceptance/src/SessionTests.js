/* eslint-disable
    handle-callback-err,
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
const { expect } = require('chai')
const async = require('async')
const User = require('./helpers/User')
const request = require('./helpers/request')
const settings = require('settings-sharelatex')
const redis = require('./helpers/redis')
const MockV1Api = require('./helpers/MockV1Api')
const MockTagsApi = require('./helpers/MockTagsApi')

describe('Sessions', function() {
  beforeEach(function(done) {
    this.timeout(20000)
    this.user1 = new User()
    this.site_admin = new User({ email: 'admin@example.com' })
    MockTagsApi.tags[this.user1] = []
    return async.series(
      [cb => this.user1.login(cb), cb => this.user1.logout(cb)],
      done
    )
  })

  describe('one session', function() {
    it('should have one session in UserSessions set', function(done) {
      return async.series(
        [
          next => {
            return redis.clearUserSessions(this.user1, next)
          },

          // login, should add session to set
          next => {
            return this.user1.login(err => next(err))
          },

          next => {
            return redis.getUserSessions(this.user1, (err, sessions) => {
              expect(sessions.length).to.equal(1)
              expect(sessions[0].slice(0, 5)).to.equal('sess:')
              return next()
            })
          },

          // should be able to access project list page
          next => {
            return this.user1.getProjectListPage((err, statusCode) => {
              expect(err).to.equal(null)
              expect(statusCode).to.equal(200)
              return next()
            })
          },

          // logout, should remove session from set
          next => {
            return this.user1.logout(err => next(err))
          },

          next => {
            return redis.getUserSessions(this.user1, (err, sessions) => {
              expect(sessions.length).to.equal(0)
              return next()
            })
          }
        ],
        (err, result) => {
          if (err) {
            throw err
          }
          return done()
        }
      )
    })
  })

  describe('two sessions', function() {
    beforeEach(function() {
      // set up second session for this user
      this.user2 = new User()
      this.user2.email = this.user1.email
      return (this.user2.password = this.user1.password)
    })

    it('should have two sessions in UserSessions set', function(done) {
      return async.series(
        [
          next => {
            return redis.clearUserSessions(this.user1, next)
          },

          // login, should add session to set
          next => {
            return this.user1.login(err => next(err))
          },

          next => {
            return redis.getUserSessions(this.user1, (err, sessions) => {
              expect(sessions.length).to.equal(1)
              expect(sessions[0].slice(0, 5)).to.equal('sess:')
              return next()
            })
          },

          // login again, should add the second session to set
          next => {
            return this.user2.login(err => next(err))
          },

          next => {
            return redis.getUserSessions(this.user1, (err, sessions) => {
              expect(sessions.length).to.equal(2)
              expect(sessions[0].slice(0, 5)).to.equal('sess:')
              expect(sessions[1].slice(0, 5)).to.equal('sess:')
              return next()
            })
          },

          // both should be able to access project list page
          next => {
            return this.user1.getProjectListPage((err, statusCode) => {
              expect(err).to.equal(null)
              expect(statusCode).to.equal(200)
              return next()
            })
          },

          next => {
            return this.user2.getProjectListPage((err, statusCode) => {
              expect(err).to.equal(null)
              expect(statusCode).to.equal(200)
              return next()
            })
          },

          // logout first session, should remove session from set
          next => {
            return this.user1.logout(err => next(err))
          },

          next => {
            return redis.getUserSessions(this.user1, (err, sessions) => {
              expect(sessions.length).to.equal(1)
              return next()
            })
          },

          // first session should not have access to project list page
          next => {
            return this.user1.getProjectListPage((err, statusCode) => {
              expect(err).to.equal(null)
              expect(statusCode).to.equal(302)
              return next()
            })
          },

          // second session should still have access to settings
          next => {
            return this.user2.getProjectListPage((err, statusCode) => {
              expect(err).to.equal(null)
              expect(statusCode).to.equal(200)
              return next()
            })
          },

          // logout second session, should remove last session from set
          next => {
            return this.user2.logout(err => next(err))
          },

          next => {
            return redis.getUserSessions(this.user1, (err, sessions) => {
              expect(sessions.length).to.equal(0)
              return next()
            })
          },

          // second session should not have access to project list page
          next => {
            return this.user2.getProjectListPage((err, statusCode) => {
              expect(err).to.equal(null)
              expect(statusCode).to.equal(302)
              return next()
            })
          }
        ],
        (err, result) => {
          if (err) {
            throw err
          }
          return done()
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
      return (this.user3.password = this.user1.password)
    })

    it('should erase both sessions when password is reset', function(done) {
      return async.series(
        [
          next => {
            return redis.clearUserSessions(this.user1, next)
          },

          // login, should add session to set
          next => {
            return this.user1.login(err => next(err))
          },

          next => {
            return redis.getUserSessions(this.user1, (err, sessions) => {
              expect(sessions.length).to.equal(1)
              expect(sessions[0].slice(0, 5)).to.equal('sess:')
              return next()
            })
          },

          // login again, should add the second session to set
          next => {
            return this.user2.login(err => next(err))
          },

          next => {
            return redis.getUserSessions(this.user1, (err, sessions) => {
              expect(sessions.length).to.equal(2)
              expect(sessions[0].slice(0, 5)).to.equal('sess:')
              expect(sessions[1].slice(0, 5)).to.equal('sess:')
              return next()
            })
          },

          // login third session, should add the second session to set
          next => {
            return this.user3.login(err => next(err))
          },

          next => {
            return redis.getUserSessions(this.user1, (err, sessions) => {
              expect(sessions.length).to.equal(3)
              expect(sessions[0].slice(0, 5)).to.equal('sess:')
              expect(sessions[1].slice(0, 5)).to.equal('sess:')
              return next()
            })
          },

          // password reset from second session, should erase two of the three sessions
          next => {
            return this.user2.changePassword(err => next(err))
          },

          next => {
            return redis.getUserSessions(this.user2, (err, sessions) => {
              expect(sessions.length).to.equal(1)
              return next()
            })
          },

          // users one and three should not be able to access project list page
          next => {
            return this.user1.getProjectListPage((err, statusCode) => {
              expect(err).to.equal(null)
              expect(statusCode).to.equal(302)
              return next()
            })
          },

          next => {
            return this.user3.getProjectListPage((err, statusCode) => {
              expect(err).to.equal(null)
              expect(statusCode).to.equal(302)
              return next()
            })
          },

          // user two should still be logged in, and able to access project list page
          next => {
            return this.user2.getProjectListPage((err, statusCode) => {
              expect(err).to.equal(null)
              expect(statusCode).to.equal(200)
              return next()
            })
          },

          // logout second session, should remove last session from set
          next => {
            return this.user2.logout(err => next(err))
          },

          next => {
            return redis.getUserSessions(this.user1, (err, sessions) => {
              expect(sessions.length).to.equal(0)
              return next()
            })
          }
        ],
        (err, result) => {
          if (err) {
            throw err
          }
          return done()
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
      return async.series(
        [
          this.user2.login.bind(this.user2),
          this.user2.activateSudoMode.bind(this.user2)
        ],
        done
      )
    })

    it('should allow the user to erase the other two sessions', function(done) {
      return async.series(
        [
          next => {
            return redis.clearUserSessions(this.user1, next)
          },

          // login, should add session to set
          next => {
            return this.user1.login(err => next(err))
          },

          next => {
            return redis.getUserSessions(this.user1, (err, sessions) => {
              expect(sessions.length).to.equal(1)
              expect(sessions[0].slice(0, 5)).to.equal('sess:')
              return next()
            })
          },

          // login again, should add the second session to set
          next => {
            return this.user2.login(err => next(err))
          },

          next => {
            return redis.getUserSessions(this.user1, (err, sessions) => {
              expect(sessions.length).to.equal(2)
              expect(sessions[0].slice(0, 5)).to.equal('sess:')
              expect(sessions[1].slice(0, 5)).to.equal('sess:')
              return next()
            })
          },

          // login third session, should add the second session to set
          next => {
            return this.user3.login(err => next(err))
          },

          next => {
            return redis.getUserSessions(this.user1, (err, sessions) => {
              expect(sessions.length).to.equal(3)
              expect(sessions[0].slice(0, 5)).to.equal('sess:')
              expect(sessions[1].slice(0, 5)).to.equal('sess:')
              return next()
            })
          },

          // enter sudo-mode
          next => {
            return this.user2.getCsrfToken(err => {
              expect(err).to.be.oneOf([null, undefined])
              return this.user2.request.post(
                {
                  uri: '/confirm-password',
                  json: {
                    password: this.user2.password
                  }
                },
                (err, response, body) => {
                  expect(err).to.be.oneOf([null, undefined])
                  expect(response.statusCode).to.equal(200)
                  return next()
                }
              )
            })
          },

          // check the sessions page
          next => {
            return this.user2.request.get(
              {
                uri: '/user/sessions'
              },
              (err, response, body) => {
                expect(err).to.be.oneOf([null, undefined])
                expect(response.statusCode).to.equal(200)
                return next()
              }
            )
          },

          // clear sessions from second session, should erase two of the three sessions
          next => {
            return this.user2.getCsrfToken(err => {
              expect(err).to.be.oneOf([null, undefined])
              return this.user2.request.post(
                {
                  uri: '/user/sessions/clear'
                },
                err => next(err)
              )
            })
          },

          next => {
            return redis.getUserSessions(this.user2, (err, sessions) => {
              expect(sessions.length).to.equal(1)
              return next()
            })
          },

          // users one and three should not be able to access project list page
          next => {
            return this.user1.getProjectListPage((err, statusCode) => {
              expect(err).to.equal(null)
              expect(statusCode).to.equal(302)
              return next()
            })
          },

          next => {
            return this.user3.getProjectListPage((err, statusCode) => {
              expect(err).to.equal(null)
              expect(statusCode).to.equal(302)
              return next()
            })
          },

          // user two should still be logged in, and able to access project list page
          next => {
            return this.user2.getProjectListPage((err, statusCode) => {
              expect(err).to.equal(null)
              expect(statusCode).to.equal(200)
              return next()
            })
          },

          // logout second session, should remove last session from set
          next => {
            return this.user2.logout(err => next(err))
          },

          next => {
            return redis.getUserSessions(this.user1, (err, sessions) => {
              expect(sessions.length).to.equal(0)
              return next()
            })
          }
        ],
        (err, result) => {
          if (err) {
            throw err
          }
          return done()
        }
      )
    })
  })
})
