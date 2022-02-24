const Settings = require('@overleaf/settings')
const { expect } = require('chai')
const User = require('./helpers/User').promises
const MockHaveIBeenPwnedApiClass = require('./mocks/MockHaveIBeenPwnedApi')
const { db } = require('../../../app/src/infrastructure/mongodb')
const { getMetric } = require('./helpers/metrics').promises
const sleep = require('util').promisify(setTimeout)

let MockHaveIBeenPwnedApi
before(function () {
  MockHaveIBeenPwnedApi = MockHaveIBeenPwnedApiClass.instance()
})

async function letPasswordCheckRunInBackground() {
  await sleep(200)
}

async function getMetricReUsed() {
  return getMetric(
    line => line.includes('password_re_use') && line.includes('re-used')
  )
}

async function getMetricUnique() {
  return getMetric(
    line => line.includes('password_re_use') && line.includes('unique')
  )
}

async function getMetricFailure() {
  return getMetric(
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
  await user.doRequest('POST', {
    url: '/user/password/set',
    form: {
      passwordResetToken: token,
      password,
    },
  })
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
      await letPasswordCheckRunInBackground()
    })
    beforeEach('fetch previous count', async function () {
      previous = await getMetricReUsed()
    })
    beforeEach('login', async function () {
      await user.loginNoUpdate()
      await letPasswordCheckRunInBackground()
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
      await letPasswordCheckRunInBackground()
    })
    beforeEach('fetch previous count', async function () {
      previous = await getMetricUnique()
    })
    beforeEach('login', async function () {
      await user.loginNoUpdate()
      await letPasswordCheckRunInBackground()
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
      await letPasswordCheckRunInBackground()
    })
    beforeEach('fetch previous count', async function () {
      previous = await getMetricFailure()
    })
    beforeEach('login', async function () {
      await user.loginNoUpdate()
      await letPasswordCheckRunInBackground()
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
      await letPasswordCheckRunInBackground()
    })
    beforeEach('fetch previous counts', async function () {
      previous = {
        reUsed: await getMetricReUsed(),
        unique: await getMetricUnique(),
        failure: await getMetricFailure(),
      }
    })
    beforeEach('login', async function () {
      await user.loginWithEmailPassword(user.email, 'aLeakedPassword42')
      await letPasswordCheckRunInBackground()
    })
    it('should not increment any counter', async function () {
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
      await letPasswordCheckRunInBackground()
    })
    beforeEach('fetch previous count', async function () {
      previous = await getMetricReUsed()
    })
    beforeEach('set password', async function () {
      await resetPassword('aLeakedPassword42')
      await letPasswordCheckRunInBackground()
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
      await letPasswordCheckRunInBackground()
    })
    beforeEach('fetch previous count', async function () {
      previous = await getMetricUnique()
    })
    beforeEach('set password', async function () {
      await resetPassword('a-strong-new-password')
      await letPasswordCheckRunInBackground()
    })
    it('should track the strong password', async function () {
      const after = await getMetricUnique()
      expect(after).to.equal(previous + 1)
    })
  })
})
