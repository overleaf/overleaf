import RealTimeClient from './helpers/RealTimeClient.js'
import FixturesManager from './helpers/FixturesManager.js'
import Settings from '@overleaf/settings'
import signature from 'cookie-signature'
import { expect } from 'chai'

describe('SessionSockets', function () {
  beforeEach(function (done) {
    FixturesManager.setUpProject(
      {
        privilegeLevel: 'owner',
      },
      (err, options) => {
        if (err) return done(err)

        this.checkSocket = function (fn) {
          RealTimeClient.connect(options.project_id, fn)
        }
        done()
      }
    )
  })

  describe('without cookies', function () {
    beforeEach(function () {
      RealTimeClient.cookie = null
    })

    it('should return a lookup error', function (done) {
      this.checkSocket(error => {
        expect(error).to.exist
        expect(error.message).to.equal('invalid session')
        done()
      })
    })
  })

  describe('with a different cookie', function () {
    beforeEach(function () {
      RealTimeClient.cookie = 'some.key=someValue'
    })

    it('should return a lookup error', function (done) {
      this.checkSocket(error => {
        expect(error).to.exist
        expect(error.message).to.equal('invalid session')
        done()
      })
    })
  })

  describe('with an invalid cookie', function () {
    beforeEach(function (done) {
      RealTimeClient.setSession({}, error => {
        if (error) {
          return done(error)
        }
        RealTimeClient.cookie = `${
          Settings.cookieName
        }=${RealTimeClient.cookie.slice(17, 49)}`
        done()
      })
    })

    it('should return a lookup error', function (done) {
      this.checkSocket(error => {
        expect(error).to.exist
        expect(error.message).to.equal('invalid session')
        done()
      })
    })
  })

  describe('with a valid cookie and no matching session', function () {
    beforeEach(function () {
      RealTimeClient.cookie = `${Settings.cookieName}=unknownId`
    })

    it('should return a lookup error', function (done) {
      this.checkSocket(error => {
        expect(error).to.exist
        expect(error.message).to.equal('invalid session')
        done()
      })
    })
  })

  describe('with a valid cookie and a matching session', function () {
    it('should not return an error', function (done) {
      this.checkSocket(error => {
        expect(error).to.not.exist
        done()
      })
    })
  })

  describe('with a cookie signed by the fallback key and a matching session', function () {
    beforeEach(function () {
      RealTimeClient.cookie =
        RealTimeClient.cookieSignedWith.sessionSecretFallback
    })
    it('should not return an error', function (done) {
      this.checkSocket(error => {
        expect(error).to.not.exist
        done()
      })
    })
  })

  describe('with a cookie signed by the upcoming key and a matching session', function () {
    beforeEach(function () {
      RealTimeClient.cookie =
        RealTimeClient.cookieSignedWith.sessionSecretUpcoming
    })
    it('should not return an error', function (done) {
      this.checkSocket(error => {
        expect(error).to.not.exist
        done()
      })
    })
  })

  describe('with a cookie signed with an unrecognized secret and a matching session', function () {
    beforeEach(function () {
      const [sessionKey] = RealTimeClient.cookie.split('.')
      // sign the session key with a unrecognized secret
      RealTimeClient.cookie = signature.sign(
        sessionKey,
        'unrecognised-session-secret'
      )
    })
    it('should return a lookup error', function (done) {
      this.checkSocket(error => {
        expect(error).to.exist
        expect(error.message).to.equal('invalid session')
        done()
      })
    })
  })
})
