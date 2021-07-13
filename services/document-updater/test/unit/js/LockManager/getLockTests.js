/* eslint-disable
    camelcase,
    handle-callback-err,
    no-return-assign,
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
const sinon = require('sinon')
const modulePath = '../../../../app/js/LockManager.js'
const SandboxedModule = require('sandboxed-module')

describe('LockManager - getting the lock', function () {
  beforeEach(function () {
    let Profiler
    this.LockManager = SandboxedModule.require(modulePath, {
      requires: {
        '@overleaf/redis-wrapper': {
          createClient: () => {
            return { auth() {} }
          },
        },
        './Metrics': { inc() {} },
        './Profiler': (Profiler = (function () {
          Profiler = class Profiler {
            static initClass() {
              this.prototype.log = sinon.stub().returns({ end: sinon.stub() })
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
    beforeEach(function (done) {
      this.lockValue = 'mock-lock-value'
      this.LockManager.tryLock = sinon
        .stub()
        .callsArgWith(1, null, true, this.lockValue)
      return this.LockManager.getLock(this.doc_id, (...args) => {
        this.callback(...Array.from(args || []))
        return done()
      })
    })

    it('should try to get the lock', function () {
      return this.LockManager.tryLock.calledWith(this.doc_id).should.equal(true)
    })

    it('should only need to try once', function () {
      return this.LockManager.tryLock.callCount.should.equal(1)
    })

    return it('should return the callback with the lock value', function () {
      return this.callback.calledWith(null, this.lockValue).should.equal(true)
    })
  })

  describe('when the lock is initially set', function () {
    beforeEach(function (done) {
      this.lockValue = 'mock-lock-value'
      const startTime = Date.now()
      let tries = 0
      this.LockManager.LOCK_TEST_INTERVAL = 5
      this.LockManager.tryLock = (doc_id, callback) => {
        if (callback == null) {
          callback = function (error, isFree) {}
        }
        if (Date.now() - startTime < 20 || tries < 2) {
          tries = tries + 1
          return callback(null, false)
        } else {
          return callback(null, true, this.lockValue)
        }
      }
      sinon.spy(this.LockManager, 'tryLock')

      return this.LockManager.getLock(this.doc_id, (...args) => {
        this.callback(...Array.from(args || []))
        return done()
      })
    })

    it('should call tryLock multiple times until free', function () {
      return (this.LockManager.tryLock.callCount > 1).should.equal(true)
    })

    return it('should return the callback with the lock value', function () {
      return this.callback.calledWith(null, this.lockValue).should.equal(true)
    })
  })

  return describe('when the lock times out', function () {
    beforeEach(function (done) {
      const time = Date.now()
      this.LockManager.MAX_LOCK_WAIT_TIME = 5
      this.LockManager.tryLock = sinon.stub().callsArgWith(1, null, false)
      return this.LockManager.getLock(this.doc_id, (...args) => {
        this.callback(...Array.from(args || []))
        return done()
      })
    })

    return it('should return the callback with an error', function () {
      return this.callback
        .calledWith(
          sinon.match
            .instanceOf(Error)
            .and(sinon.match.has('doc_id', this.doc_id))
        )
        .should.equal(true)
    })
  })
})
