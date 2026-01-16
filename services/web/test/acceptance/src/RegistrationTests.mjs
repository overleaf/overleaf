import { expect } from 'chai'
import metrics from './helpers/metrics.mjs'
import User from './helpers/User.mjs'
import redis from './helpers/redis.mjs'
import Features from '../../../app/src/infrastructure/Features.mjs'

const UserPromises = User.promises

// Expectations
async function expectProjectAccess(user, projectId) {
  // should have access to project
  await user.openProject(projectId)
}

async function expectNoProjectAccess(user, projectId) {
  // should not have access to project page
  let error = null
  try {
    await user.openProject(projectId)
  } catch (err) {
    error = err
  }
  expect(error).to.be.instanceof(Error)
}

// Actions
async function tryLoginThroughRegistrationForm(user, email, password) {
  await user.getCsrfToken()
  return await user.doRequest('POST', {
    url: '/register',
    json: { email, password },
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
      this.user = new UserPromises()
      this.email = `test+${Math.random()}@example.com`
      this.password = 'password11'
    })

    afterEach(async function () {
      await this.user.fullDeleteUser(this.email)
    })

    it('should register with the csrf token', async function () {
      await this.user.request.get('/login')
      await this.user.getCsrfToken()
      const { response } = await this.user.doRequest('POST', {
        url: '/register',
        json: {
          email: this.email,
          password: this.password,
        },
        headers: {
          'x-csrf-token': this.user.csrfToken,
        },
      })
      expect(response.statusCode).to.equal(200)
    })

    it('should fail with no csrf token', async function () {
      await this.user.request.get('/login')
      await this.user.getCsrfToken()
      const { response } = await this.user.doRequest('POST', {
        url: '/register',
        json: {
          email: this.email,
          password: this.password,
        },
        headers: {
          'x-csrf-token': '',
        },
      })
      expect(response.statusCode).to.equal(403)
    })

    it('should fail with a stale csrf token', async function () {
      await this.user.request.get('/login')
      await this.user.getCsrfToken()
      const oldCsrfToken = this.user.csrfToken
      await this.user.logout()
      const { response } = await this.user.doRequest('POST', {
        url: '/register',
        json: {
          email: this.email,
          password: this.password,
        },
        headers: {
          'x-csrf-token': oldCsrfToken,
        },
      })
      expect(response.statusCode).to.equal(403)
    })
  })

  describe('Register', function () {
    before(function () {
      if (!Features.hasFeature('registration')) {
        this.skip()
      }
    })

    beforeEach(function () {
      this.user = new UserPromises()
    })

    it('Set emails attribute', async function () {
      const user = await this.user.register()
      expect(user.email).to.equal(this.user.email)
      expect(user.emails).to.exist
      expect(user.emails).to.be.a('array')
      expect(user.emails.length).to.equal(1)
      expect(user.emails[0].email).to.equal(this.user.email)
    })
  })

  describe('LoginViaRegistration', function () {
    beforeEach(async function () {
      this.timeout(60000)
      this.user1 = new UserPromises()
      this.user2 = new UserPromises()

      await this.user1.login()
      await this.user1.logout()
      await redis.clearUserSessions(this.user1)
      await this.user2.login()
      await this.user2.logout()
      await redis.clearUserSessions(this.user2)

      this.project_id = null
    })

    describe('[Security] Trying to register/login as another user', function () {
      before(function () {
        if (!Features.hasFeature('registration')) {
          this.skip()
        }
      })

      it('should not allow sign in with secondary email', async function () {
        const secondaryEmail = 'acceptance-test-secondary@example.com'
        await this.user1.addEmail(secondaryEmail)
        let error = null
        try {
          await this.user1.loginWith(secondaryEmail)
        } catch (err) {
          error = err
        }
        expect(error).to.be.instanceOf(Error)
        expect(error.message).to.match(/login failed: status=401/)
        expect(error.info.body).to.deep.equal({
          message: {
            type: 'error',
            key: 'invalid-password-retry-or-reset',
          },
        })

        const isLoggedIn = await this.user1.isLoggedIn()
        expect(isLoggedIn).to.equal(false)
      })

      it('should have user1 login and create a project, which user2 cannot access', async function () {
        // user1 logs in and creates a project which only they can access
        await this.user1.login()
        const projectId = await this.user1.createProject('Private Project')
        await expectProjectAccess(this.user1, projectId)
        await expectNoProjectAccess(this.user2, projectId)
        // should prevent user2 from login/register with user1 email address
        const { body } = await tryLoginThroughRegistrationForm(
          this.user2,
          this.user1.email,
          'totally_not_the_right_password'
        )
        expect(body.redir != null).to.equal(false)
        expect(body.message != null).to.equal(true)
        expect(body.message).to.have.all.keys('type', 'text')
        expect(body.message.type).to.equal('error')
        // check user still can't access the project
        await expectNoProjectAccess(this.user2, projectId)
      })
    })
  })
})
