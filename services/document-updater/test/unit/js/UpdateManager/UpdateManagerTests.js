const { createHash } = require('node:crypto')
const sinon = require('sinon')
const { expect } = require('chai')
const SandboxedModule = require('sandboxed-module')

const MODULE_PATH = '../../../../app/js/UpdateManager.js'

describe('UpdateManager', function () {
  beforeEach(function () {
    this.project_id = 'project-id-123'
    this.projectHistoryId = 'history-id-123'
    this.doc_id = 'document-id-123'
    this.lockValue = 'mock-lock-value'
    this.pathname = '/a/b/c.tex'

    this.Metrics = {
      inc: sinon.stub(),
      Timer: class Timer {},
    }
    this.Metrics.Timer.prototype.done = sinon.stub()

    this.Profiler = class Profiler {}
    this.Profiler.prototype.log = sinon.stub().returns({ end: sinon.stub() })
    this.Profiler.prototype.end = sinon.stub()

    this.LockManager = {
      promises: {
        tryLock: sinon.stub().resolves(this.lockValue),
        getLock: sinon.stub().resolves(this.lockValue),
        releaseLock: sinon.stub().resolves(),
      },
    }

    this.RedisManager = {
      promises: {
        setDocument: sinon.stub().resolves(),
        updateDocument: sinon.stub(),
      },
    }

    this.RealTimeRedisManager = {
      sendData: sinon.stub(),
      promises: {
        getUpdatesLength: sinon.stub(),
        getPendingUpdatesForDoc: sinon.stub(),
      },
    }

    this.ShareJsUpdateManager = {
      promises: {
        applyUpdate: sinon.stub(),
      },
    }

    this.HistoryManager = {
      recordAndFlushHistoryOps: sinon.stub(),
    }

    this.Settings = {}

    this.DocumentManager = {
      promises: {
        getDoc: sinon.stub(),
      },
    }

    this.RangesManager = {
      applyUpdate: sinon.stub(),
    }

    this.SnapshotManager = {
      promises: {
        recordSnapshot: sinon.stub().resolves(),
      },
    }

    this.ProjectHistoryRedisManager = {
      promises: {
        queueOps: sinon
          .stub()
          .callsFake(async (projectId, ...ops) => ops.length),
      },
    }

    this.UpdateManager = SandboxedModule.require(MODULE_PATH, {
      requires: {
        './LockManager': this.LockManager,
        './RedisManager': this.RedisManager,
        './RealTimeRedisManager': this.RealTimeRedisManager,
        './ShareJsUpdateManager': this.ShareJsUpdateManager,
        './HistoryManager': this.HistoryManager,
        './Metrics': this.Metrics,
        '@overleaf/settings': this.Settings,
        './DocumentManager': this.DocumentManager,
        './RangesManager': this.RangesManager,
        './SnapshotManager': this.SnapshotManager,
        './Profiler': this.Profiler,
        './ProjectHistoryRedisManager': this.ProjectHistoryRedisManager,
      },
    })
  })

  describe('processOutstandingUpdates', function () {
    beforeEach(async function () {
      this.UpdateManager.promises.fetchAndApplyUpdates = sinon.stub().resolves()
      await this.UpdateManager.promises.processOutstandingUpdates(
        this.project_id,
        this.doc_id
      )
    })

    it('should apply the updates', function () {
      this.UpdateManager.promises.fetchAndApplyUpdates
        .calledWith(this.project_id, this.doc_id)
        .should.equal(true)
    })

    it('should time the execution', function () {
      this.Metrics.Timer.prototype.done.called.should.equal(true)
    })
  })

  describe('processOutstandingUpdatesWithLock', function () {
    describe('when the lock is free', function () {
      beforeEach(function () {
        this.UpdateManager.promises.continueProcessingUpdatesWithLock = sinon
          .stub()
          .resolves()
        this.UpdateManager.promises.processOutstandingUpdates = sinon
          .stub()
          .resolves()
      })

      describe('successfully', function () {
        beforeEach(async function () {
          await this.UpdateManager.promises.processOutstandingUpdatesWithLock(
            this.project_id,
            this.doc_id
          )
        })

        it('should acquire the lock', function () {
          this.LockManager.promises.tryLock
            .calledWith(this.doc_id)
            .should.equal(true)
        })

        it('should free the lock', function () {
          this.LockManager.promises.releaseLock
            .calledWith(this.doc_id, this.lockValue)
            .should.equal(true)
        })

        it('should process the outstanding updates', function () {
          this.UpdateManager.promises.processOutstandingUpdates
            .calledWith(this.project_id, this.doc_id)
            .should.equal(true)
        })

        it('should do everything with the lock acquired', function () {
          this.UpdateManager.promises.processOutstandingUpdates
            .calledAfter(this.LockManager.promises.tryLock)
            .should.equal(true)
          this.UpdateManager.promises.processOutstandingUpdates
            .calledBefore(this.LockManager.promises.releaseLock)
            .should.equal(true)
        })

        it('should continue processing new updates that may have come in', function () {
          this.UpdateManager.promises.continueProcessingUpdatesWithLock
            .calledWith(this.project_id, this.doc_id)
            .should.equal(true)
        })
      })

      describe('when processOutstandingUpdates returns an error', function () {
        beforeEach(async function () {
          this.error = new Error('Something went wrong')
          this.UpdateManager.promises.processOutstandingUpdates = sinon
            .stub()
            .rejects(this.error)
          await expect(
            this.UpdateManager.promises.processOutstandingUpdatesWithLock(
              this.project_id,
              this.doc_id
            )
          ).to.be.rejectedWith(this.error)
        })

        it('should free the lock', function () {
          this.LockManager.promises.releaseLock
            .calledWith(this.doc_id, this.lockValue)
            .should.equal(true)
        })
      })
    })

    describe('when the lock is taken', function () {
      beforeEach(async function () {
        this.LockManager.promises.tryLock.resolves(null)
        this.UpdateManager.promises.processOutstandingUpdates = sinon
          .stub()
          .resolves()
        await this.UpdateManager.promises.processOutstandingUpdatesWithLock(
          this.project_id,
          this.doc_id
        )
      })

      it('should not process the updates', function () {
        this.UpdateManager.promises.processOutstandingUpdates.called.should.equal(
          false
        )
      })
    })
  })

  describe('continueProcessingUpdatesWithLock', function () {
    describe('when there are outstanding updates', function () {
      beforeEach(async function () {
        this.RealTimeRedisManager.promises.getUpdatesLength.resolves(3)
        this.UpdateManager.promises.processOutstandingUpdatesWithLock = sinon
          .stub()
          .resolves()
        await this.UpdateManager.promises.continueProcessingUpdatesWithLock(
          this.project_id,
          this.doc_id
        )
      })

      it('should process the outstanding updates', function () {
        this.UpdateManager.promises.processOutstandingUpdatesWithLock
          .calledWith(this.project_id, this.doc_id)
          .should.equal(true)
      })
    })

    describe('when there are no outstanding updates', function () {
      beforeEach(async function () {
        this.RealTimeRedisManager.promises.getUpdatesLength.resolves(0)
        this.UpdateManager.promises.processOutstandingUpdatesWithLock = sinon
          .stub()
          .resolves()
        await this.UpdateManager.promises.continueProcessingUpdatesWithLock(
          this.project_id,
          this.doc_id
        )
      })

      it('should not try to process the outstanding updates', function () {
        this.UpdateManager.promises.processOutstandingUpdatesWithLock.called.should.equal(
          false
        )
      })
    })
  })

  describe('fetchAndApplyUpdates', function () {
    describe('with updates', function () {
      beforeEach(async function () {
        this.updates = [{ p: 1, t: 'foo' }]
        this.updatedDocLines = ['updated', 'lines']
        this.version = 34
        this.RealTimeRedisManager.promises.getPendingUpdatesForDoc.resolves(
          this.updates
        )
        this.UpdateManager.promises.applyUpdate = sinon.stub().resolves()
        await this.UpdateManager.promises.fetchAndApplyUpdates(
          this.project_id,
          this.doc_id
        )
      })

      it('should get the pending updates', function () {
        this.RealTimeRedisManager.promises.getPendingUpdatesForDoc
          .calledWith(this.doc_id)
          .should.equal(true)
      })

      it('should apply the updates', function () {
        this.updates.map(update =>
          this.UpdateManager.promises.applyUpdate
            .calledWith(this.project_id, this.doc_id, update)
            .should.equal(true)
        )
      })
    })

    describe('when there are no updates', function () {
      beforeEach(async function () {
        this.updates = []
        this.RealTimeRedisManager.promises.getPendingUpdatesForDoc.resolves(
          this.updates
        )
        this.UpdateManager.promises.applyUpdate = sinon.stub().resolves()
        await this.UpdateManager.promises.fetchAndApplyUpdates(
          this.project_id,
          this.doc_id
        )
      })

      it('should not call applyUpdate', function () {
        this.UpdateManager.promises.applyUpdate.called.should.equal(false)
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
      this.historyUpdates = [
        'history-update-1',
        'history-update-2',
        'history-update-3',
      ]
      this.project_ops_length = 123
      this.DocumentManager.promises.getDoc.resolves({
        lines: this.lines,
        version: this.version,
        ranges: this.ranges,
        pathname: this.pathname,
        projectHistoryId: this.projectHistoryId,
        historyRangesSupport: false,
      })
      this.RangesManager.applyUpdate.returns({
        newRanges: this.updated_ranges,
        rangesWereCollapsed: false,
        historyUpdates: this.historyUpdates,
      })
      this.ShareJsUpdateManager.promises.applyUpdate = sinon.stub().resolves({
        updatedDocLines: this.updatedDocLines,
        version: this.version,
        appliedOps: this.appliedOps,
      })
      this.RedisManager.promises.updateDocument.resolves()
      this.UpdateManager.promises._adjustHistoryUpdatesMetadata = sinon.stub()
    })

    describe('normally', function () {
      beforeEach(async function () {
        await this.UpdateManager.promises.applyUpdate(
          this.project_id,
          this.doc_id,
          this.update
        )
      })

      it('should apply the updates via ShareJS', function () {
        this.ShareJsUpdateManager.promises.applyUpdate
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
        this.RedisManager.promises.updateDocument
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
        this.UpdateManager.promises._adjustHistoryUpdatesMetadata.should.have.been.calledWith(
          this.historyUpdates,
          this.pathname,
          this.projectHistoryId,
          this.lines,
          this.ranges,
          this.updatedDocLines
        )
      })

      it('should push the applied ops into the history queue', function () {
        this.ProjectHistoryRedisManager.promises.queueOps.should.have.been.calledWith(
          this.project_id,
          ...this.historyUpdates.map(op => JSON.stringify(op))
        )
        this.HistoryManager.recordAndFlushHistoryOps.should.have.been.calledWith(
          this.project_id,
          this.historyUpdates,
          this.historyUpdates.length
        )
      })
    })

    describe('with UTF-16 surrogate pairs in the update', function () {
      beforeEach(async function () {
        this.update = { op: [{ p: 42, i: '\uD835\uDC00' }] }
        await this.UpdateManager.promises.applyUpdate(
          this.project_id,
          this.doc_id,
          this.update
        )
      })

      it('should apply the update but with surrogate pairs removed', function () {
        this.ShareJsUpdateManager.promises.applyUpdate
          .calledWith(this.project_id, this.doc_id, this.update)
          .should.equal(true)

        // \uFFFD is 'replacement character'
        this.update.op[0].i.should.equal('\uFFFD\uFFFD')
      })
    })

    describe('with an error', function () {
      beforeEach(async function () {
        this.error = new Error('something went wrong')
        this.ShareJsUpdateManager.promises.applyUpdate.rejects(this.error)
        await expect(
          this.UpdateManager.promises.applyUpdate(
            this.project_id,
            this.doc_id,
            this.update
          )
        ).to.be.rejectedWith(this.error)
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
    })

    describe('when ranges get collapsed', function () {
      beforeEach(async function () {
        this.RangesManager.applyUpdate.returns({
          newRanges: this.updated_ranges,
          rangesWereCollapsed: true,
          historyUpdates: this.historyUpdates,
        })
        await this.UpdateManager.promises.applyUpdate(
          this.project_id,
          this.doc_id,
          this.update
        )
      })

      it('should increment the doc-snapshot metric', function () {
        this.Metrics.inc.calledWith('doc-snapshot').should.equal(true)
      })

      it('should call SnapshotManager.recordSnapshot', function () {
        this.SnapshotManager.promises.recordSnapshot
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

    describe('when history ranges are supported', function () {
      beforeEach(async function () {
        this.DocumentManager.promises.getDoc.resolves({
          lines: this.lines,
          version: this.version,
          ranges: this.ranges,
          pathname: this.pathname,
          projectHistoryId: this.projectHistoryId,
          historyRangesSupport: true,
        })
        await this.UpdateManager.promises.applyUpdate(
          this.project_id,
          this.doc_id,
          this.update
        )
      })

      it('should push the history updates into the history queue', function () {
        this.ProjectHistoryRedisManager.promises.queueOps.should.have.been.calledWith(
          this.project_id,
          ...this.historyUpdates.map(op => JSON.stringify(op))
        )
        this.HistoryManager.recordAndFlushHistoryOps.should.have.been.calledWith(
          this.project_id,
          this.historyUpdates,
          this.historyUpdates.length
        )
      })
    })
  })

  describe('_adjustHistoryUpdatesMetadata', function () {
    beforeEach(function () {
      this.lines = ['some', 'test', 'data']
      this.updatedDocLines = ['after', 'updates']
      this.historyUpdates = [
        {
          v: 42,
          op: [
            { i: 'bing', p: 12, trackedDeleteRejection: true },
            { i: 'foo', p: 4 },
            { i: 'bar', p: 6 },
          ],
        },
        {
          v: 45,
          op: [
            { d: 'qux', p: 4 },
            { i: 'bazbaz', p: 14 },
            {
              d: 'bong',
              p: 28,
              trackedChanges: [{ type: 'insert', offset: 0, length: 4 }],
            },
          ],
          meta: {
            tc: 'tracking-info',
          },
        },
        {
          v: 47,
          op: [{ d: 'so', p: 0 }],
        },
        { v: 49, op: [{ i: 'penguin', p: 18 }] },
      ]
      this.ranges = {
        changes: [
          { op: { d: 'bingbong', p: 12 } },
          { op: { i: 'test', p: 5 } },
        ],
      }
    })

    it('should add projectHistoryId, pathname and doc_length metadata to the ops', function () {
      this.UpdateManager._adjustHistoryUpdatesMetadata(
        this.historyUpdates,
        this.pathname,
        this.projectHistoryId,
        this.lines,
        this.updatedDocLines,
        this.ranges,
        false
      )
      this.historyUpdates.should.deep.equal([
        {
          projectHistoryId: this.projectHistoryId,
          v: 42,
          op: [
            { i: 'bing', p: 12, trackedDeleteRejection: true },
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
            {
              d: 'bong',
              p: 28,
              trackedChanges: [{ type: 'insert', offset: 0, length: 4 }],
            },
          ],
          meta: {
            pathname: this.pathname,
            doc_length: 24, // 14 + 'bing' + 'foo' + 'bar'
          },
        },
        {
          projectHistoryId: this.projectHistoryId,
          v: 47,
          op: [{ d: 'so', p: 0 }],
          meta: {
            pathname: this.pathname,
            doc_length: 23, // 24 - 'qux' + 'bazbaz' - 'bong'
          },
        },
        {
          projectHistoryId: this.projectHistoryId,
          v: 49,
          op: [{ i: 'penguin', p: 18 }],
          meta: {
            pathname: this.pathname,
            doc_length: 21, // 23 - 'so'
          },
        },
      ])
    })

    it('should add additional metadata when ranges support is enabled', function () {
      this.UpdateManager._adjustHistoryUpdatesMetadata(
        this.historyUpdates,
        this.pathname,
        this.projectHistoryId,
        this.lines,
        this.ranges,
        this.updatedDocLines,
        true
      )
      this.historyUpdates.should.deep.equal([
        {
          projectHistoryId: this.projectHistoryId,
          v: 42,
          op: [
            { i: 'bing', p: 12, trackedDeleteRejection: true },
            { i: 'foo', p: 4 },
            { i: 'bar', p: 6 },
          ],
          meta: {
            pathname: this.pathname,
            doc_length: 14,
            history_doc_length: 22,
          },
        },
        {
          projectHistoryId: this.projectHistoryId,
          v: 45,
          op: [
            { d: 'qux', p: 4 },
            { i: 'bazbaz', p: 14 },
            {
              d: 'bong',
              p: 28,
              trackedChanges: [{ type: 'insert', offset: 0, length: 4 }],
            },
          ],
          meta: {
            pathname: this.pathname,
            doc_length: 24, // 14 + 'bing' + 'foo' + 'bar'
            history_doc_length: 28, // 22 + 'foo' + 'bar'
            tc: 'tracking-info',
          },
        },
        {
          projectHistoryId: this.projectHistoryId,
          v: 47,
          op: [{ d: 'so', p: 0 }],
          meta: {
            pathname: this.pathname,
            doc_length: 23, // 24 - 'qux' + 'bazbaz' - 'bong'
            history_doc_length: 30, // 28 - 'bong' + 'bazbaz'
          },
        },
        {
          projectHistoryId: this.projectHistoryId,
          v: 49,
          op: [{ i: 'penguin', p: 18 }],
          meta: {
            pathname: this.pathname,
            doc_length: 21, // 23 - 'so'
            doc_hash: stringHash(this.updatedDocLines.join('\n')),
            history_doc_length: 28, // 30 - 'so'
          },
        },
      ])
    })

    it('should calculate the right doc length for an empty document', function () {
      this.historyUpdates = [{ v: 42, op: [{ i: 'foobar', p: 0 }] }]
      this.UpdateManager._adjustHistoryUpdatesMetadata(
        this.historyUpdates,
        this.pathname,
        this.projectHistoryId,
        [],
        {},
        ['foobar'],
        false
      )
      this.historyUpdates.should.deep.equal([
        {
          projectHistoryId: this.projectHistoryId,
          v: 42,
          op: [{ i: 'foobar', p: 0 }],
          meta: {
            pathname: this.pathname,
            doc_length: 0,
          },
        },
      ])
    })
  })

  describe('lockUpdatesAndDo', function () {
    beforeEach(function () {
      this.methodResult = 'method result'
      this.method = sinon.stub().resolves(this.methodResult)
      this.arg1 = 'argument 1'
    })

    describe('successfully', function () {
      beforeEach(async function () {
        this.UpdateManager.promises.continueProcessingUpdatesWithLock = sinon
          .stub()
          .resolves()
        this.UpdateManager.promises.processOutstandingUpdates = sinon
          .stub()
          .resolves()
        this.response = await this.UpdateManager.promises.lockUpdatesAndDo(
          this.method,
          this.project_id,
          this.doc_id,
          this.arg1
        )
      })

      it('should lock the doc', function () {
        this.LockManager.promises.getLock
          .calledWith(this.doc_id)
          .should.equal(true)
      })

      it('should process any outstanding updates', function () {
        this.UpdateManager.promises.processOutstandingUpdates.should.have.been.calledWith(
          this.project_id,
          this.doc_id
        )
      })

      it('should call the method', function () {
        this.method
          .calledWith(this.project_id, this.doc_id, this.arg1)
          .should.equal(true)
      })

      it('should return the method response arguments', function () {
        expect(this.response).to.equal(this.methodResult)
      })

      it('should release the lock', function () {
        this.LockManager.promises.releaseLock
          .calledWith(this.doc_id, this.lockValue)
          .should.equal(true)
      })

      it('should continue processing updates', function () {
        this.UpdateManager.promises.continueProcessingUpdatesWithLock
          .calledWith(this.project_id, this.doc_id)
          .should.equal(true)
      })
    })

    describe('when processOutstandingUpdates returns an error', function () {
      beforeEach(async function () {
        this.error = new Error('Something went wrong')
        this.UpdateManager.promises.processOutstandingUpdates = sinon
          .stub()
          .rejects(this.error)
        await expect(
          this.UpdateManager.promises.lockUpdatesAndDo(
            this.method,
            this.project_id,
            this.doc_id,
            this.arg1
          )
        ).to.be.rejectedWith(this.error)
      })

      it('should free the lock', function () {
        this.LockManager.promises.releaseLock
          .calledWith(this.doc_id, this.lockValue)
          .should.equal(true)
      })
    })

    describe('when the method returns an error', function () {
      beforeEach(async function () {
        this.error = new Error('something went wrong')
        this.UpdateManager.promises.processOutstandingUpdates = sinon
          .stub()
          .resolves()
        this.method = sinon.stub().rejects(this.error)
        await expect(
          this.UpdateManager.promises.lockUpdatesAndDo(
            this.method,
            this.project_id,
            this.doc_id,
            this.arg1
          )
        ).to.be.rejectedWith(this.error)
      })

      it('should free the lock', function () {
        this.LockManager.promises.releaseLock
          .calledWith(this.doc_id, this.lockValue)
          .should.equal(true)
      })
    })
  })
})

function stringHash(s) {
  const hash = createHash('sha1')
  hash.update(s)
  return hash.digest('hex')
}
