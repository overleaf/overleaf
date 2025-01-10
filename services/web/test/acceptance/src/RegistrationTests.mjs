import { expect } from 'chai'
import async from 'async'
import metrics from './helpers/metrics.mjs'
import User from './helpers/User.mjs'
import redis from './helpers/redis.mjs'
import Features from '../../../app/src/infrastructure/Features.js'

const UserPromises = User.promises

// Expectations
const expectProjectAccess = function (user, projectId, callback) {
  // should have access to project
  user.openProject(projectId, err => {
    expect(err).to.be.oneOf([null, undefined])
    return callback()
  })
}

const expectNoProjectAccess = function (user, projectId, callback) {
  // should not have access to project page
  user.openProject(projectId, err => {
    expect(err).to.be.instanceof(Error)
    return callback()
  })
}

// Actions
const tryLoginThroughRegistrationForm = function (
  user,
  email,
  password,
  callback
) {
  user.getCsrfToken(err => {
    if (err != null) {
      return callback(err)
    }
    user.request.post(
      {
        url: '/register',
        json: {
          email,
          password,
        },
      },
      callback
    )
  })
}

describe('Registration', function () {
  describe('LoginRateLimit', function () {
    let userA
    beforeEach(function () {
      userA = new UserPromises()
    })
    function loginRateLimited(line) {
      return line.includes('rate_limit_hit') && line.includes('login')
    }
    async function getLoginRateLimitHitMetricValue() {
      return await metrics.promises.getMetric(loginRateLimited)
    }
    let beforeCount
    beforeEach('get baseline metric value', async function () {
      beforeCount = await getLoginRateLimitHitMetricValue()
    })
    beforeEach('setup csrf token', async function () {
      await userA.getCsrfToken()
    })

    describe('pushing an account just below the rate limit', function () {
      async function doLoginAttempts(user, n, pushInto) {
        while (n--) {
          const { body } = await user.doRequest('POST', {
            url: '/login',
            json: {
              email: user.email,
              password: 'invalid-password',
              'g-recaptcha-response': 'valid',
            },
          })
          const message = body && body.message && body.message.key
          pushInto.push(message)
        }
      }

      let results = []
      beforeEach('do 9 login attempts', async function () {
        results = []
        await doLoginAttempts(userA, 9, results)
      })

      it('should not record any rate limited requests', async function () {
        const afterCount = await getLoginRateLimitHitMetricValue()
        expect(afterCount).to.equal(beforeCount)
      })

      it('should produce the correct responses so far', function () {
        expect(results.length).to.equal(9)
        expect(results).to.deep.equal(
          Array(9).fill('invalid-password-retry-or-reset')
        )
      })

      describe('pushing the account past the limit', function () {
        beforeEach('do 6 login attempts', async function () {
          await doLoginAttempts(userA, 6, results)
        })

        it('should record 5 rate limited requests', async function () {
          const afterCount = await getLoginRateLimitHitMetricValue()
          expect(afterCount).to.equal(beforeCount + 5)
        })

        it('should produce the correct responses', function () {
          expect(results.length).to.equal(15)
          expect(results).to.deep.equal(
            Array(10)
              .fill('invalid-password-retry-or-reset')
              .concat(Array(5).fill('to-many-login-requests-2-mins'))
          )
        })

        describe('logging in with another user', function () {
          let userB
          beforeEach(function () {
            userB = new UserPromises()
          })

          beforeEach('update baseline metric value', async function () {
            beforeCount = await getLoginRateLimitHitMetricValue()
          })
          beforeEach('setup csrf token', async function () {
            await userB.getCsrfToken()
          })

          let messages = []
          beforeEach('do bad login', async function () {
            messages = []
            await doLoginAttempts(userB, 1, messages)
          })

          it('should not rate limit their request', function () {
            expect(messages).to.deep.equal(['invalid-password-retry-or-reset'])
          })

          it('should not record any further rate limited requests', async function () {
            const afterCount = await getLoginRateLimitHitMetricValue()
            expect(afterCount).to.equal(beforeCount)
          })
        })
      })

      describe('performing a valid login for clearing the limit', function () {
        beforeEach('do login', async function () {
          await userA.login()
        })

        it('should log the user in', async function () {
          const { response } = await userA.doRequest('GET', '/project')
          expect(response.statusCode).to.equal(200)
        })

        it('should not record any rate limited requests', async function () {
          const afterCount = await getLoginRateLimitHitMetricValue()
          expect(afterCount).to.equal(beforeCount)
        })

        describe('logging out and performing more invalid login requests', function () {
          beforeEach('logout', async function () {
            await userA.logout()
          })
          beforeEach('fetch new csrf token', async function () {
            await userA.getCsrfToken()
          })

          let results = []
          beforeEach('do 9 login attempts', async function () {
            results = []
            await doLoginAttempts(userA, 9, results)
          })

          it('should not record any rate limited requests yet', async function () {
            const afterCount = await getLoginRateLimitHitMetricValue()
            expect(afterCount).to.equal(beforeCount)
          })

          it('should not emit any rate limited responses yet', function () {
            expect(results.length).to.equal(9)
            expect(results).to.deep.equal(
              Array(9).fill('invalid-password-retry-or-reset')
            )
          })
        })
      })
    })
  })

  describe('CSRF protection', function () {
    before(function () {
      if (!Features.hasFeature('registration')) {
        this.skip()
      }
    })

    beforeEach(function () {
      this.user = new User()
      this.email = `test+${Math.random()}@example.com`
      this.password = 'password11'
    })

    afterEach(function (done) {
      this.user.fullDeleteUser(this.email, done)
    })

    it('should register with the csrf token', function (done) {
      this.user.request.get('/login', (err, res, body) => {
        expect(err).to.not.exist
        this.user.getCsrfToken(error => {
          expect(error).to.not.exist
          this.user.request.post(
            {
              url: '/register',
              json: {
                email: this.email,
                password: this.password,
              },
              headers: {
                'x-csrf-token': this.user.csrfToken,
              },
            },
            (error, response, body) => {
              expect(error).to.not.exist
              expect(response.statusCode).to.equal(200)
              return done()
            }
          )
        })
      })
    })

    it('should fail with no csrf token', function (done) {
      this.user.request.get('/login', (err, res, body) => {
        expect(err).to.not.exist
        this.user.getCsrfToken(error => {
          expect(error).to.not.exist
          this.user.request.post(
            {
              url: '/register',
              json: {
                email: this.email,
                password: this.password,
              },
              headers: {
                'x-csrf-token': '',
              },
            },
            (error, response, body) => {
              expect(error).to.not.exist
              expect(response.statusCode).to.equal(403)
              return done()
            }
          )
        })
      })
    })

    it('should fail with a stale csrf token', function (done) {
      this.user.request.get('/login', (err, res, body) => {
        expect(err).to.not.exist
        this.user.getCsrfToken(error => {
          expect(error).to.not.exist
          const oldCsrfToken = this.user.csrfToken
          this.user.logout(err => {
            expect(err).to.not.exist
            this.user.request.post(
              {
                url: '/register',
                json: {
                  email: this.email,
                  password: this.password,
                },
                headers: {
                  'x-csrf-token': oldCsrfToken,
                },
              },
              (error, response, body) => {
                expect(error).to.not.exist
                expect(response.statusCode).to.equal(403)
                return done()
              }
            )
          })
        })
      })
    })
  })

  describe('Register', function () {
    before(function () {
      if (!Features.hasFeature('registration')) {
        this.skip()
      }
    })

    beforeEach(function () {
      this.user = new User()
    })

    it('Set emails attribute', function (done) {
      this.user.register((error, user) => {
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

  describe('LoginViaRegistration', function () {
    beforeEach(function (done) {
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
          cb => redis.clearUserSessions(this.user2, cb),
        ],
        done
      )
      this.project_id = null
    })

    describe('[Security] Trying to register/login as another user', function () {
      before(function () {
        if (!Features.hasFeature('registration')) {
          this.skip()
        }
      })

      it('should not allow sign in with secondary email', function (done) {
        const secondaryEmail = 'acceptance-test-secondary@example.com'
        this.user1.addEmail(secondaryEmail, err => {
          expect(err).to.not.exist
          this.user1.loginWith(secondaryEmail, err => {
            expect(err).to.match(/login failed: status=401/)
            expect(err.info.body).to.deep.equal({
              message: {
                type: 'error',
                key: 'invalid-password-retry-or-reset',
              },
            })
            this.user1.isLoggedIn((err, isLoggedIn) => {
              expect(err).to.not.exist
              expect(isLoggedIn).to.equal(false)
              return done()
            })
          })
        })
      })

      it('should have user1 login and create a project, which user2 cannot access', function (done) {
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
                  expect(err).to.not.exist
                  expect(body.redir != null).to.equal(false)
                  expect(body.message != null).to.equal(true)
                  expect(body.message).to.have.all.keys('type', 'text')
                  expect(body.message.type).to.equal('error')
                  cb()
                }
              )
            },
            // check user still can't access the project
            cb => expectNoProjectAccess(this.user2, projectId, done),
          ],
          done
        )
      })
    })
  })
})
