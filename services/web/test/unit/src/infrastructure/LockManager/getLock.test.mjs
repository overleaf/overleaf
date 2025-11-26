import { vi } from 'vitest'
/* eslint-disable
    n/handle-callback-err,
    max-len,
    no-return-assign,
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
import sinon from 'sinon'

import path from 'node:path'
const modulePath = path.join(
  import.meta.dirname,
  '../../../../../app/src/infrastructure/LockManager.mjs'
)

describe('LockManager - getting the lock', function () {
  beforeEach(async function (ctx) {
    vi.doMock('../../../../../app/src/infrastructure/RedisWrapper', () => ({
      default: {
        client() {
          return { auth() {} }
        },
      },
    }))

    vi.doMock('@overleaf/settings', () => ({
      default: {
        redis: {},
        lockManager: {
          lockTestInterval: 50,
          maxTestInterval: 1000,
          maxLockWaitTime: 10000,
          redisLockExpiry: 30,
          slowExecutionThreshold: 5000,
        },
      },
    }))

    vi.doMock('@overleaf/metrics', () => ({
      default: {
        inc() {},
        gauge() {},
      },
    }))

    ctx.LockManager = (await import(modulePath)).default

    ctx.callback = sinon.stub()
    ctx.key = 'lock:web:lockName:project-id}'
    return (ctx.namespace = 'lockName')
  })

  describe('when the lock is not set', function () {
    beforeEach(async function (ctx) {
      await new Promise(resolve => {
        ctx.LockManager._tryLock = sinon.stub().yields(null, true)
        return ctx.LockManager._getLock(ctx.key, ctx.namespace, (...args) => {
          ctx.callback(...Array.from(args || []))
          return resolve()
        })
      })
    })

    it('should try to get the lock', function (ctx) {
      return ctx.LockManager._tryLock
        .calledWith(ctx.key, ctx.namespace)
        .should.equal(true)
    })

    it('should only need to try once', function (ctx) {
      return ctx.LockManager._tryLock.callCount.should.equal(1)
    })

    it('should return the callback', function (ctx) {
      return ctx.callback.calledWith(null).should.equal(true)
    })

    it('should clear the lock queue', function (ctx) {
      ctx.LockManager._lockQueuesSize().should.equal(0)
    })
  })

  describe('when the lock is initially set', function () {
    beforeEach(async function (ctx) {
      await new Promise(resolve => {
        const startTime = Date.now()
        let tries = 0
        ctx.LockManager.LOCK_TEST_INTERVAL = 5
        ctx.LockManager._tryLock = function (key, namespace, callback) {
          if (callback == null) {
            callback = function () {}
          }
          if (Date.now() - startTime < 20 || tries < 2) {
            tries = tries + 1
            return callback(null, false)
          } else {
            return callback(null, true)
          }
        }
        sinon.spy(ctx.LockManager, '_tryLock')

        return ctx.LockManager._getLock(ctx.key, ctx.namespace, (...args) => {
          ctx.callback(...Array.from(args || []))
          return resolve()
        })
      })
    })

    it('should call tryLock multiple times until free', function (ctx) {
      return (ctx.LockManager._tryLock.callCount > 1).should.equal(true)
    })

    it('should return the callback', function (ctx) {
      return ctx.callback.calledWith(null).should.equal(true)
    })

    it('should clear the lock queue', function (ctx) {
      ctx.LockManager._lockQueuesSize().should.equal(0)
    })
  })

  describe('when the lock times out', function () {
    beforeEach(async function (ctx) {
      await new Promise(resolve => {
        const time = Date.now()
        ctx.LockManager.LOCK_TEST_INTERVAL = 1
        ctx.LockManager.MAX_LOCK_WAIT_TIME = 5
        ctx.LockManager._tryLock = sinon.stub().yields(null, false)
        return ctx.LockManager._getLock(ctx.key, ctx.namespace, (...args) => {
          ctx.callback(...Array.from(args || []))
          return resolve()
        })
      })
    })

    it('should return the callback with an error', function (ctx) {
      ctx.callback.should.have.been.calledWith(
        sinon.match.instanceOf(Error).and(sinon.match.has('message', 'Timeout'))
      )
    })
  })

  describe('when there are multiple requests for the same lock', function () {
    beforeEach(async function (ctx) {
      await new Promise(resolve => {
        let locked = false
        ctx.results = []
        ctx.LockManager.LOCK_TEST_INTERVAL = 1
        ctx.LockManager._tryLock = function (key, namespace, callback) {
          if (callback == null) {
            callback = function () {}
          }
          if (locked) {
            return callback(null, false)
          } else {
            locked = true // simulate getting the lock
            return callback(null, true)
          }
        }
        // Start ten lock requests in order at 1ms 2ms 3ms...
        // with them randomly holding the lock for 0-10ms.
        // Use predefined values for the random delay to make the test
        // deterministic.
        const randomDelays = [5, 4, 1, 8, 6, 8, 3, 4, 2, 4]
        let startTime = 0
        return Array.from(randomDelays).map((randomDelay, i) =>
          ((randomDelay, i) => {
            startTime += 1
            return setTimeout(() => {
              // changing the next line to the old method of LockManager._getLockByPolling
              // should give results in a random order and cause the test to fail.
              return ctx.LockManager._getLock(
                ctx.key,
                ctx.namespace,
                (...args) => {
                  setTimeout(
                    () => (locked = false), // release the lock after a random amount of time
                    randomDelay
                  )
                  ctx.results.push(i)
                  if (ctx.results.length === 10) {
                    return resolve()
                  }
                }
              )
            }, startTime)
          })(randomDelay, i)
        )
      })
    })

    it('should process the requests in order', function (ctx) {
      return ctx.results.should.deep.equal([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
    })

    it('should clear the lock queue', function (ctx) {
      ctx.LockManager._lockQueuesSize().should.equal(0)
    })
  })
})
