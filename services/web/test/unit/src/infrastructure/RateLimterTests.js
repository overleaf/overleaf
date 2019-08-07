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
const { assert } = require('chai')
const sinon = require('sinon')
const chai = require('chai')
const should = chai.should()
const { expect } = chai
const modulePath = '../../../../app/src/infrastructure/RateLimiter.js'
const SandboxedModule = require('sandboxed-module')

describe('RateLimiter', function() {
  beforeEach(function() {
    this.settings = {
      redis: {
        web: {
          port: '1234',
          host: 'somewhere',
          password: 'password'
        }
      }
    }
    this.rclient = {
      incr: sinon.stub(),
      get: sinon.stub(),
      expire: sinon.stub(),
      exec: sinon.stub()
    }
    this.rclient.multi = sinon.stub().returns(this.rclient)
    this.RedisWrapper = { client: sinon.stub().returns(this.rclient) }

    this.endpointName = 'compiles'
    this.subject = 'some-project-id'
    this.timeInterval = 20
    this.throttleLimit = 5

    this.requires = {
      'settings-sharelatex': this.settings,
      'logger-sharelatex': (this.logger = {
        log: sinon.stub(),
        err: sinon.stub()
      }),
      'metrics-sharelatex': (this.Metrics = { inc: sinon.stub() }),
      './RedisWrapper': this.RedisWrapper
    }

    this.details = {
      endpointName: this.endpointName,
      subjectName: this.subject,
      throttle: this.throttleLimit,
      timeInterval: this.timeInterval
    }
    return (this.key = `RateLimiter:${this.endpointName}:{${this.subject}}`)
  })

  describe('when action is permitted', function() {
    beforeEach(function() {
      this.requires['rolling-rate-limiter'] = opts => {
        return sinon.stub().callsArgWith(1, null, 0, 22)
      }
      return (this.limiter = SandboxedModule.require(modulePath, {
        globals: {
          console: console
        },
        requires: this.requires
      }))
    })

    it('should not produce and error', function(done) {
      return this.limiter.addCount({}, (err, should) => {
        expect(err).to.equal(null)
        return done()
      })
    })

    it('should callback with true', function(done) {
      return this.limiter.addCount({}, (err, should) => {
        expect(should).to.equal(true)
        return done()
      })
    })

    it('should not increment the metric', function(done) {
      return this.limiter.addCount(
        { endpointName: this.endpointName },
        (err, should) => {
          sinon.assert.notCalled(this.Metrics.inc)
          return done()
        }
      )
    })
  })

  describe('when action is not permitted', function() {
    beforeEach(function() {
      this.requires['rolling-rate-limiter'] = opts => {
        return sinon.stub().callsArgWith(1, null, 4000, 0)
      }
      return (this.limiter = SandboxedModule.require(modulePath, {
        globals: {
          console: console
        },
        requires: this.requires
      }))
    })

    it('should not produce and error', function(done) {
      return this.limiter.addCount({}, (err, should) => {
        expect(err).to.equal(null)
        return done()
      })
    })

    it('should callback with false', function(done) {
      return this.limiter.addCount({}, (err, should) => {
        expect(should).to.equal(false)
        return done()
      })
    })

    it('should increment the metric', function(done) {
      return this.limiter.addCount(
        { endpointName: this.endpointName },
        (err, should) => {
          sinon.assert.calledWith(
            this.Metrics.inc,
            `rate-limit-hit.${this.endpointName}`,
            1,
            { path: this.endpointName }
          )
          return done()
        }
      )
    })
  })

  describe('when limiter produces an error', function() {
    beforeEach(function() {
      this.requires['rolling-rate-limiter'] = opts => {
        return sinon.stub().callsArgWith(1, new Error('woops'))
      }
      return (this.limiter = SandboxedModule.require(modulePath, {
        globals: {
          console: console
        },
        requires: this.requires
      }))
    })

    it('should produce and error', function(done) {
      return this.limiter.addCount({}, (err, should) => {
        expect(err).to.not.equal(null)
        expect(err).to.be.instanceof(Error)
        return done()
      })
    })
  })
})
