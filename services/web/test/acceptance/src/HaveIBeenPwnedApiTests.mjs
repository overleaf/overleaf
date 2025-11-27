import Settings from '@overleaf/settings'
import { expect } from 'chai'
import UserHelper from './helpers/User.mjs'
import MockHaveIBeenPwnedApiClass from './mocks/MockHaveIBeenPwnedApi.mjs'
import { db } from '../../../app/src/infrastructure/mongodb.mjs'
import MetricsHelper from './helpers/metrics.mjs'

const User = UserHelper.promises

const getMetric = MetricsHelper.promises.getMetric

let MockHaveIBeenPwnedApi
before(function () {
  MockHaveIBeenPwnedApi = MockHaveIBeenPwnedApiClass.instance()
})

async function getMetricReUsed() {
  return await getMetric(
    line => line.includes('password_re_use') && line.includes('re-used')
  )
}

async function getMetricUnique() {
  return await getMetric(
    line => line.includes('password_re_use') && line.includes('unique')
  )
}

async function getMetricFailure() {
  return await getMetric(
    line => line.includes('password_re_use') && line.includes('failure')
  )
}

let user, previous

async function resetPassword(password) {
  await user.getCsrfToken()
  await user.doRequest('POST', {
    url: '/user/password/reset',
    form: {
      email: user.email,
    },
  })
  const token = (
    await db.tokens.findOne({
      'data.user_id': user._id.toString(),
    })
  ).token

  await user.doRequest('GET', {
    url: `/user/password/set?passwordResetToken=${token}&email=${user.email}`,
  })
  const { response } = await user.doRequest('POST', {
    url: '/user/password/set',
    form: {
      passwordResetToken: token,
      password,
    },
  })

  return response
}

describe('HaveIBeenPwnedApi', function () {
  before(function () {
    Settings.apis.haveIBeenPwned.enabled = true
  })
  after(function () {
    Settings.apis.haveIBeenPwned.enabled = false
  })

  describe('login with weak password', function () {
    beforeEach(function () {
      user = new User()
      user.password = 'aLeakedPassword42'

      // echo -n aLeakedPassword42 | sha1sum
      MockHaveIBeenPwnedApi.addPasswordByHash(
        'D1ABBDEEE70CBE8BBCE5D9D039C53C0CE91C0C16'
      )
    })
    beforeEach('create the user', async function () {
      await user.ensureUserExists()
    })
    beforeEach('fetch previous count', async function () {
      previous = await getMetricReUsed()
    })
    beforeEach('login', async function () {
      try {
        await user.loginNoUpdate()
        expect.fail('should have failed login with weak password')
      } catch (err) {
        expect(err).to.match(/login failed: status=400/)
        expect(err.info.body).to.deep.equal({
          message: {
            type: 'error',
            key: 'password-compromised',
            text: `The password you’ve entered is on a public list of compromised passwords (https://haveibeenpwned.com/passwords). Please try logging in from a device you’ve previously used or reset your password (${Settings.siteUrl}/user/password/reset).`,
          },
        })
      }
    })
    it('should track the weak password', async function () {
      const after = await getMetricReUsed()
      expect(after).to.equal(previous + 1)
    })
  })

  describe('login with strong password', function () {
    beforeEach(function () {
      user = new User()
      user.password = 'this-is-a-strong-password'
    })
    beforeEach('create the user', async function () {
      await user.ensureUserExists()
    })
    beforeEach('fetch previous count', async function () {
      previous = await getMetricUnique()
    })
    beforeEach('login', async function () {
      await user.loginNoUpdate()
    })
    it('should track the strong password', async function () {
      const after = await getMetricUnique()
      expect(after).to.equal(previous + 1)
    })
  })

  describe('when the api is producing garbage', function () {
    beforeEach(function () {
      user = new User()
      user.password = 'trigger-garbage-output'
    })
    beforeEach('create the user', async function () {
      await user.ensureUserExists()
    })
    beforeEach('fetch previous count', async function () {
      previous = await getMetricFailure()
    })
    beforeEach('login', async function () {
      await user.loginNoUpdate()
    })
    it('should track the failure to collect a score', async function () {
      const after = await getMetricFailure()
      expect(after).to.equal(previous + 1)
    })
  })

  describe('login attempt with weak password', function () {
    beforeEach(function () {
      user = new User()
      // echo -n aLeakedPassword42 | sha1sum
      MockHaveIBeenPwnedApi.addPasswordByHash(
        'D1ABBDEEE70CBE8BBCE5D9D039C53C0CE91C0C16'
      )
    })
    beforeEach('create the user', async function () {
      await user.ensureUserExists()
    })
    beforeEach('fetch previous counts', async function () {
      previous = {
        reUsed: await getMetricReUsed(),
        unique: await getMetricUnique(),
        failure: await getMetricFailure(),
      }
    })
    beforeEach('login', async function () {
      try {
        await user.loginWithEmailPassword(user.email, 'aLeakedPassword42')
        expect.fail('expected the login request to fail')
      } catch (err) {
        expect(err).to.match(/login failed: status=401/)
        expect(err.info.body).to.deep.equal({
          message: { type: 'error', key: 'invalid-password-retry-or-reset' },
        })
      }
    })
    it('should not increment the counter', async function () {
      expect(previous).to.deep.equal({
        reUsed: await getMetricReUsed(),
        unique: await getMetricUnique(),
        failure: await getMetricFailure(),
      })
    })
  })

  describe('password reset with a weak password', function () {
    beforeEach(function () {
      user = new User()
      // echo -n aLeakedPassword42 | sha1sum
      MockHaveIBeenPwnedApi.addPasswordByHash(
        'D1ABBDEEE70CBE8BBCE5D9D039C53C0CE91C0C16'
      )
    })
    beforeEach('create the user', async function () {
      await user.ensureUserExists()
    })
    beforeEach('fetch previous count', async function () {
      previous = await getMetricReUsed()
    })
    beforeEach('set password', async function () {
      const response = await resetPassword('aLeakedPassword42')
      expect(response.statusCode).to.equal(400)
      expect(response.body).to.equal(
        JSON.stringify({
          message: {
            key: 'password-must-be-strong',
          },
        })
      )
    })
    it('should track the weak password', async function () {
      const after = await getMetricReUsed()
      expect(after).to.equal(previous + 1)
    })
  })

  describe('password reset with a strong password', function () {
    beforeEach(function () {
      user = new User()
    })
    beforeEach('create the user', async function () {
      await user.ensureUserExists()
    })
    beforeEach('fetch previous count', async function () {
      previous = await getMetricUnique()
    })
    beforeEach('set password', async function () {
      const response = await resetPassword('a-strong-new-password')
      expect(response.statusCode).to.equal(200)
    })
    it('should track the strong password', async function () {
      const after = await getMetricUnique()
      expect(after).to.equal(previous + 1)
    })
  })
})
