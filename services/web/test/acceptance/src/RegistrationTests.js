/* eslint-disable
    camelcase,
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
 * DS103: Rewrite code to no longer use __guard__
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const { expect } = require('chai')
const { assert } = require('chai')
const async = require('async')
const User = require('./helpers/User')
const request = require('./helpers/request')
const settings = require('settings-sharelatex')
const redis = require('./helpers/redis')
const _ = require('lodash')

// Currently this is testing registration via the 'public-registration' module,
// whereas in production we're using the 'overleaf-integration' module.

// Expectations
const expectProjectAccess = function(user, projectId, callback) {
  // should have access to project
  if (callback == null) {
    callback = function(err, result) {}
  }
  return user.openProject(projectId, err => {
    expect(err).to.be.oneOf([null, undefined])
    return callback()
  })
}

const expectNoProjectAccess = function(user, projectId, callback) {
  // should not have access to project page
  if (callback == null) {
    callback = function(err, result) {}
  }
  return user.openProject(projectId, err => {
    expect(err).to.be.instanceof(Error)
    return callback()
  })
}

// Actions
const tryLoginThroughRegistrationForm = function(
  user,
  email,
  password,
  callback
) {
  if (callback == null) {
    callback = function(err, response, body) {}
  }
  return user.getCsrfToken(err => {
    if (err != null) {
      return callback(err)
    }
    return user.request.post(
      {
        url: '/register',
        json: {
          email,
          password
        }
      },
      callback
    )
  })
}

describe('Registration', function() {
  describe('LoginRateLimit', function() {
    beforeEach(function() {
      this.user = new User()
      this.badEmail = 'bademail@example.com'
      return (this.badPassword = 'badpassword')
    })

    it('should rate limit login attempts after 10 within two minutes', function(done) {
      return this.user.request.get('/login', (err, res, body) => {
        return async.timesSeries(
          15,
          (n, cb) => {
            return this.user.getCsrfToken(error => {
              if (error != null) {
                return cb(error)
              }
              return this.user.request.post(
                {
                  url: '/login',
                  json: {
                    email: this.badEmail,
                    password: this.badPassword
                  }
                },
                (err, response, body) => {
                  return cb(
                    null,
                    __guard__(
                      body != null ? body.message : undefined,
                      x => x.text
                    )
                  )
                }
              )
            })
          },
          (err, results) => {
            // ten incorrect-credentials messages, then five rate-limit messages
            expect(results.length).to.equal(15)
            assert.deepEqual(
              results,
              _.concat(
                _.fill(
                  [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
                  'Your email or password is incorrect. Please try again'
                ),
                _.fill(
                  [1, 2, 3, 4, 5],
                  'This account has had too many login requests. Please wait 2 minutes before trying to log in again'
                )
              )
            )
            return done()
          }
        )
      })
    })
  })

  describe('CSRF protection', function() {
    beforeEach(function() {
      this.user = new User()
      this.email = `test+${Math.random()}@example.com`
      return (this.password = 'password11')
    })

    afterEach(function() {
      return this.user.full_delete_user(this.email)
    })

    it('should register with the csrf token', function(done) {
      return this.user.request.get('/login', (err, res, body) => {
        return this.user.getCsrfToken(error => {
          return this.user.request.post(
            {
              url: '/register',
              json: {
                email: this.email,
                password: this.password
              },
              headers: {
                'x-csrf-token': this.user.csrfToken
              }
            },
            (error, response, body) => {
              expect(err != null).to.equal(false)
              expect(response.statusCode).to.equal(200)
              return done()
            }
          )
        })
      })
    })

    it('should fail with no csrf token', function(done) {
      return this.user.request.get('/login', (err, res, body) => {
        return this.user.getCsrfToken(error => {
          return this.user.request.post(
            {
              url: '/register',
              json: {
                email: this.email,
                password: this.password
              },
              headers: {
                'x-csrf-token': ''
              }
            },
            (error, response, body) => {
              expect(response.statusCode).to.equal(403)
              return done()
            }
          )
        })
      })
    })

    it('should fail with a stale csrf token', function(done) {
      return this.user.request.get('/login', (err, res, body) => {
        return this.user.getCsrfToken(error => {
          const oldCsrfToken = this.user.csrfToken
          return this.user.logout(err => {
            return this.user.request.post(
              {
                url: '/register',
                json: {
                  email: this.email,
                  password: this.password
                },
                headers: {
                  'x-csrf-token': oldCsrfToken
                }
              },
              (error, response, body) => {
                expect(response.statusCode).to.equal(403)
                return done()
              }
            )
          })
        })
      })
    })
  })

  describe('Register', function() {
    beforeEach(function() {
      return (this.user = new User())
    })

    it('Set emails attribute', function(done) {
      return this.user.register((error, user) => {
        expect(error).to.not.exist
        user.email.should.equal(this.user.email)
        user.emails.should.exist
        user.emails.should.be.a('array')
        user.emails.length.should.equal(1)
        user.emails[0].email.should.equal(this.user.email)
        return done()
      })
    })
  })

  describe('Register with bonus referal id', function() {
    beforeEach(function(done) {
      this.user1 = new User()
      this.user2 = new User()
      return async.series(
        [
          cb => this.user1.register(cb),
          cb =>
            this.user2.registerWithQuery(
              `?r=${this.user1.referal_id}&rm=d&rs=b`,
              cb
            )
        ],
        done
      )
    })

    it('Adds a referal when an id is supplied and the referal source is "bonus"', function(done) {
      return this.user1.get((error, user) => {
        expect(error).to.not.exist
        user.refered_user_count.should.eql(1)

        return done()
      })
    })
  })

  describe('LoginViaRegistration', function() {
    beforeEach(function(done) {
      this.timeout(60000)
      this.user1 = new User()
      this.user2 = new User()
      async.series(
        [
          cb => this.user1.login(cb),
          cb => this.user1.logout(cb),
          cb => redis.clearUserSessions(this.user1, cb),
          cb => this.user2.login(cb),
          cb => this.user2.logout(cb),
          cb => redis.clearUserSessions(this.user2, cb)
        ],
        done
      )
      return (this.project_id = null)
    })

    describe('[Security] Trying to register/login as another user', function() {
      it('should not allow sign in with secondary email', function(done) {
        const secondaryEmail = 'acceptance-test-secondary@example.com'
        return this.user1.addEmail(secondaryEmail, err => {
          return this.user1.loginWith(secondaryEmail, err => {
            expect(err != null).to.equal(false)
            return this.user1.isLoggedIn((err, isLoggedIn) => {
              expect(isLoggedIn).to.equal(false)
              return done()
            })
          })
        })
      })

      it('should have user1 login and create a project, which user2 cannot access', function(done) {
        let projectId
        async.series(
          [
            // user1 logs in and creates a project which only they can access
            cb => {
              this.user1.login(err => {
                expect(err).not.to.exist
                cb()
              })
            },
            cb => {
              this.user1.createProject('Private Project', (err, id) => {
                expect(err).not.to.exist
                projectId = id
                cb()
              })
            },
            cb => expectProjectAccess(this.user1, projectId, cb),
            cb => expectNoProjectAccess(this.user2, projectId, cb),
            // should prevent user2 from login/register with user1 email address
            cb => {
              tryLoginThroughRegistrationForm(
                this.user2,
                this.user1.email,
                'totally_not_the_right_password',
                (err, response, body) => {
                  expect(body.redir != null).to.equal(false)
                  expect(body.message != null).to.equal(true)
                  expect(body.message).to.have.all.keys('type', 'text')
                  expect(body.message.type).to.equal('error')
                  cb()
                }
              )
            },
            // check user still can't access the project
            cb => expectNoProjectAccess(this.user2, projectId, done)
          ],
          done
        )
      })
    })
  })
})

function __guard__(value, transform) {
  return typeof value !== 'undefined' && value !== null
    ? transform(value)
    : undefined
}
