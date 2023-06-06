/* eslint-disable
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS206: Consider reworking classes to avoid initClass
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const sinon = require('sinon')
const modulePath = '../../../../app/js/UpdateManager.js'
const SandboxedModule = require('sandboxed-module')

describe('UpdateManager', function () {
  beforeEach(function () {
    let Profiler, Timer
    this.project_id = 'project-id-123'
    this.projectHistoryId = 'history-id-123'
    this.doc_id = 'document-id-123'
    this.callback = sinon.stub()
    this.UpdateManager = SandboxedModule.require(modulePath, {
      requires: {
        './LockManager': (this.LockManager = {}),
        './RedisManager': (this.RedisManager = {}),
        './RealTimeRedisManager': (this.RealTimeRedisManager = {}),
        './ShareJsUpdateManager': (this.ShareJsUpdateManager = {}),
        './HistoryManager': (this.HistoryManager = {}),
        './Metrics': (this.Metrics = {
          inc: sinon.stub(),
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
        '@overleaf/settings': (this.Settings = {}),
        './DocumentManager': (this.DocumentManager = {}),
        './RangesManager': (this.RangesManager = {}),
        './SnapshotManager': (this.SnapshotManager = {}),
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
  })

  describe('processOutstandingUpdates', function () {
    beforeEach(function () {
      this.UpdateManager.fetchAndApplyUpdates = sinon.stub().callsArg(2)
      this.UpdateManager.processOutstandingUpdates(
        this.project_id,
        this.doc_id,
        this.callback
      )
    })

    it('should apply the updates', function () {
      this.UpdateManager.fetchAndApplyUpdates
        .calledWith(this.project_id, this.doc_id)
        .should.equal(true)
    })

    it('should call the callback', function () {
      this.callback.called.should.equal(true)
    })

    it('should time the execution', function () {
      this.Metrics.Timer.prototype.done.called.should.equal(true)
    })
  })

  describe('processOutstandingUpdatesWithLock', function () {
    describe('when the lock is free', function () {
      beforeEach(function () {
        this.LockManager.tryLock = sinon
          .stub()
          .callsArgWith(1, null, true, (this.lockValue = 'mock-lock-value'))
        this.LockManager.releaseLock = sinon.stub().callsArg(2)
        this.UpdateManager.continueProcessingUpdatesWithLock = sinon
          .stub()
          .callsArg(2)
        this.UpdateManager.processOutstandingUpdates = sinon.stub().callsArg(2)
      })

      describe('successfully', function () {
        beforeEach(function () {
          this.UpdateManager.processOutstandingUpdatesWithLock(
            this.project_id,
            this.doc_id,
            this.callback
          )
        })

        it('should acquire the lock', function () {
          this.LockManager.tryLock.calledWith(this.doc_id).should.equal(true)
        })

        it('should free the lock', function () {
          this.LockManager.releaseLock
            .calledWith(this.doc_id, this.lockValue)
            .should.equal(true)
        })

        it('should process the outstanding updates', function () {
          this.UpdateManager.processOutstandingUpdates
            .calledWith(this.project_id, this.doc_id)
            .should.equal(true)
        })

        it('should do everything with the lock acquired', function () {
          this.UpdateManager.processOutstandingUpdates
            .calledAfter(this.LockManager.tryLock)
            .should.equal(true)
          this.UpdateManager.processOutstandingUpdates
            .calledBefore(this.LockManager.releaseLock)
            .should.equal(true)
        })

        it('should continue processing new updates that may have come in', function () {
          this.UpdateManager.continueProcessingUpdatesWithLock
            .calledWith(this.project_id, this.doc_id)
            .should.equal(true)
        })

        it('should return the callback', function () {
          this.callback.called.should.equal(true)
        })
      })

      describe('when processOutstandingUpdates returns an error', function () {
        beforeEach(function () {
          this.UpdateManager.processOutstandingUpdates = sinon
            .stub()
            .callsArgWith(2, (this.error = new Error('Something went wrong')))
          this.UpdateManager.processOutstandingUpdatesWithLock(
            this.project_id,
            this.doc_id,
            this.callback
          )
        })

        it('should free the lock', function () {
          this.LockManager.releaseLock
            .calledWith(this.doc_id, this.lockValue)
            .should.equal(true)
        })

        it('should return the error in the callback', function () {
          this.callback.calledWith(this.error).should.equal(true)
        })
      })
    })

    describe('when the lock is taken', function () {
      beforeEach(function () {
        this.LockManager.tryLock = sinon.stub().callsArgWith(1, null, false)
        this.UpdateManager.processOutstandingUpdates = sinon.stub().callsArg(2)
        this.UpdateManager.processOutstandingUpdatesWithLock(
          this.project_id,
          this.doc_id,
          this.callback
        )
      })

      it('should return the callback', function () {
        this.callback.called.should.equal(true)
      })

      it('should not process the updates', function () {
        this.UpdateManager.processOutstandingUpdates.called.should.equal(false)
      })
    })
  })

  describe('continueProcessingUpdatesWithLock', function () {
    describe('when there are outstanding updates', function () {
      beforeEach(function () {
        this.RealTimeRedisManager.getUpdatesLength = sinon
          .stub()
          .callsArgWith(1, null, 3)
        this.UpdateManager.processOutstandingUpdatesWithLock = sinon
          .stub()
          .callsArg(2)
        this.UpdateManager.continueProcessingUpdatesWithLock(
          this.project_id,
          this.doc_id,
          this.callback
        )
      })

      it('should process the outstanding updates', function () {
        this.UpdateManager.processOutstandingUpdatesWithLock
          .calledWith(this.project_id, this.doc_id)
          .should.equal(true)
      })

      it('should return the callback', function () {
        this.callback.called.should.equal(true)
      })
    })

    describe('when there are no outstanding updates', function () {
      beforeEach(function () {
        this.RealTimeRedisManager.getUpdatesLength = sinon
          .stub()
          .callsArgWith(1, null, 0)
        this.UpdateManager.processOutstandingUpdatesWithLock = sinon
          .stub()
          .callsArg(2)
        this.UpdateManager.continueProcessingUpdatesWithLock(
          this.project_id,
          this.doc_id,
          this.callback
        )
      })

      it('should not try to process the outstanding updates', function () {
        this.UpdateManager.processOutstandingUpdatesWithLock.called.should.equal(
          false
        )
      })

      it('should return the callback', function () {
        this.callback.called.should.equal(true)
      })
    })
  })

  describe('fetchAndApplyUpdates', function () {
    describe('with updates', function () {
      beforeEach(function () {
        this.updates = [{ p: 1, t: 'foo' }]
        this.updatedDocLines = ['updated', 'lines']
        this.version = 34
        this.RealTimeRedisManager.getPendingUpdatesForDoc = sinon
          .stub()
          .callsArgWith(1, null, this.updates)
        this.UpdateManager.applyUpdate = sinon
          .stub()
          .callsArgWith(3, null, this.updatedDocLines, this.version)
        this.UpdateManager.fetchAndApplyUpdates(
          this.project_id,
          this.doc_id,
          this.callback
        )
      })

      it('should get the pending updates', function () {
        this.RealTimeRedisManager.getPendingUpdatesForDoc
          .calledWith(this.doc_id)
          .should.equal(true)
      })

      it('should apply the updates', function () {
        Array.from(this.updates).map(update =>
          this.UpdateManager.applyUpdate
            .calledWith(this.project_id, this.doc_id, update)
            .should.equal(true)
        )
      })

      it('should call the callback', function () {
        this.callback.called.should.equal(true)
      })
    })

    describe('when there are no updates', function () {
      beforeEach(function () {
        this.updates = []
        this.RealTimeRedisManager.getPendingUpdatesForDoc = sinon
          .stub()
          .callsArgWith(1, null, this.updates)
        this.UpdateManager.applyUpdate = sinon.stub()
        this.RedisManager.setDocument = sinon.stub()
        this.UpdateManager.fetchAndApplyUpdates(
          this.project_id,
          this.doc_id,
          this.callback
        )
      })

      it('should not call applyUpdate', function () {
        this.UpdateManager.applyUpdate.called.should.equal(false)
      })

      it('should call the callback', function () {
        this.callback.called.should.equal(true)
      })
    })
  })

  describe('applyUpdate', function () {
    beforeEach(function () {
      this.updateMeta = { user_id: 'last-author-fake-id' }
      this.update = { op: [{ p: 42, i: 'foo' }], meta: this.updateMeta }
      this.updatedDocLines = ['updated', 'lines']
      this.version = 34
      this.lines = ['original', 'lines']
      this.ranges = { entries: 'mock', comments: 'mock' }
      this.updated_ranges = { entries: 'updated', comments: 'updated' }
      this.appliedOps = [
        { v: 42, op: 'mock-op-42' },
        { v: 45, op: 'mock-op-45' },
      ]
      this.project_ops_length = sinon.stub()
      this.pathname = '/a/b/c.tex'
      this.DocumentManager.getDoc = sinon
        .stub()
        .yields(
          null,
          this.lines,
          this.version,
          this.ranges,
          this.pathname,
          this.projectHistoryId
        )
      this.RangesManager.applyUpdate = sinon
        .stub()
        .yields(null, this.updated_ranges, false)
      this.ShareJsUpdateManager.applyUpdate = sinon
        .stub()
        .yields(null, this.updatedDocLines, this.version, this.appliedOps)
      this.RedisManager.updateDocument = sinon
        .stub()
        .yields(null, this.project_ops_length)
      this.RealTimeRedisManager.sendData = sinon.stub()
      this.UpdateManager._addProjectHistoryMetadataToOps = sinon.stub()
      this.HistoryManager.recordAndFlushHistoryOps = sinon.stub()
    })

    describe('normally', function () {
      beforeEach(function () {
        this.UpdateManager.applyUpdate(
          this.project_id,
          this.doc_id,
          this.update,
          this.callback
        )
      })

      it('should apply the updates via ShareJS', function () {
        this.ShareJsUpdateManager.applyUpdate
          .calledWith(
            this.project_id,
            this.doc_id,
            this.update,
            this.lines,
            this.version
          )
          .should.equal(true)
      })

      it('should update the ranges', function () {
        this.RangesManager.applyUpdate
          .calledWith(
            this.project_id,
            this.doc_id,
            this.ranges,
            this.appliedOps,
            this.updatedDocLines
          )
          .should.equal(true)
      })

      it('should save the document', function () {
        this.RedisManager.updateDocument
          .calledWith(
            this.project_id,
            this.doc_id,
            this.updatedDocLines,
            this.version,
            this.appliedOps,
            this.updated_ranges,
            this.updateMeta
          )
          .should.equal(true)
      })

      it('should add metadata to the ops', function () {
        this.UpdateManager._addProjectHistoryMetadataToOps
          .calledWith(
            this.appliedOps,
            this.pathname,
            this.projectHistoryId,
            this.lines
          )
          .should.equal(true)
      })

      it('should push the applied ops into the history queue', function () {
        this.HistoryManager.recordAndFlushHistoryOps
          .calledWith(this.project_id, this.appliedOps, this.project_ops_length)
          .should.equal(true)
      })

      it('should call the callback', function () {
        this.callback.called.should.equal(true)
      })
    })

    describe('with UTF-16 surrogate pairs in the update', function () {
      beforeEach(function () {
        this.update = { op: [{ p: 42, i: '\uD835\uDC00' }] }
        this.UpdateManager.applyUpdate(
          this.project_id,
          this.doc_id,
          this.update,
          this.callback
        )
      })

      it('should apply the update but with surrogate pairs removed', function () {
        this.ShareJsUpdateManager.applyUpdate
          .calledWith(this.project_id, this.doc_id, this.update)
          .should.equal(true)

        // \uFFFD is 'replacement character'
        this.update.op[0].i.should.equal('\uFFFD\uFFFD')
      })
    })

    describe('with an error', function () {
      beforeEach(function () {
        this.error = new Error('something went wrong')
        this.ShareJsUpdateManager.applyUpdate = sinon.stub().yields(this.error)
        this.UpdateManager.applyUpdate(
          this.project_id,
          this.doc_id,
          this.update,
          this.callback
        )
      })

      it('should call RealTimeRedisManager.sendData with the error', function () {
        this.RealTimeRedisManager.sendData
          .calledWith({
            project_id: this.project_id,
            doc_id: this.doc_id,
            error: this.error.message,
          })
          .should.equal(true)
      })

      it('should call the callback with the error', function () {
        this.callback.calledWith(this.error).should.equal(true)
      })
    })

    describe('when ranges get collapsed', function () {
      beforeEach(function () {
        this.RangesManager.applyUpdate = sinon
          .stub()
          .yields(null, this.updated_ranges, true)
        this.SnapshotManager.recordSnapshot = sinon.stub().yields()
        this.UpdateManager.applyUpdate(
          this.project_id,
          this.doc_id,
          this.update,
          this.callback
        )
      })

      it('should increment the doc-snapshot metric', function () {
        this.Metrics.inc.calledWith('doc-snapshot').should.equal(true)
      })

      it('should call SnapshotManager.recordSnapshot', function () {
        this.SnapshotManager.recordSnapshot
          .calledWith(
            this.project_id,
            this.doc_id,
            this.version,
            this.pathname,
            this.lines,
            this.ranges
          )
          .should.equal(true)
      })
    })
  })

  describe('_addProjectHistoryMetadataToOps', function () {
    it('should add projectHistoryId, pathname and doc_length metadata to the ops', function () {
      const lines = ['some', 'test', 'data']
      const appliedOps = [
        {
          v: 42,
          op: [
            { i: 'foo', p: 4 },
            { i: 'bar', p: 6 },
          ],
        },
        {
          v: 45,
          op: [
            { d: 'qux', p: 4 },
            { i: 'bazbaz', p: 14 },
          ],
        },
        { v: 49, op: [{ i: 'penguin', p: 18 }] },
      ]
      this.UpdateManager._addProjectHistoryMetadataToOps(
        appliedOps,
        this.pathname,
        this.projectHistoryId,
        lines
      )
      appliedOps.should.deep.equal([
        {
          projectHistoryId: this.projectHistoryId,
          v: 42,
          op: [
            { i: 'foo', p: 4 },
            { i: 'bar', p: 6 },
          ],
          meta: {
            pathname: this.pathname,
            doc_length: 14,
          },
        },
        {
          projectHistoryId: this.projectHistoryId,
          v: 45,
          op: [
            { d: 'qux', p: 4 },
            { i: 'bazbaz', p: 14 },
          ],
          meta: {
            pathname: this.pathname,
            doc_length: 20,
          }, // 14 + 'foo' + 'bar'
        },
        {
          projectHistoryId: this.projectHistoryId,
          v: 49,
          op: [{ i: 'penguin', p: 18 }],
          meta: {
            pathname: this.pathname,
            doc_length: 23,
          }, // 14 - 'qux' + 'bazbaz'
        },
      ])
    })
  })

  describe('lockUpdatesAndDo', function () {
    beforeEach(function () {
      this.method = sinon.stub().callsArgWith(3, null, this.response_arg1)
      this.callback = sinon.stub()
      this.arg1 = 'argument 1'
      this.response_arg1 = 'response argument 1'
      this.lockValue = 'mock-lock-value'
      this.LockManager.getLock = sinon
        .stub()
        .callsArgWith(1, null, this.lockValue)
      this.LockManager.releaseLock = sinon.stub().callsArg(2)
    })

    describe('successfully', function () {
      beforeEach(function () {
        this.UpdateManager.continueProcessingUpdatesWithLock = sinon.stub()
        this.UpdateManager.processOutstandingUpdates = sinon.stub().callsArg(2)
        this.UpdateManager.lockUpdatesAndDo(
          this.method,
          this.project_id,
          this.doc_id,
          this.arg1,
          this.callback
        )
      })

      it('should lock the doc', function () {
        this.LockManager.getLock.calledWith(this.doc_id).should.equal(true)
      })

      it('should process any outstanding updates', function () {
        this.UpdateManager.processOutstandingUpdates
          .calledWith(this.project_id, this.doc_id)
          .should.equal(true)
      })

      it('should call the method', function () {
        this.method
          .calledWith(this.project_id, this.doc_id, this.arg1)
          .should.equal(true)
      })

      it('should return the method response to the callback', function () {
        this.callback.calledWith(null, this.response_arg1).should.equal(true)
      })

      it('should release the lock', function () {
        this.LockManager.releaseLock
          .calledWith(this.doc_id, this.lockValue)
          .should.equal(true)
      })

      it('should continue processing updates', function () {
        this.UpdateManager.continueProcessingUpdatesWithLock
          .calledWith(this.project_id, this.doc_id)
          .should.equal(true)
      })
    })

    describe('when processOutstandingUpdates returns an error', function () {
      beforeEach(function () {
        this.UpdateManager.processOutstandingUpdates = sinon
          .stub()
          .callsArgWith(2, (this.error = new Error('Something went wrong')))
        this.UpdateManager.lockUpdatesAndDo(
          this.method,
          this.project_id,
          this.doc_id,
          this.arg1,
          this.callback
        )
      })

      it('should free the lock', function () {
        this.LockManager.releaseLock
          .calledWith(this.doc_id, this.lockValue)
          .should.equal(true)
      })

      it('should return the error in the callback', function () {
        this.callback.calledWith(this.error).should.equal(true)
      })
    })

    describe('when the method returns an error', function () {
      beforeEach(function () {
        this.UpdateManager.processOutstandingUpdates = sinon.stub().callsArg(2)
        this.method = sinon
          .stub()
          .callsArgWith(
            3,
            (this.error = new Error('something went wrong')),
            this.response_arg1
          )
        this.UpdateManager.lockUpdatesAndDo(
          this.method,
          this.project_id,
          this.doc_id,
          this.arg1,
          this.callback
        )
      })

      it('should free the lock', function () {
        this.LockManager.releaseLock
          .calledWith(this.doc_id, this.lockValue)
          .should.equal(true)
      })

      it('should return the error in the callback', function () {
        this.callback.calledWith(this.error).should.equal(true)
      })
    })
  })
})
