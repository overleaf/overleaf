/* eslint-disable
    no-return-assign,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const RealTimeClient = require('./helpers/RealTimeClient')
const Settings = require('@overleaf/settings')
const { expect } = require('chai')

describe('SessionSockets', function () {
  before(function () {
    return (this.checkSocket = function (fn) {
      const client = RealTimeClient.connect()
      client.on('connectionAccepted', fn)
      client.on('connectionRejected', fn)
      return null
    })
  })

  describe('without cookies', function () {
    before(function () {
      return (RealTimeClient.cookie = null)
    })

    return it('should return a lookup error', function (done) {
      return this.checkSocket(error => {
        expect(error).to.exist
        expect(error.message).to.equal('invalid session')
        return done()
      })
    })
  })

  describe('with a different cookie', function () {
    before(function () {
      return (RealTimeClient.cookie = 'some.key=someValue')
    })

    return it('should return a lookup error', function (done) {
      return this.checkSocket(error => {
        expect(error).to.exist
        expect(error.message).to.equal('invalid session')
        return done()
      })
    })
  })

  describe('with an invalid cookie', function () {
    before(function (done) {
      RealTimeClient.setSession({}, error => {
        if (error) {
          return done(error)
        }
        RealTimeClient.cookie = `${
          Settings.cookieName
        }=${RealTimeClient.cookie.slice(17, 49)}`
        return done()
      })
      return null
    })

    return it('should return a lookup error', function (done) {
      return this.checkSocket(error => {
        expect(error).to.exist
        expect(error.message).to.equal('invalid session')
        return done()
      })
    })
  })

  describe('with a valid cookie and no matching session', function () {
    before(function () {
      return (RealTimeClient.cookie = `${Settings.cookieName}=unknownId`)
    })

    return it('should return a lookup error', function (done) {
      return this.checkSocket(error => {
        expect(error).to.exist
        expect(error.message).to.equal('invalid session')
        return done()
      })
    })
  })

  return describe('with a valid cookie and a matching session', function () {
    before(function (done) {
      RealTimeClient.setSession({}, done)
      return null
    })

    return it('should not return an error', function (done) {
      return this.checkSocket(error => {
        expect(error).to.not.exist
        return done()
      })
    })
  })
})
