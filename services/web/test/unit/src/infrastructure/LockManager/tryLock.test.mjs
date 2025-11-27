import { vi } from 'vitest'
/* eslint-disable
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
import sinon from 'sinon'

import path from 'node:path'
const modulePath = path.join(
  import.meta.dirname,
  '../../../../../app/src/infrastructure/LockManager.mjs'
)

describe('LockManager - trying the lock', function () {
  beforeEach(async function (ctx) {
    vi.doMock('../../../../../app/src/infrastructure/RedisWrapper', () => ({
      default: {
        client: () => {
          return {
            auth() {},
            set: (ctx.set = sinon.stub()),
          }
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
      },
    }))

    ctx.LockManager = (await import(modulePath)).default
    ctx.callback = sinon.stub()
    ctx.key = 'lock:web:lockName:project-id}'
    return (ctx.namespace = 'lockName')
  })

  describe('when the lock is not set', function () {
    beforeEach(function (ctx) {
      ctx.set.callsArgWith(5, null, 'OK')
      ctx.LockManager.randomLock = sinon.stub().returns('random-lock-value')
      return ctx.LockManager._tryLock(ctx.key, ctx.namespace, ctx.callback)
    })

    it('should set the lock key with an expiry if it is not set', function (ctx) {
      return ctx.set
        .calledWith(ctx.key, 'random-lock-value', 'EX', 30, 'NX')
        .should.equal(true)
    })

    it('should return the callback with true', function (ctx) {
      return ctx.callback.calledWith(null, true).should.equal(true)
    })
  })

  describe('when the lock is already set', function () {
    beforeEach(function (ctx) {
      ctx.set.callsArgWith(5, null, null)
      return ctx.LockManager._tryLock(ctx.key, ctx.namespace, ctx.callback)
    })

    it('should return the callback with false', function (ctx) {
      return ctx.callback.calledWith(null, false).should.equal(true)
    })
  })
})
