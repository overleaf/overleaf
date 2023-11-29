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
const FixturesManager = require('./helpers/FixturesManager')
const Settings = require('@overleaf/settings')
const { expect } = require('chai')

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
    beforeEach(function () {
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
    beforeEach(function (done) {
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
    beforeEach(function () {
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
    return it('should not return an error', function (done) {
      return this.checkSocket(error => {
        expect(error).to.not.exist
        return done()
      })
    })
  })
})
