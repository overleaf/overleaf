/* eslint-disable
    camelcase,
    no-return-assign,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const sinon = require('sinon')
const modulePath = '../../../../app/js/LockManager.js'
const SandboxedModule = require('sandboxed-module')

describe('LockManager - trying the lock', function () {
  beforeEach(function () {
    let Profiler
    this.LockManager = SandboxedModule.require(modulePath, {
      requires: {
        '@overleaf/redis-wrapper': {
          createClient: () => {
            return {
              auth() {},
              set: (this.set = sinon.stub()),
            }
          },
        },
        './Metrics': { inc() {} },
        '@overleaf/settings': {
          redis: {
            lock: {
              key_schema: {
                blockingKey({ doc_id }) {
                  return `Blocking:${doc_id}`
                },
              },
            },
          },
        },
        './Profiler':
          (this.Profiler = Profiler =
            (function () {
              Profiler = class Profiler {
                static initClass() {
                  this.prototype.log = sinon
                    .stub()
                    .returns({ end: sinon.stub() })
                  this.prototype.end = sinon.stub()
                }
              }
              Profiler.initClass()
              return Profiler
            })()),
      },
    })

    this.callback = sinon.stub()
    return (this.doc_id = 'doc-id-123')
  })

  describe('when the lock is not set', function () {
    beforeEach(function () {
      this.lockValue = 'mock-lock-value'
      this.LockManager.randomLock = sinon.stub().returns(this.lockValue)
      this.set.callsArgWith(5, null, 'OK')
      return this.LockManager.tryLock(this.doc_id, this.callback)
    })

    it('should set the lock key with an expiry if it is not set', function () {
      return this.set
        .calledWith(`Blocking:${this.doc_id}`, this.lockValue, 'EX', 30, 'NX')
        .should.equal(true)
    })

    return it('should return the callback with true and the lock value', function () {
      return this.callback
        .calledWith(null, true, this.lockValue)
        .should.equal(true)
    })
  })

  describe('when the lock is already set', function () {
    beforeEach(function () {
      this.set.callsArgWith(5, null, null)
      return this.LockManager.tryLock(this.doc_id, this.callback)
    })

    return it('should return the callback with false', function () {
      return this.callback.calledWith(null, false).should.equal(true)
    })
  })

  return describe('when it takes a long time for redis to set the lock', function () {
    beforeEach(function () {
      this.Profiler.prototype.end = () => 7000 // take a long time
      this.Profiler.prototype.log = sinon
        .stub()
        .returns({ end: this.Profiler.prototype.end })
      this.lockValue = 'mock-lock-value'
      this.LockManager.randomLock = sinon.stub().returns(this.lockValue)
      this.LockManager.releaseLock = sinon.stub().callsArgWith(2, null)
      return this.set.callsArgWith(5, null, 'OK')
    })

    describe('in all cases', function () {
      beforeEach(function () {
        return this.LockManager.tryLock(this.doc_id, this.callback)
      })

      it('should set the lock key with an expiry if it is not set', function () {
        return this.set
          .calledWith(`Blocking:${this.doc_id}`, this.lockValue, 'EX', 30, 'NX')
          .should.equal(true)
      })

      return it('should try to release the lock', function () {
        return this.LockManager.releaseLock
          .calledWith(this.doc_id, this.lockValue)
          .should.equal(true)
      })
    })

    describe('if the lock is released successfully', function () {
      beforeEach(function () {
        this.LockManager.releaseLock = sinon.stub().callsArgWith(2, null)
        return this.LockManager.tryLock(this.doc_id, this.callback)
      })

      return it('should return the callback with false', function () {
        return this.callback.calledWith(null, false).should.equal(true)
      })
    })

    return describe('if the lock has already timed out', function () {
      beforeEach(function () {
        this.LockManager.releaseLock = sinon
          .stub()
          .callsArgWith(2, new Error('tried to release timed out lock'))
        return this.LockManager.tryLock(this.doc_id, this.callback)
      })

      return it('should return the callback with an error', function () {
        return this.callback
          .calledWith(sinon.match.instanceOf(Error))
          .should.equal(true)
      })
    })
  })
})
