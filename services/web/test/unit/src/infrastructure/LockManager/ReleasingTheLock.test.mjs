/* eslint-disable
    max-len,
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
import { vi } from 'vitest'
const modulePath = path.join(
  import.meta.dirname,
  '../../../../../app/src/infrastructure/LockManager.mjs'
)
const lockKey = `lock:web:{${5678}}`
const lockValue = '123456'

describe('LockManager - releasing the lock', function () {
  let LockManager
  const deleteStub = sinon.stub().callsArgWith(4)
  beforeEach(async function () {
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
    vi.doMock('@overleaf/metrics', () => ({}))
    vi.doMock('../../../../../app/src/infrastructure/RedisWrapper', () => ({
      default: {
        client() {
          return {
            auth() {},
            eval: deleteStub,
          }
        },
      },
    }))

    LockManager = (await import(modulePath)).default
    LockManager.unlockScript = 'this is the unlock script'
  })

  it('should put all data into memory', async function () {
    await new Promise(resolve => {
      return LockManager._releaseLock(lockKey, lockValue, () => {
        deleteStub
          .calledWith(LockManager.unlockScript, 1, lockKey, lockValue)
          .should.equal(true)
        return resolve()
      })
    })
  })
})
