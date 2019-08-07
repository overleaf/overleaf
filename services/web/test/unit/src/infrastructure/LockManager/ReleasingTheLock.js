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
const sinon = require('sinon')
const assert = require('assert')
const path = require('path')
const modulePath = path.join(
  __dirname,
  '../../../../../app/src/infrastructure/LockManager.js'
)
const lockKey = `lock:web:{${5678}}`
const lockValue = '123456'
const SandboxedModule = require('sandboxed-module')

describe('LockManager - releasing the lock', function() {
  const deleteStub = sinon.stub().callsArgWith(4)
  const mocks = {
    'logger-sharelatex': {
      log() {}
    },

    './RedisWrapper': {
      client() {
        return {
          auth() {},
          eval: deleteStub
        }
      }
    }
  }

  const LockManager = SandboxedModule.require(modulePath, { requires: mocks })
  LockManager.unlockScript = 'this is the unlock script'

  it('should put a all data into memory', function(done) {
    return LockManager._releaseLock(lockKey, lockValue, () => {
      deleteStub
        .calledWith(LockManager.unlockScript, 1, lockKey, lockValue)
        .should.equal(true)
      return done()
    })
  })
})
