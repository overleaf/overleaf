/* eslint-disable
    mocha/no-nested-tests,
    no-return-assign,
    no-undef,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
import async from 'async'
import sinon from 'sinon'
import { expect } from 'chai'
import { strict as esmock } from 'esmock'

const MODULE_PATH = '../../../../app/js/LockManager.js'

describe('LockManager', function () {
  beforeEach(async function () {
    let Timer
    this.Settings = {
      redis: {
        lock: {},
      },
    }
    this.rclient = {
      auth: sinon.stub(),
      del: sinon.stub().yields(),
      eval: sinon.stub(),
      exists: sinon.stub(),
      set: sinon.stub(),
    }
    this.RedisWrapper = {
      createClient: sinon.stub().returns(this.rclient),
    }
    this.Metrics = {
      inc: sinon.stub(),
      gauge: sinon.stub(),
      Timer: (Timer = (function () {
        Timer = class Timer {
          static initClass() {
            this.prototype.done = sinon.stub()
          }
        }
        Timer.initClass()
        return Timer
      })()),
    }
    this.logger = {
      debug: sinon.stub(),
    }
    this.LockManager = await esmock(MODULE_PATH, {
      '@overleaf/redis-wrapper': this.RedisWrapper,
      '@overleaf/settings': this.Settings,
      '@overleaf/metrics': this.Metrics,
      '@overleaf/logger': this.logger,
    })

    this.key = 'lock-key'
    this.callback = sinon.stub()
    this.clock = sinon.useFakeTimers()
  })

  afterEach(function () {
    this.clock.restore()
  })

  describe('checkLock', function () {
    describe('when the lock is taken', function () {
      beforeEach(function () {
        this.rclient.exists.yields(null, '1')
        return this.LockManager.checkLock(this.key, this.callback)
      })

      it('should check the lock in redis', function () {
        return this.rclient.exists.calledWith(this.key).should.equal(true)
      })

      return it('should return the callback with false', function () {
        return this.callback.calledWith(null, false).should.equal(true)
      })
    })

    return describe('when the lock is free', function () {
      beforeEach(function () {
        this.rclient.exists.yields(null, '0')
        return this.LockManager.checkLock(this.key, this.callback)
      })

      return it('should return the callback with true', function () {
        return this.callback.calledWith(null, true).should.equal(true)
      })
    })
  })

  describe('tryLock', function () {
    describe('when the lock is taken', function () {
      beforeEach(function () {
        this.rclient.set.yields(null, null)
        this.LockManager._mocks.randomLock = sinon
          .stub()
          .returns('locked-random-value')
        return this.LockManager.tryLock(this.key, this.callback)
      })

      it('should check the lock in redis', function () {
        return this.rclient.set.should.have.been.calledWith(
          this.key,
          'locked-random-value',
          'EX',
          this.LockManager.LOCK_TTL,
          'NX'
        )
      })

      return it('should return the callback with false', function () {
        return this.callback.calledWith(null, false).should.equal(true)
      })
    })

    return describe('when the lock is free', function () {
      beforeEach(function () {
        this.rclient.set.yields(null, 'OK')
        return this.LockManager.tryLock(this.key, this.callback)
      })

      return it('should return the callback with true', function () {
        return this.callback.calledWith(null, true).should.equal(true)
      })
    })
  })

  describe('deleteLock', function () {
    return beforeEach(function () {
      beforeEach(function () {
        return this.LockManager.deleteLock(this.key, this.callback)
      })

      it('should delete the lock in redis', function () {
        return this.rclient.del.calledWith(key).should.equal(true)
      })

      return it('should call the callback', function () {
        return this.callback.called.should.equal(true)
      })
    })
  })

  describe('getLock', function () {
    describe('when the lock is not taken', function () {
      beforeEach(function (done) {
        this.LockManager._mocks.tryLock = sinon.stub().yields(null, true)
        return this.LockManager.getLock(this.key, (...args) => {
          this.callback(...Array.from(args || []))
          return done()
        })
      })

      it('should try to get the lock', function () {
        return this.LockManager._mocks.tryLock
          .calledWith(this.key)
          .should.equal(true)
      })

      it('should only need to try once', function () {
        return this.LockManager._mocks.tryLock.callCount.should.equal(1)
      })

      return it('should return the callback', function () {
        return this.callback.calledWith(null).should.equal(true)
      })
    })

    describe('when the lock is initially set', function () {
      beforeEach(function (done) {
        this.LockManager._mocks.tryLock = sinon.stub()
        this.LockManager._mocks.tryLock.onCall(0).yields(null, false)
        this.LockManager._mocks.tryLock.onCall(1).yields(null, false)
        this.LockManager._mocks.tryLock.onCall(2).yields(null, false)
        this.LockManager._mocks.tryLock.onCall(3).yields(null, true)

        this.LockManager.getLock(this.key, (...args) => {
          this.callback(...args)
          return done()
        })
        this.clock.runAll()
      })

      it('should call tryLock multiple times until free', function () {
        this.LockManager._mocks.tryLock.callCount.should.equal(4)
      })

      return it('should return the callback', function () {
        return this.callback.calledWith(null).should.equal(true)
      })
    })

    return describe('when the lock times out', function () {
      beforeEach(function (done) {
        const time = Date.now()
        this.LockManager._mocks.tryLock = sinon.stub().yields(null, false)
        this.LockManager.getLock(this.key, (...args) => {
          this.callback(...args)
          return done()
        })
        this.clock.runAll()
      })

      return it('should return the callback with an error', function () {
        return this.callback
          .calledWith(sinon.match.instanceOf(Error))
          .should.equal(true)
      })
    })
  })

  return describe('runWithLock', function () {
    describe('with successful run', function () {
      beforeEach(function () {
        this.result = 'mock-result'
        this.runner = sinon.stub().callsFake((extendLock, releaseLock) => {
          return releaseLock(null, this.result)
        })
        this.LockManager._mocks.getLock = sinon.stub().yields()
        this.LockManager._mocks.releaseLock = sinon.stub().yields()
        return this.LockManager.runWithLock(
          this.key,
          this.runner,
          this.callback
        )
      })

      it('should get the lock', function () {
        return this.LockManager._mocks.getLock
          .calledWith(this.key)
          .should.equal(true)
      })

      it('should run the passed function', function () {
        return this.runner.called.should.equal(true)
      })

      it('should release the lock', function () {
        return this.LockManager._mocks.releaseLock
          .calledWith(this.key)
          .should.equal(true)
      })

      return it('should call the callback', function () {
        return this.callback.calledWith(null, this.result).should.equal(true)
      })
    })

    describe('when the runner function returns an error', function () {
      beforeEach(function () {
        this.error = new Error('oops')
        this.result = 'mock-result'
        this.runner = sinon.stub().callsFake((extendLock, releaseLock) => {
          return releaseLock(this.error, this.result)
        })
        this.LockManager._mocks.getLock = sinon.stub().yields()
        this.LockManager._mocks.releaseLock = sinon.stub().yields()
        return this.LockManager.runWithLock(
          this.key,
          this.runner,
          this.callback
        )
      })

      it('should release the lock', function () {
        return this.LockManager._mocks.releaseLock
          .calledWith(this.key)
          .should.equal(true)
      })

      return it('should call the callback with the error', function () {
        return this.callback
          .calledWith(this.error, this.result)
          .should.equal(true)
      })
    })

    describe('extending the lock whilst running', function () {
      beforeEach(function () {
        this.lockValue = 'lock-value'
        this.LockManager._mocks.getLock = sinon
          .stub()
          .yields(null, this.lockValue)
        this.LockManager._mocks.extendLock = sinon.stub().callsArg(2)
        this.LockManager._mocks.releaseLock = sinon.stub().callsArg(2)
      })

      it('should extend the lock if the minimum interval has been passed', function (done) {
        const runner = (extendLock, releaseLock) => {
          this.clock.tick(this.LockManager.MIN_LOCK_EXTENSION_INTERVAL + 1)
          return extendLock(releaseLock)
        }
        return this.LockManager.runWithLock(this.key, runner, () => {
          this.LockManager._mocks.extendLock
            .calledWith(this.key, this.lockValue)
            .should.equal(true)
          return done()
        })
      })

      return it('should not extend the lock if the minimum interval has not been passed', function (done) {
        const runner = (extendLock, releaseLock) => {
          this.clock.tick(this.LockManager.MIN_LOCK_EXTENSION_INTERVAL - 1)
          return extendLock(releaseLock)
        }
        return this.LockManager.runWithLock(this.key, runner, () => {
          this.LockManager._mocks.extendLock.callCount.should.equal(0)
          return done()
        })
      })
    })

    describe('exceeding the lock ttl', function () {
      beforeEach(function () {
        this.lockValue = 'lock-value'
        this.LockManager._mocks.getLock = sinon
          .stub()
          .yields(null, this.lockValue)
        this.LockManager._mocks.extendLock = sinon.stub().yields()
        this.LockManager._mocks.releaseLock = sinon.stub().yields()
        return (this.LOCK_TTL_MS = this.LockManager.LOCK_TTL * 1000)
      })

      it("doesn't log if the ttl wasn't exceeded", function (done) {
        const runner = (extendLock, releaseLock) => {
          this.clock.tick(this.LOCK_TTL_MS - 1)
          return releaseLock()
        }
        return this.LockManager.runWithLock(this.key, runner, () => {
          this.logger.debug.callCount.should.equal(0)
          return done()
        })
      })

      it("doesn't log if the lock was extended", function (done) {
        const runner = (extendLock, releaseLock) => {
          this.clock.tick(this.LOCK_TTL_MS - 1)
          return extendLock(() => {
            this.clock.tick(2)
            return releaseLock()
          })
        }
        return this.LockManager.runWithLock(this.key, runner, () => {
          this.logger.debug.callCount.should.equal(0)
          return done()
        })
      })

      return it('logs that the excecution exceeded the lock', function (done) {
        const runner = (extendLock, releaseLock) => {
          this.clock.tick(this.LOCK_TTL_MS + 1)
          return releaseLock()
        }
        return this.LockManager.runWithLock(this.key, runner, () => {
          const slowExecutionError = new Error('slow execution during lock')
          this.logger.debug
            .calledWithMatch('exceeded lock timeout', { key: this.key })
            .should.equal(true)
          return done()
        })
      })
    })

    return describe('releaseLock', function () {
      describe('when the lock is current', function () {
        beforeEach(function () {
          this.rclient.eval.yields(null, 1)
          return this.LockManager.releaseLock(
            this.key,
            this.lockValue,
            this.callback
          )
        })

        it('should clear the data from redis', function () {
          return this.rclient.eval
            .calledWith(
              this.LockManager.UNLOCK_SCRIPT,
              1,
              this.key,
              this.lockValue
            )
            .should.equal(true)
        })

        return it('should call the callback', function () {
          return this.callback.called.should.equal(true)
        })
      })

      return describe('when the lock has expired', function () {
        beforeEach(function () {
          this.rclient.eval.yields(null, 0)
          return this.LockManager.releaseLock(
            this.key,
            this.lockValue,
            this.callback
          )
        })

        return it('should return an error if the lock has expired', function () {
          return this.callback
            .calledWith(
              sinon.match.has('message', 'tried to release timed out lock')
            )
            .should.equal(true)
        })
      })
    })
  })
})
