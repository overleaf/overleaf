/* eslint-disable
    handle-callback-err,
    no-return-assign,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const sinon = require('sinon')
const modulePath = '../../../../app/js/DispatchManager.js'
const SandboxedModule = require('sandboxed-module')
const Errors = require('../../../../app/js/Errors.js')

describe('DispatchManager', function () {
  beforeEach(function () {
    let Timer
    this.timeout(3000)
    this.DispatchManager = SandboxedModule.require(modulePath, {
      requires: {
        './UpdateManager': (this.UpdateManager = {}),
        '@overleaf/settings': (this.settings = {
          redis: {
            documentupdater: {},
          },
        }),
        '@overleaf/redis-wrapper': (this.redis = {}),
        './RateLimitManager': {},
        './Errors': Errors,
        './Metrics': (this.Metrics = {
          Timer: (Timer = (function () {
            Timer = class Timer {
              static initClass() {
                this.prototype.done = sinon.stub()
              }
            }
            Timer.initClass()
            return Timer
          })()),
        }),
      },
    })
    this.callback = sinon.stub()
    return (this.RateLimiter = {
      run(task, cb) {
        return task(cb)
      },
    })
  }) // run task without rate limit

  return describe('each worker', function () {
    beforeEach(function () {
      this.client = { auth: sinon.stub() }
      this.redis.createClient = sinon.stub().returns(this.client)
      return (this.worker = this.DispatchManager.createDispatcher(
        this.RateLimiter,
        0
      ))
    })

    it('should create a new redis client', function () {
      return this.redis.createClient.called.should.equal(true)
    })

    describe('_waitForUpdateThenDispatchWorker', function () {
      beforeEach(function () {
        this.project_id = 'project-id-123'
        this.doc_id = 'doc-id-123'
        this.doc_key = `${this.project_id}:${this.doc_id}`
        return (this.client.blpop = sinon
          .stub()
          .callsArgWith(2, null, ['pending-updates-list', this.doc_key]))
      })

      describe('in the normal case', function () {
        beforeEach(function () {
          this.UpdateManager.processOutstandingUpdatesWithLock = sinon
            .stub()
            .callsArg(2)
          return this.worker._waitForUpdateThenDispatchWorker(this.callback)
        })

        it('should call redis with BLPOP', function () {
          return this.client.blpop
            .calledWith('pending-updates-list', 0)
            .should.equal(true)
        })

        it('should call processOutstandingUpdatesWithLock', function () {
          return this.UpdateManager.processOutstandingUpdatesWithLock
            .calledWith(this.project_id, this.doc_id)
            .should.equal(true)
        })

        it('should not log any errors', function () {
          this.logger.error.called.should.equal(false)
          return this.logger.warn.called.should.equal(false)
        })

        return it('should call the callback', function () {
          return this.callback.called.should.equal(true)
        })
      })

      describe('with an error', function () {
        beforeEach(function () {
          this.UpdateManager.processOutstandingUpdatesWithLock = sinon
            .stub()
            .callsArgWith(2, new Error('a generic error'))
          return this.worker._waitForUpdateThenDispatchWorker(this.callback)
        })

        it('should log an error', function () {
          return this.logger.error.called.should.equal(true)
        })

        return it('should call the callback', function () {
          return this.callback.called.should.equal(true)
        })
      })

      describe("with a 'Delete component' error", function () {
        beforeEach(function () {
          this.UpdateManager.processOutstandingUpdatesWithLock = sinon
            .stub()
            .callsArgWith(2, new Errors.DeleteMismatchError())
          return this.worker._waitForUpdateThenDispatchWorker(this.callback)
        })

        it('should log a warning', function () {
          return this.logger.warn.called.should.equal(true)
        })

        return it('should call the callback', function () {
          return this.callback.called.should.equal(true)
        })
      })

      describe('pending updates list with shard key', function () {
        beforeEach(function (done) {
          this.client = {
            auth: sinon.stub(),
            blpop: sinon.stub().callsArgWith(2),
          }
          this.redis.createClient = sinon.stub().returns(this.client)
          this.queueShardNumber = 7
          this.worker = this.DispatchManager.createDispatcher(
            this.RateLimiter,
            this.queueShardNumber
          )
          this.worker._waitForUpdateThenDispatchWorker(done)
        })

        it('should call redis with BLPOP with the correct key', function () {
          this.client.blpop
            .calledWith(`pending-updates-list-${this.queueShardNumber}`, 0)
            .should.equal(true)
        })
      })
    })

    return describe('run', function () {
      return it('should call _waitForUpdateThenDispatchWorker until shutting down', function (done) {
        let callCount = 0
        this.worker._waitForUpdateThenDispatchWorker = callback => {
          if (callback == null) {
            callback = function (error) {}
          }
          callCount++
          if (callCount === 3) {
            this.settings.shuttingDown = true
          }
          return setTimeout(() => callback(), 10)
        }
        sinon.spy(this.worker, '_waitForUpdateThenDispatchWorker')

        this.worker.run()

        var checkStatus = () => {
          if (!this.settings.shuttingDown) {
            // retry until shutdown
            setTimeout(checkStatus, 100)
          } else {
            this.worker._waitForUpdateThenDispatchWorker.callCount.should.equal(
              3
            )
            return done()
          }
        }

        return checkStatus()
      })
    })
  })
})
