import Settings from '@overleaf/settings'
import { expect } from 'chai'
import UserHelper from './helpers/User.mjs'
import MetricsHelper from './helpers/metrics.mjs'
import cookieSignature from 'cookie-signature'

const User = UserHelper.promises

const getMetric = MetricsHelper.promises.getMetric

const resetMetrics = MetricsHelper.resetMetrics

async function getSessionCookieMetric(status) {
  return getMetric(
    line =>
      line.includes('session_cookie') && line.includes(`status="${status}"`)
  )
}

/*
 * Modifies the session cookie by removing the existing signature and signing
 * the cookie with a new secret.
 */
function modifyCookieSignature(originalCookie, newSecret) {
  const [sessionKey] = originalCookie.value.slice(2).split('.')
  return cookieSignature.sign(sessionKey, newSecret)
}

describe('Session cookie', function () {
  before(async function () {
    this.user = new User()
  })

  describe('with no session cookie', function () {
    before(async function () {
      resetMetrics()
      const { response } = await this.user.doRequest('GET', '/login')
      this.response = response
    })

    after(function () {
      this.user.resetCookies()
    })

    it('should accept the request', function () {
      expect(this.response.statusCode).to.equal(200)
    })

    it('should return a signed cookie', async function () {
      const cookie = this.user.sessionCookie()
      expect(cookie).to.exist
      expect(cookie.key).to.equal(Settings.cookieName)
      expect(cookie.value).to.match(/^s:/)
    })

    it('should sign the cookie with the current session secret', function () {
      const cookie = this.user.sessionCookie()
      const unsigned = cookieSignature.unsign(
        cookie.value.slice(2), // strip the 's:' prefix
        Settings.security.sessionSecret
      )
      expect(unsigned).not.to.be.false
      expect(unsigned).to.match(/^[a-zA-Z0-9_-]+$/)
    })

    it('should record a "none" cookie metric', async function () {
      const count = await getSessionCookieMetric('none')
      expect(count).to.equal(1)
    })
  })

  describe('with a signed session cookie', function () {
    before(async function () {
      // get the first cookie
      await this.user.doRequest('GET', '/login')
      this.firstCookie = this.user.sessionCookie()
      // make a subsequent request
      resetMetrics()
      const { response } = await this.user.doRequest('GET', '/login')
      this.response = response
    })

    after(function () {
      this.user.resetCookies()
    })

    it('should accept the request', function () {
      expect(this.response.statusCode).to.equal(200)
    })

    it('should return the same signed cookie', async function () {
      const cookie = this.user.sessionCookie()
      expect(cookie).to.exist
      expect(cookie.key).to.equal(Settings.cookieName)
      expect(cookie.value).to.equal(this.firstCookie.value)
    })

    it('should record a "signed" cookie metric', async function () {
      const count = await getSessionCookieMetric('signed')
      expect(count).to.equal(1)
    })
  })

  describe('with a session cookie signed with the fallback session secret', function () {
    before(async function () {
      // get the first cookie
      await this.user.doRequest('GET', '/login')
      this.firstCookie = this.user.sessionCookie()
      // sign the session key with the fallback secret
      this.user.setSessionCookie(
        's:' +
          modifyCookieSignature(
            this.firstCookie,
            Settings.security.sessionSecretFallback
          )
      )
      // make a subsequent request
      resetMetrics()
      const { response } = await this.user.doRequest('GET', '/login')
      this.response = response
    })

    after(function () {
      this.user.resetCookies()
    })

    it('should accept the request', async function () {
      expect(this.response.statusCode).to.equal(200)
    })

    it('should return the cookie signed with the current secret', function () {
      const cookie = this.user.sessionCookie()
      expect(cookie).to.exist
      expect(cookie.key).to.equal(Settings.cookieName)
      expect(cookie.value).to.equal(this.firstCookie.value)
    })

    it('should record a "signed" cookie metric', async function () {
      const count = await getSessionCookieMetric('signed')
      expect(count).to.equal(1)
    })
  })

  describe('with a session cookie signed with the upcoming session secret', function () {
    before(async function () {
      // get the first cookie
      await this.user.doRequest('GET', '/login')
      this.firstCookie = this.user.sessionCookie()
      // sign the session key with the upcoming secret

      this.user.setSessionCookie(
        's:' +
          modifyCookieSignature(
            this.firstCookie,
            Settings.security.sessionSecretUpcoming
          )
      )
      // make a subsequent request
      resetMetrics()
      const { response } = await this.user.doRequest('GET', '/login')
      this.response = response
    })

    after(function () {
      this.user.resetCookies()
    })

    it('should accept the request', async function () {
      expect(this.response.statusCode).to.equal(200)
    })

    it('should return the cookie signed with the current secret', function () {
      const cookie = this.user.sessionCookie()
      expect(cookie).to.exist
      expect(cookie.key).to.equal(Settings.cookieName)
      expect(cookie.value).to.equal(this.firstCookie.value)
    })

    it('should record a "signed" cookie metric', async function () {
      const count = await getSessionCookieMetric('signed')
      expect(count).to.equal(1)
    })
  })

  describe('with a session cookie signed with an invalid secret', function () {
    before(async function () {
      // get the first cookie
      await this.user.doRequest('GET', '/login')
      this.firstCookie = this.user.sessionCookie()
      // sign the session key with an invalid secret
      this.user.setSessionCookie(
        's:' + modifyCookieSignature(this.firstCookie, 'invalid-secret')
      )
      // make a subsequent request
      resetMetrics()
      const { response } = await this.user.doRequest('GET', '/login')
      this.response = response
    })

    after(function () {
      this.user.resetCookies()
    })

    it('should not reject the request', async function () {
      expect(this.response.statusCode).to.equal(200)
    })

    it('should return a new cookie signed with the current secret', function () {
      const cookie = this.user.sessionCookie()
      expect(cookie).to.exist
      expect(cookie.key).to.equal(Settings.cookieName)
      const [sessionKey] = cookie.value.slice(2).split('.')
      expect(sessionKey).not.to.equal(this.firstSessionKey)
    })

    it('should record a "bad-signature" cookie metric', async function () {
      const count = await getSessionCookieMetric('bad-signature')
      expect(count).to.equal(1)
    })
  })

  describe('with an unsigned session cookie', function () {
    before(async function () {
      // get the first cookie
      await this.user.doRequest('GET', '/login')
      this.firstCookie = this.user.sessionCookie()
      // use the session key without signing it
      const [sessionKey] = this.firstCookie.value.slice(2).split('.')
      this.firstSessionKey = sessionKey
      this.user.setSessionCookie(sessionKey)
      // make a subsequent request
      resetMetrics()
      const { response } = await this.user.doRequest('GET', '/login')
      this.response = response
    })

    after(function () {
      this.user.resetCookies()
    })

    it('should not reject the request', async function () {
      expect(this.response.statusCode).to.equal(200)
    })

    it('should return a new cookie signed with the current secret', function () {
      const cookie = this.user.sessionCookie()
      expect(cookie).to.exist
      expect(cookie.key).to.equal(Settings.cookieName)
      const [sessionKey] = cookie.value.slice(2).split('.')
      expect(sessionKey).not.to.equal(this.firstSessionKey)
    })

    it('should record an "unsigned" cookie metric', async function () {
      const count = await getSessionCookieMetric('unsigned')
      expect(count).to.equal(1)
    })
  })
})
