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
const assert = require('assert')
const path = require('path')
const modulePath = path.join(__dirname, '../../../../app/js/LockManager.js')
const project_id = 1234
const doc_id = 5678
const SandboxedModule = require('sandboxed-module')

describe('LockManager - releasing the lock', function () {
  beforeEach(function () {
    let Profiler
    this.client = {
      auth() {},
      eval: sinon.stub(),
    }
    const mocks = {
      '@overleaf/redis-wrapper': {
        createClient: () => this.client,
      },
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
    }
    this.LockManager = SandboxedModule.require(modulePath, { requires: mocks })
    this.lockValue = 'lock-value-stub'
    return (this.callback = sinon.stub())
  })

  describe('when the lock is current', function () {
    beforeEach(function () {
      this.client.eval = sinon.stub().yields(null, 1)
      return this.LockManager.releaseLock(doc_id, this.lockValue, this.callback)
    })

    it('should clear the data from redis', function () {
      return this.client.eval
        .calledWith(
          this.LockManager.unlockScript,
          1,
          `Blocking:${doc_id}`,
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
      this.client.eval = sinon.stub().yields(null, 0)
      return this.LockManager.releaseLock(doc_id, this.lockValue, this.callback)
    })

    return it('should return an error if the lock has expired', function () {
      return this.callback
        .calledWith(sinon.match.instanceOf(Error))
        .should.equal(true)
    })
  })
})
