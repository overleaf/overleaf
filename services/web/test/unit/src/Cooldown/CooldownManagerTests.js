/* eslint-disable
    handle-callback-err,
    max-len,
    no-return-assign,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const SandboxedModule = require('sandboxed-module')
const sinon = require('sinon')
require('chai').should()
const { expect } = require('chai')
const modulePath = require('path').join(
  __dirname,
  '../../../../app/src/Features/Cooldown/CooldownManager'
)

describe('CooldownManager', function() {
  beforeEach(function() {
    this.projectId = 'abcdefg'
    this.rclient = { set: sinon.stub(), get: sinon.stub() }
    this.RedisWrapper = { client: () => this.rclient }
    return (this.CooldownManager = SandboxedModule.require(modulePath, {
      globals: {
        console: console
      },
      requires: {
        '../../infrastructure/RedisWrapper': this.RedisWrapper,
        'logger-sharelatex': { log: sinon.stub() }
      }
    }))
  })

  describe('_buildKey', function() {
    it('should build a properly formatted redis key', function() {
      return expect(this.CooldownManager._buildKey('ABC')).to.equal(
        'Cooldown:{ABC}'
      )
    })
  })

  describe('isProjectOnCooldown', function() {
    beforeEach(function() {
      return (this.call = cb => {
        return this.CooldownManager.isProjectOnCooldown(this.projectId, cb)
      })
    })

    describe('when project is on cooldown', function() {
      beforeEach(function() {
        return (this.rclient.get = sinon.stub().callsArgWith(1, null, '1'))
      })

      it('should fetch key from redis', function(done) {
        return this.call((err, result) => {
          this.rclient.get.callCount.should.equal(1)
          this.rclient.get.calledWith('Cooldown:{abcdefg}').should.equal(true)
          return done()
        })
      })

      it('should not produce an error', function(done) {
        return this.call((err, result) => {
          expect(err).to.equal(null)
          return done()
        })
      })

      it('should produce a true result', function(done) {
        return this.call((err, result) => {
          expect(result).to.equal(true)
          return done()
        })
      })
    })

    describe('when project is not on cooldown', function() {
      beforeEach(function() {
        return (this.rclient.get = sinon.stub().callsArgWith(1, null, null))
      })

      it('should fetch key from redis', function(done) {
        return this.call((err, result) => {
          this.rclient.get.callCount.should.equal(1)
          this.rclient.get.calledWith('Cooldown:{abcdefg}').should.equal(true)
          return done()
        })
      })

      it('should not produce an error', function(done) {
        return this.call((err, result) => {
          expect(err).to.equal(null)
          return done()
        })
      })

      it('should produce a false result', function(done) {
        return this.call((err, result) => {
          expect(result).to.equal(false)
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

      it('should fetch key from redis', function(done) {
        return this.call((err, result) => {
          this.rclient.get.callCount.should.equal(1)
          this.rclient.get.calledWith('Cooldown:{abcdefg}').should.equal(true)
          return done()
        })
      })

      it('should produce an error', function(done) {
        return this.call((err, result) => {
          expect(err).to.not.equal(null)
          expect(err).to.be.instanceof(Error)
          return done()
        })
      })
    })
  })

  describe('putProjectOnCooldown', function() {
    beforeEach(function() {
      return (this.call = cb => {
        return this.CooldownManager.putProjectOnCooldown(this.projectId, cb)
      })
    })

    describe('when rclient.set does not produce an error', function() {
      beforeEach(function() {
        return (this.rclient.set = sinon.stub().callsArgWith(4, null))
      })

      it('should set a key in redis', function(done) {
        return this.call(err => {
          this.rclient.set.callCount.should.equal(1)
          this.rclient.set.calledWith('Cooldown:{abcdefg}').should.equal(true)
          return done()
        })
      })

      it('should not produce an error', function(done) {
        return this.call(err => {
          expect(err).to.equal(null)
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

      it('should set a key in redis', function(done) {
        return this.call(err => {
          this.rclient.set.callCount.should.equal(1)
          this.rclient.set.calledWith('Cooldown:{abcdefg}').should.equal(true)
          return done()
        })
      })

      it('produce an error', function(done) {
        return this.call(err => {
          expect(err).to.not.equal(null)
          expect(err).to.be.instanceof(Error)
          return done()
        })
      })
    })
  })
})
