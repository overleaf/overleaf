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
const sinon = require('sinon')
const chai = require('chai')
const should = chai.should()
const path = require('path')
const modulePath = path.join(
  __dirname,
  '../../../../../app/src/infrastructure/LockManager.js'
)
const SandboxedModule = require('sandboxed-module')

describe('LockManager - trying the lock', function() {
  beforeEach(function() {
    this.LockManager = SandboxedModule.require(modulePath, {
      globals: {
        console: console
      },
      requires: {
        'logger-sharelatex': {
          log() {}
        },
        './RedisWrapper': {
          client: () => {
            return {
              auth() {},
              set: (this.set = sinon.stub())
            }
          }
        },
        'settings-sharelatex': { redis: {} },
        'metrics-sharelatex': {
          inc() {}
        }
      }
    })
    this.callback = sinon.stub()
    this.key = 'lock:web:lockName:project-id}'
    return (this.namespace = 'lockName')
  })

  describe('when the lock is not set', function() {
    beforeEach(function() {
      this.set.callsArgWith(5, null, 'OK')
      this.LockManager.randomLock = sinon.stub().returns('random-lock-value')
      return this.LockManager._tryLock(this.key, this.namespace, this.callback)
    })

    it('should set the lock key with an expiry if it is not set', function() {
      return this.set
        .calledWith(this.key, 'random-lock-value', 'EX', 30, 'NX')
        .should.equal(true)
    })

    it('should return the callback with true', function() {
      return this.callback.calledWith(null, true).should.equal(true)
    })
  })

  describe('when the lock is already set', function() {
    beforeEach(function() {
      this.set.callsArgWith(5, null, null)
      return this.LockManager._tryLock(this.key, this.namespace, this.callback)
    })

    it('should return the callback with false', function() {
      return this.callback.calledWith(null, false).should.equal(true)
    })
  })
})
