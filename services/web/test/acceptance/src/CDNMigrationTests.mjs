import { expect } from 'chai'
import UserHelper from './helpers/User.mjs'
import MetricsHelper from './helpers/metrics.mjs'

const User = UserHelper.promises

const getMetric = MetricsHelper.promises.getMetric

describe('CDNMigration', function () {
  let anon, user
  beforeEach(async function () {
    anon = new User()
    user = new User()
    await user.login()
  })
  let noCdnPreLogin, noCdnLoggedIn
  let cdnBlockedTruePreLogin, cdnBlockedTrueLoggedIn
  let cdnBlockedFalsePreLogin, cdnBlockedFalseLoggedIn

  async function getNoCdn(path) {
    return await getMetric(
      line => line.includes('no_cdn') && line.includes(path)
    )
  }
  async function getCdnBlocked(path, method) {
    return await getMetric(
      line =>
        line.includes('cdn_blocked') &&
        line.includes(`path="${path}"`) &&
        line.includes(`method="${method}"`)
    )
  }

  beforeEach(async function () {
    noCdnPreLogin = await getNoCdn('pre-login')
    noCdnLoggedIn = await getNoCdn('logged-in')
    cdnBlockedTruePreLogin = await getCdnBlocked('pre-login', 'true')
    cdnBlockedTrueLoggedIn = await getCdnBlocked('logged-in', 'true')
    cdnBlockedFalsePreLogin = await getCdnBlocked('pre-login', 'false')
    cdnBlockedFalseLoggedIn = await getCdnBlocked('logged-in', 'false')
  })

  describe('pre-login', function () {
    it('should collect no_cdn', async function () {
      await anon.doRequest('GET', '/login?nocdn=true')
      expect(await getNoCdn('pre-login')).to.equal(noCdnPreLogin + 1)
    })
    it('should collect cdn_blocked', async function () {
      await anon.doRequest('GET', '/login')
      await anon.doRequest('GET', '/login')
      await anon.doRequest('GET', '/login')
      expect(await getCdnBlocked('pre-login', 'false')).to.equal(
        cdnBlockedFalsePreLogin + 3
      )
      expect(await getCdnBlocked('pre-login', 'true')).to.equal(
        cdnBlockedTruePreLogin
      )
    })
    it('should collect cdn_blocked after nocdn', async function () {
      await anon.doRequest('GET', '/login?nocdn=true')
      await anon.doRequest('GET', '/login')
      expect(await getCdnBlocked('pre-login', 'false')).to.equal(
        cdnBlockedFalsePreLogin
      )
      expect(await getCdnBlocked('pre-login', 'true')).to.equal(
        cdnBlockedTruePreLogin + 2
      )
    })
  })
  describe('logged-in', function () {
    it('should collect no_cdn', async function () {
      await user.doRequest('GET', '/project?nocdn=true')
      expect(await getNoCdn('logged-in')).to.equal(noCdnLoggedIn + 1)
    })
    it('should collect cdn_blocked=false before nocdn', async function () {
      await user.doRequest('GET', '/project')
      await user.doRequest('GET', '/project')
      await user.doRequest('GET', '/project')
      expect(await getCdnBlocked('logged-in', 'false')).to.equal(
        cdnBlockedFalseLoggedIn + 3
      )
      expect(await getCdnBlocked('logged-in', 'true')).to.equal(
        cdnBlockedTrueLoggedIn
      )
    })
    it('should collect cdn_blocked=true after nocdn=true', async function () {
      await user.doRequest('GET', '/project?nocdn=true')
      await user.doRequest('GET', '/project')
      expect(await getCdnBlocked('logged-in', 'false')).to.equal(
        cdnBlockedFalseLoggedIn
      )
      expect(await getCdnBlocked('logged-in', 'true')).to.equal(
        cdnBlockedTrueLoggedIn + 2
      )
    })
  })
})
