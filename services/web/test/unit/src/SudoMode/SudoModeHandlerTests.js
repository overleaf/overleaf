/* eslint-disable
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
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const SandboxedModule = require('sandboxed-module')
const assert = require('assert')
require('chai').should()
const { expect } = require('chai')
const sinon = require('sinon')
const modulePath = require('path').join(
  __dirname,
  '../../../../app/src/Features/SudoMode/SudoModeHandler'
)

describe('SudoModeHandler', function() {
  beforeEach(function() {
    this.userId = 'some_user_id'
    this.email = 'someuser@example.com'
    this.user = {
      _id: this.userId,
      email: this.email
    }
    this.rclient = { get: sinon.stub(), set: sinon.stub(), del: sinon.stub() }
    this.RedisWrapper = { client: () => this.rclient }
    return (this.SudoModeHandler = SandboxedModule.require(modulePath, {
      globals: {
        console: console
      },
      requires: {
        '../../infrastructure/RedisWrapper': this.RedisWrapper,
        'logger-sharelatex': (this.logger = {
          log: sinon.stub(),
          err: sinon.stub()
        }),
        '../Authentication/AuthenticationManager': (this.AuthenticationManager = {}),
        'settings-sharelatex': (this.Settings = {}),
        '../V1/V1Handler': (this.V1Handler = { authWithV1: sinon.stub() }),
        '../User/UserGetter': (this.UserGetter = { getUser: sinon.stub() })
      }
    }))
  })

  describe('_buildKey', function() {
    it('should build a properly formed key', function() {
      return expect(this.SudoModeHandler._buildKey('123')).to.equal(
        'SudoMode:{123}'
      )
    })
  })

  describe('activateSudoMode', function() {
    beforeEach(function() {
      return (this.call = cb => {
        return this.SudoModeHandler.activateSudoMode(this.userId, cb)
      })
    })

    describe('when all goes well', function() {
      beforeEach(function() {
        return (this.rclient.set = sinon.stub().callsArgWith(4, null))
      })

      it('should not produce an error', function(done) {
        return this.call(err => {
          expect(err).to.equal(null)
          return done()
        })
      })

      it('should set a value in redis', function(done) {
        return this.call(err => {
          expect(this.rclient.set.callCount).to.equal(1)
          expect(
            this.rclient.set.calledWith(
              'SudoMode:{some_user_id}',
              '1',
              'EX',
              60 * 60
            )
          ).to.equal(true)
          return done()
        })
      })
    })

    describe('when user id is not supplied', function() {
      beforeEach(function() {
        return (this.call = cb => {
          return this.SudoModeHandler.activateSudoMode(null, cb)
        })
      })

      it('should produce an error', function(done) {
        return this.call(err => {
          expect(err).to.not.equal(null)
          expect(err).to.be.instanceof(Error)
          return done()
        })
      })

      it('should not set value in redis', function(done) {
        return this.call(err => {
          expect(this.rclient.set.callCount).to.equal(0)
          return done()
        })
      })
    })

    describe('when rclient.set produces an error', function() {
      beforeEach(function() {
        return (this.rclient.set = sinon
          .stub()
          .callsArgWith(4, new Error('woops')))
      })

      it('should produce an error', function(done) {
        return this.call(err => {
          expect(err).to.not.equal(null)
          expect(err).to.be.instanceof(Error)
          return done()
        })
      })
    })
  })

  describe('clearSudoMode', function() {
    beforeEach(function() {
      this.rclient.del = sinon.stub().callsArgWith(1, null)
      return (this.call = cb => {
        return this.SudoModeHandler.clearSudoMode(this.userId, cb)
      })
    })

    it('should not produce an error', function(done) {
      return this.call(err => {
        expect(err).to.equal(null)
        return done()
      })
    })

    it('should delete key from redis', function(done) {
      return this.call(err => {
        expect(this.rclient.del.callCount).to.equal(1)
        expect(this.rclient.del.calledWith('SudoMode:{some_user_id}')).to.equal(
          true
        )
        return done()
      })
    })

    describe('when rclient.del produces an error', function() {
      beforeEach(function() {
        return (this.rclient.del = sinon
          .stub()
          .callsArgWith(1, new Error('woops')))
      })

      it('should produce an error', function(done) {
        return this.call(err => {
          expect(err).to.not.equal(null)
          expect(err).to.be.instanceof(Error)
          return done()
        })
      })
    })

    describe('when user id is not supplied', function() {
      beforeEach(function() {
        return (this.call = cb => {
          return this.SudoModeHandler.clearSudoMode(null, cb)
        })
      })

      it('should produce an error', function(done) {
        return this.call(err => {
          expect(err).to.not.equal(null)
          expect(err).to.be.instanceof(Error)
          return done()
        })
      })

      it('should not delete value in redis', function(done) {
        return this.call(err => {
          expect(this.rclient.del.callCount).to.equal(0)
          return done()
        })
      })
    })
  })

  describe('authenticate', function() {
    beforeEach(function() {
      return (this.AuthenticationManager.authenticate = sinon
        .stub()
        .callsArgWith(2, null, this.user))
    })

    it('should call AuthenticationManager.authenticate', function(done) {
      return this.SudoModeHandler.authenticate(
        this.email,
        'password',
        (err, user) => {
          expect(err).to.not.exist
          expect(user).to.exist
          expect(user).to.deep.equal(this.user)
          expect(this.AuthenticationManager.authenticate.callCount).to.equal(1)
          return done()
        }
      )
    })
  })

  describe('isSudoModeActive', function() {
    beforeEach(function() {
      return (this.call = cb => {
        return this.SudoModeHandler.isSudoModeActive(this.userId, cb)
      })
    })

    describe('when sudo-mode is active for that user', function() {
      beforeEach(function() {
        return (this.rclient.get = sinon.stub().callsArgWith(1, null, '1'))
      })

      it('should not produce an error', function(done) {
        return this.call((err, isActive) => {
          expect(err).to.equal(null)
          return done()
        })
      })

      it('should get the value from redis', function(done) {
        return this.call((err, isActive) => {
          expect(this.rclient.get.callCount).to.equal(1)
          expect(
            this.rclient.get.calledWith('SudoMode:{some_user_id}')
          ).to.equal(true)
          return done()
        })
      })

      it('should produce a true result', function(done) {
        return this.call((err, isActive) => {
          expect(isActive).to.equal(true)
          return done()
        })
      })
    })

    describe('when sudo-mode is not active for that user', function() {
      beforeEach(function() {
        return (this.rclient.get = sinon.stub().callsArgWith(1, null, null))
      })

      it('should not produce an error', function(done) {
        return this.call((err, isActive) => {
          expect(err).to.equal(null)
          return done()
        })
      })

      it('should get the value from redis', function(done) {
        return this.call((err, isActive) => {
          expect(this.rclient.get.callCount).to.equal(1)
          expect(
            this.rclient.get.calledWith('SudoMode:{some_user_id}')
          ).to.equal(true)
          return done()
        })
      })

      it('should produce a false result', function(done) {
        return this.call((err, isActive) => {
          expect(isActive).to.equal(false)
          return done()
        })
      })
    })

    describe('when rclient.get produces an error', function() {
      beforeEach(function() {
        return (this.rclient.get = sinon
          .stub()
          .callsArgWith(1, new Error('woops')))
      })

      it('should produce an error', function(done) {
        return this.call((err, isActive) => {
          expect(err).to.not.equal(null)
          expect(err).to.be.instanceof(Error)
          expect(isActive).to.be.oneOf([null, undefined])
          return done()
        })
      })
    })

    describe('when user id is not supplied', function() {
      beforeEach(function() {
        return (this.call = cb => {
          return this.SudoModeHandler.isSudoModeActive(null, cb)
        })
      })

      it('should produce an error', function(done) {
        return this.call(err => {
          expect(err).to.not.equal(null)
          expect(err).to.be.instanceof(Error)
          return done()
        })
      })

      it('should not get value in redis', function(done) {
        return this.call(err => {
          expect(this.rclient.get.callCount).to.equal(0)
          return done()
        })
      })
    })
  })
})
