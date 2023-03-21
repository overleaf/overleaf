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
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const sinon = require('sinon')
const { expect } = require('chai')
const modulePath = '../../../../app/js/LockManager.js'
const SandboxedModule = require('sandboxed-module')

describe('LockManager', function () {
  beforeEach(function () {
    this.Settings = {
      redis: {
        lock: {},
      },
    }
    this.LockManager = SandboxedModule.require(modulePath, {
      requires: {
        '@overleaf/redis-wrapper': {
          createClient: () => {
            return (this.rclient = { auth: sinon.stub() })
          },
        },
        '@overleaf/settings': this.Settings,
      },
    })

    this.key = 'lock-key'
    return (this.callback = sinon.stub())
  })

  describe('checkLock', function () {
    describe('when the lock is taken', function () {
      beforeEach(function () {
        this.rclient.exists = sinon.stub().callsArgWith(1, null, '1')
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
        this.rclient.exists = sinon.stub().callsArgWith(1, null, '0')
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
        this.rclient.set = sinon.stub().callsArgWith(5, null, null)
        this.LockManager.randomLock = sinon
          .stub()
          .returns('locked-random-value')
        return this.LockManager.tryLock(this.key, this.callback)
      })

      it('should check the lock in redis', function () {
        return this.rclient.set
          .calledWith(
            this.key,
            'locked-random-value',
            'EX',
            this.LockManager.LOCK_TTL,
            'NX'
          )
          .should.equal(true)
      })

      return it('should return the callback with false', function () {
        return this.callback.calledWith(null, false).should.equal(true)
      })
    })

    return describe('when the lock is free', function () {
      beforeEach(function () {
        this.rclient.set = sinon.stub().callsArgWith(5, null, 'OK')
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
        this.rclient.del = sinon.stub().callsArg(1)
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
        this.LockManager.tryLock = sinon.stub().callsArgWith(1, null, true)
        return this.LockManager.getLock(this.key, (...args) => {
          this.callback(...Array.from(args || []))
          return done()
        })
      })

      it('should try to get the lock', function () {
        return this.LockManager.tryLock.calledWith(this.key).should.equal(true)
      })

      it('should only need to try once', function () {
        return this.LockManager.tryLock.callCount.should.equal(1)
      })

      return it('should return the callback', function () {
        return this.callback.calledWith(null).should.equal(true)
      })
    })

    describe('when the lock is initially set', function () {
      beforeEach(function (done) {
        const startTime = Date.now()
        this.LockManager.LOCK_TEST_INTERVAL = 5
        this.LockManager.tryLock = function (docId, callback) {
          if (callback == null) {
            callback = function () {}
          }
          if (Date.now() - startTime < 100) {
            return callback(null, false)
          } else {
            return callback(null, true)
          }
        }
        sinon.spy(this.LockManager, 'tryLock')

        return this.LockManager.getLock(this.key, (...args) => {
          this.callback(...Array.from(args || []))
          return done()
        })
      })

      it('should call tryLock multiple times until free', function () {
        return (this.LockManager.tryLock.callCount > 1).should.equal(true)
      })

      return it('should return the callback', function () {
        return this.callback.calledWith(null).should.equal(true)
      })
    })

    return describe('when the lock times out', function () {
      beforeEach(function (done) {
        const time = Date.now()
        this.LockManager.MAX_LOCK_WAIT_TIME = 5
        this.LockManager.tryLock = sinon.stub().callsArgWith(1, null, false)
        return this.LockManager.getLock(this.key, (...args) => {
          this.callback(...Array.from(args || []))
          return done()
        })
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
        this.runner = function (releaseLock) {
          if (releaseLock == null) {
            releaseLock = function () {}
          }
          return releaseLock()
        }
        sinon.spy(this, 'runner')
        this.LockManager.getLock = sinon.stub().callsArg(1)
        this.LockManager.releaseLock = sinon.stub().callsArg(2)
        return this.LockManager.runWithLock(
          this.key,
          this.runner,
          this.callback
        )
      })

      it('should get the lock', function () {
        return this.LockManager.getLock.calledWith(this.key).should.equal(true)
      })

      it('should run the passed function', function () {
        return this.runner.called.should.equal(true)
      })

      it('should release the lock', function () {
        return this.LockManager.releaseLock
          .calledWith(this.key)
          .should.equal(true)
      })

      return it('should call the callback', function () {
        return this.callback.called.should.equal(true)
      })
    })

    describe('when the runner function returns an error', function () {
      beforeEach(function () {
        this.error = new Error('oops')
        this.runner = releaseLock => {
          if (releaseLock == null) {
            releaseLock = function () {}
          }
          return releaseLock(this.error)
        }
        sinon.spy(this, 'runner')
        this.LockManager.getLock = sinon.stub().callsArg(1)
        this.LockManager.releaseLock = sinon.stub().callsArg(2)
        return this.LockManager.runWithLock(
          this.key,
          this.runner,
          this.callback
        )
      })

      it('should release the lock', function () {
        return this.LockManager.releaseLock
          .calledWith(this.key)
          .should.equal(true)
      })

      return it('should call the callback with the error', function () {
        return this.callback.calledWith(this.error).should.equal(true)
      })
    })

    return describe('releaseLock', function () {
      describe('when the lock is current', function () {
        beforeEach(function () {
          this.rclient.eval = sinon.stub().yields(null, 1)
          return this.LockManager.releaseLock(
            this.key,
            this.lockValue,
            this.callback
          )
        })

        it('should clear the data from redis', function () {
          return this.rclient.eval
            .calledWith(
              this.LockManager.unlockScript,
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
          this.rclient.eval = sinon.stub().yields(null, 0)
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
