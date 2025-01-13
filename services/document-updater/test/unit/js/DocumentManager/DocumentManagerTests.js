const sinon = require('sinon')
const { expect } = require('chai')
const modulePath = '../../../../app/js/DocumentManager.js'
const SandboxedModule = require('sandboxed-module')
const Errors = require('../../../../app/js/Errors')
const tk = require('timekeeper')

describe('DocumentManager', function () {
  beforeEach(function () {
    tk.freeze(new Date())
    this.Metrics = {
      Timer: class Timer {},
      inc: sinon.stub(),
    }
    this.Metrics.Timer.prototype.done = sinon.stub()

    this.RedisManager = {
      promises: {
        clearUnflushedTime: sinon.stub().resolves(),
        getDoc: sinon.stub(),
        getPreviousDocOps: sinon.stub(),
        putDocInMemory: sinon.stub().resolves(),
        removeDocFromMemory: sinon.stub().resolves(),
        renameDoc: sinon.stub().resolves(),
        updateCommentState: sinon.stub().resolves(),
        updateDocument: sinon.stub().resolves(),
      },
    }
    this.ProjectHistoryRedisManager = {
      promises: {
        queueOps: sinon.stub().resolves(),
        queueResyncDocContent: sinon.stub().resolves(),
      },
    }
    this.PersistenceManager = {
      promises: {
        getDoc: sinon.stub(),
        setDoc: sinon.stub().resolves(),
      },
    }
    this.HistoryManager = {
      flushProjectChangesAsync: sinon.stub(),
    }
    this.DiffCodec = {
      diffAsShareJsOp: sinon.stub(),
    }
    this.UpdateManager = {
      promises: {
        applyUpdate: sinon.stub().resolves(),
      },
    }
    this.RangesManager = {
      acceptChanges: sinon.stub(),
      deleteComment: sinon.stub(),
    }
    this.Settings = {
      max_doc_length: 2 * 1024 * 1024, // 2mb
    }

    this.DocumentManager = SandboxedModule.require(modulePath, {
      requires: {
        './RedisManager': this.RedisManager,
        './ProjectHistoryRedisManager': this.ProjectHistoryRedisManager,
        './PersistenceManager': this.PersistenceManager,
        './HistoryManager': this.HistoryManager,
        './Metrics': this.Metrics,
        './DiffCodec': this.DiffCodec,
        './UpdateManager': this.UpdateManager,
        './RangesManager': this.RangesManager,
        './Errors': Errors,
        '@overleaf/settings': this.Settings,
      },
    })
    this.project_id = 'project-id-123'
    this.projectHistoryId = 'history-id-123'
    this.doc_id = 'doc-id-123'
    this.user_id = 1234
    this.lines = ['one', 'two', 'three']
    this.version = 42
    this.ranges = { comments: 'mock', entries: 'mock' }
    this.resolvedCommentIds = ['comment-1']
    this.pathname = '/a/b/c.tex'
    this.unflushedTime = Date.now()
    this.lastUpdatedAt = Date.now()
    this.lastUpdatedBy = 'last-author-id'
    this.source = 'external-source'
    this.historyRangesSupport = false
  })

  afterEach(function () {
    tk.reset()
  })

  describe('flushAndDeleteDoc', function () {
    describe('successfully', function () {
      beforeEach(async function () {
        this.DocumentManager.promises.flushDocIfLoaded = sinon.stub().resolves()
        await this.DocumentManager.promises.flushAndDeleteDoc(
          this.project_id,
          this.doc_id,
          {}
        )
      })

      it('should flush the doc', function () {
        this.DocumentManager.promises.flushDocIfLoaded
          .calledWith(this.project_id, this.doc_id)
          .should.equal(true)
      })

      it('should remove the doc from redis', function () {
        this.RedisManager.promises.removeDocFromMemory
          .calledWith(this.project_id, this.doc_id)
          .should.equal(true)
      })
    })

    describe('when a flush error occurs', function () {
      beforeEach(async function () {
        this.DocumentManager.promises.flushDocIfLoaded = sinon
          .stub()
          .rejects(new Error('boom!'))
        await expect(
          this.DocumentManager.promises.flushAndDeleteDoc(
            this.project_id,
            this.doc_id,
            {}
          )
        ).to.be.rejected
      })

      it('should not remove the doc from redis', function () {
        this.RedisManager.promises.removeDocFromMemory.called.should.equal(
          false
        )
      })

      describe('when ignoring flush errors', function () {
        it('should remove the doc from redis', async function () {
          await this.DocumentManager.promises.flushAndDeleteDoc(
            this.project_id,
            this.doc_id,
            { ignoreFlushErrors: true }
          )
          this.RedisManager.promises.removeDocFromMemory.called.should.equal(
            true
          )
        })
      })
    })
  })

  describe('flushDocIfLoaded', function () {
    describe('when the doc is in Redis', function () {
      beforeEach(async function () {
        this.RedisManager.promises.getDoc.resolves({
          lines: this.lines,
          version: this.version,
          ranges: this.ranges,
          pathname: this.pathname,
          projectHistoryId: this.projectHistoryId,
          unflushedTime: this.unflushedTime,
          lastUpdatedAt: this.lastUpdatedAt,
          lastUpdatedBy: this.lastUpdatedBy,
        })
        await this.DocumentManager.promises.flushDocIfLoaded(
          this.project_id,
          this.doc_id
        )
      })

      it('should get the doc from redis', function () {
        this.RedisManager.promises.getDoc
          .calledWith(this.project_id, this.doc_id)
          .should.equal(true)
      })

      it('should write the doc lines to the persistence layer', function () {
        this.PersistenceManager.promises.setDoc.should.have.been.calledWith(
          this.project_id,
          this.doc_id,
          this.lines,
          this.version,
          this.ranges,
          this.lastUpdatedAt,
          this.lastUpdatedBy
        )
      })
    })

    describe('when the document is not in Redis', function () {
      beforeEach(async function () {
        this.RedisManager.promises.getDoc.resolves({
          lines: null,
          version: null,
          ranges: null,
        })
        await this.DocumentManager.promises.flushDocIfLoaded(
          this.project_id,
          this.doc_id
        )
      })

      it('should get the doc from redis', function () {
        this.RedisManager.promises.getDoc
          .calledWith(this.project_id, this.doc_id)
          .should.equal(true)
      })

      it('should not write anything to the persistence layer', function () {
        this.PersistenceManager.promises.setDoc.called.should.equal(false)
      })
    })
  })

  describe('getDocAndRecentOps', function () {
    describe('with a previous version specified', function () {
      beforeEach(async function () {
        this.DocumentManager.promises.getDoc = sinon.stub().resolves({
          lines: this.lines,
          version: this.version,
          ranges: this.ranges,
          pathname: this.pathname,
          projectHistoryId: this.projectHistoryId,
        })
        this.RedisManager.promises.getPreviousDocOps.resolves(this.ops)
        this.result = await this.DocumentManager.promises.getDocAndRecentOps(
          this.project_id,
          this.doc_id,
          this.fromVersion
        )
      })

      it('should get the doc', function () {
        this.DocumentManager.promises.getDoc
          .calledWith(this.project_id, this.doc_id)
          .should.equal(true)
      })

      it('should get the doc ops', function () {
        this.RedisManager.promises.getPreviousDocOps
          .calledWith(this.doc_id, this.fromVersion, this.version)
          .should.equal(true)
      })

      it('should return the doc info', function () {
        expect(this.result).to.deep.equal({
          lines: this.lines,
          version: this.version,
          ops: this.ops,
          ranges: this.ranges,
          pathname: this.pathname,
          projectHistoryId: this.projectHistoryId,
        })
      })
    })

    describe('with no previous version specified', function () {
      beforeEach(async function () {
        this.DocumentManager.promises.getDoc = sinon.stub().resolves({
          lines: this.lines,
          version: this.version,
          ranges: this.ranges,
          pathname: this.pathname,
          projectHistoryId: this.projectHistoryId,
        })
        this.RedisManager.promises.getPreviousDocOps.resolves(this.ops)
        this.result = await this.DocumentManager.promises.getDocAndRecentOps(
          this.project_id,
          this.doc_id,
          -1
        )
      })

      it('should get the doc', function () {
        this.DocumentManager.promises.getDoc
          .calledWith(this.project_id, this.doc_id)
          .should.equal(true)
      })

      it('should not need to get the doc ops', function () {
        this.RedisManager.promises.getPreviousDocOps.called.should.equal(false)
      })

      it('should return the doc info', function () {
        expect(this.result).to.deep.equal({
          lines: this.lines,
          version: this.version,
          ops: [],
          ranges: this.ranges,
          pathname: this.pathname,
          projectHistoryId: this.projectHistoryId,
        })
      })
    })
  })

  describe('getDoc', function () {
    describe('when the doc exists in Redis', function () {
      beforeEach(async function () {
        this.RedisManager.promises.getDoc.resolves({
          lines: this.lines,
          version: this.version,
          ranges: this.ranges,
          resolvedCommentIds: this.resolvedCommentIds,
          pathname: this.pathname,
          projectHistoryId: this.projectHistoryId,
          unflushedTime: this.unflushedTime,
          lastUpdatedAt: this.lastUpdatedAt,
          lastUpdatedBy: this.lastUpdatedBy,
          historyRangesSupport: this.historyRangesSupport,
        })
        this.result = await this.DocumentManager.promises.getDoc(
          this.project_id,
          this.doc_id
        )
      })

      it('should get the doc from Redis', function () {
        this.RedisManager.promises.getDoc
          .calledWith(this.project_id, this.doc_id)
          .should.equal(true)
      })

      it('should return the doc info', function () {
        expect(this.result).to.deep.equal({
          lines: this.lines,
          version: this.version,
          ranges: this.ranges,
          resolvedCommentIds: this.resolvedCommentIds,
          pathname: this.pathname,
          projectHistoryId: this.projectHistoryId,
          unflushedTime: this.unflushedTime,
          alreadyLoaded: true,
          historyRangesSupport: this.historyRangesSupport,
        })
      })
    })

    describe('when the doc does not exist in Redis', function () {
      beforeEach(async function () {
        this.RedisManager.promises.getDoc.resolves({
          lines: null,
          version: null,
          ranges: null,
          pathname: null,
          projectHistoryId: null,
        })
        this.PersistenceManager.promises.getDoc.resolves({
          lines: this.lines,
          version: this.version,
          ranges: this.ranges,
          resolvedCommentIds: this.resolvedCommentIds,
          pathname: this.pathname,
          projectHistoryId: this.projectHistoryId,
          historyRangesSupport: this.historyRangesSupport,
        })
        this.result = await this.DocumentManager.promises.getDoc(
          this.project_id,
          this.doc_id
        )
      })

      it('should try to get the doc from Redis', function () {
        this.RedisManager.promises.getDoc
          .calledWith(this.project_id, this.doc_id)
          .should.equal(true)
      })

      it('should get the doc from the PersistenceManager', function () {
        this.PersistenceManager.promises.getDoc
          .calledWith(this.project_id, this.doc_id)
          .should.equal(true)
      })

      it('should set the doc in Redis', function () {
        this.RedisManager.promises.putDocInMemory
          .calledWith(
            this.project_id,
            this.doc_id,
            this.lines,
            this.version,
            this.ranges,
            this.resolvedCommentIds,
            this.pathname,
            this.projectHistoryId,
            this.historyRangesSupport
          )
          .should.equal(true)
      })

      it('should return doc info', function () {
        expect(this.result).to.deep.equal({
          lines: this.lines,
          version: this.version,
          ranges: this.ranges,
          resolvedCommentIds: this.resolvedCommentIds,
          pathname: this.pathname,
          projectHistoryId: this.projectHistoryId,
          unflushedTime: null,
          alreadyLoaded: false,
          historyRangesSupport: this.historyRangesSupport,
        })
      })
    })
  })

  describe('setDoc', function () {
    describe('with plain tex lines', function () {
      beforeEach(function () {
        this.beforeLines = ['before', 'lines']
        this.afterLines = ['after', 'lines']
        this.ops = [
          { i: 'foo', p: 4 },
          { d: 'bar', p: 42 },
        ]
        this.DocumentManager.promises.getDoc = sinon.stub().resolves({
          lines: this.beforeLines,
          version: this.version,
          ranges: this.ranges,
          resolvedCommentIds: this.resolvedCommentIds,
          pathname: this.pathname,
          projectHistoryId: this.projectHistoryId,
          unflushedTime: this.unflushedTime,
          alreadyLoaded: true,
        })
        this.DiffCodec.diffAsShareJsOp.returns(this.ops)
        this.DocumentManager.promises.flushDocIfLoaded = sinon.stub().resolves()
        this.DocumentManager.promises.flushAndDeleteDoc = sinon
          .stub()
          .resolves()
      })

      describe('when not loaded but with the same content', function () {
        beforeEach(async function () {
          this.DiffCodec.diffAsShareJsOp.returns([])
          this.DocumentManager.promises.getDoc = sinon.stub().resolves({
            lines: this.beforeLines,
            version: this.version,
            ranges: this.ranges,
            resolvedCommentIds: this.resolvedCommentIds,
            pathname: this.pathname,
            projectHistoryId: this.projectHistoryId,
            unflushedTime: this.unflushedTime,
            alreadyLoaded: false,
          })
          await this.DocumentManager.promises.setDoc(
            this.project_id,
            this.doc_id,
            this.beforeLines,
            this.source,
            this.user_id,
            false,
            true
          )
        })

        it('should not apply the diff as a ShareJS op', function () {
          this.UpdateManager.promises.applyUpdate.called.should.equal(false)
        })

        it('should increment the external update metric', function () {
          this.Metrics.inc
            .calledWith('external-update', 1, {
              status: 'noop',
              method: 'evict',
              path: this.source,
            })
            .should.equal(true)
        })

        it('should flush and delete the doc from redis', function () {
          this.DocumentManager.promises.flushAndDeleteDoc
            .calledWith(this.project_id, this.doc_id)
            .should.equal(true)
        })
      })

      describe('when already loaded with the same content', function () {
        beforeEach(async function () {
          this.DiffCodec.diffAsShareJsOp.returns([])
          await this.DocumentManager.promises.setDoc(
            this.project_id,
            this.doc_id,
            this.beforeLines,
            this.source,
            this.user_id,
            false,
            true
          )
        })

        it('should not apply the diff as a ShareJS op', function () {
          this.UpdateManager.promises.applyUpdate.called.should.equal(false)
        })

        it('should increment the external update metric', function () {
          this.Metrics.inc
            .calledWith('external-update', 1, {
              status: 'noop',
              method: 'flush',
              path: this.source,
            })
            .should.equal(true)
        })

        it('should flush the doc to Mongo', function () {
          this.DocumentManager.promises.flushDocIfLoaded
            .calledWith(this.project_id, this.doc_id)
            .should.equal(true)
        })
      })

      describe('when already loaded', function () {
        beforeEach(async function () {
          await this.DocumentManager.promises.setDoc(
            this.project_id,
            this.doc_id,
            this.afterLines,
            this.source,
            this.user_id,
            false,
            true
          )
        })

        it('should get the current doc lines', function () {
          this.DocumentManager.promises.getDoc
            .calledWith(this.project_id, this.doc_id)
            .should.equal(true)
        })

        it('should return a diff of the old and new lines', function () {
          this.DiffCodec.diffAsShareJsOp
            .calledWith(this.beforeLines, this.afterLines)
            .should.equal(true)
        })

        it('should apply the diff as a ShareJS op', function () {
          this.UpdateManager.promises.applyUpdate
            .calledWith(this.project_id, this.doc_id, {
              doc: this.doc_id,
              v: this.version,
              op: this.ops,
              meta: {
                type: 'external',
                source: this.source,
                user_id: this.user_id,
              },
            })
            .should.equal(true)
        })

        it('should increment the external update metric', function () {
          this.Metrics.inc
            .calledWith('external-update', 1, {
              status: 'diff',
              method: 'flush',
              path: this.source,
            })
            .should.equal(true)
        })

        it('should flush the doc to Mongo', function () {
          this.DocumentManager.promises.flushDocIfLoaded
            .calledWith(this.project_id, this.doc_id)
            .should.equal(true)
        })

        it('should not flush the project history', function () {
          this.HistoryManager.flushProjectChangesAsync.called.should.equal(
            false
          )
        })
      })

      describe('when not already loaded', function () {
        beforeEach(async function () {
          this.DocumentManager.promises.getDoc = sinon.stub().resolves({
            lines: this.beforeLines,
            version: this.version,
            pathname: this.pathname,
            unflushedTime: null,
            alreadyLoaded: false,
          })
          await this.DocumentManager.promises.setDoc(
            this.project_id,
            this.doc_id,
            this.afterLines,
            this.source,
            this.user_id,
            false,
            true
          )
        })

        it('should flush and delete the doc from the doc updater', function () {
          this.DocumentManager.promises.flushAndDeleteDoc
            .calledWith(this.project_id, this.doc_id, {})
            .should.equal(true)
        })

        it('should increment the external update metric', function () {
          this.Metrics.inc
            .calledWith('external-update', 1, {
              status: 'diff',
              method: 'evict',
              path: this.source,
            })
            .should.equal(true)
        })

        it('should not flush the project history', function () {
          this.HistoryManager.flushProjectChangesAsync
            .calledWithExactly(this.project_id)
            .should.equal(true)
        })
      })

      describe('without new lines', function () {
        beforeEach(async function () {
          await expect(
            this.DocumentManager.promises.setDoc(
              this.project_id,
              this.doc_id,
              null,
              this.source,
              this.user_id,
              false,
              true
            )
          ).to.be.rejectedWith('No lines were provided to setDoc')
        })

        it('should not try to get the doc lines', function () {
          this.DocumentManager.promises.getDoc.called.should.equal(false)
        })
      })

      describe('with the undoing flag', function () {
        beforeEach(async function () {
          // Copy ops so we don't interfere with other tests
          this.ops = [
            { i: 'foo', p: 4 },
            { d: 'bar', p: 42 },
          ]
          this.DiffCodec.diffAsShareJsOp.returns(this.ops)
          await this.DocumentManager.promises.setDoc(
            this.project_id,
            this.doc_id,
            this.afterLines,
            this.source,
            this.user_id,
            true,
            true
          )
        })

        it('should set the undo flag on each op', function () {
          this.ops.map(op => op.u.should.equal(true))
        })
      })

      describe('with the external flag', function () {
        beforeEach(async function () {
          this.undoing = false
          // Copy ops so we don't interfere with other tests
          this.ops = [
            { i: 'foo', p: 4 },
            { d: 'bar', p: 42 },
          ]
          this.DiffCodec.diffAsShareJsOp.returns(this.ops)
          await this.DocumentManager.promises.setDoc(
            this.project_id,
            this.doc_id,
            this.afterLines,
            this.source,
            this.user_id,
            this.undoing,
            true
          )
        })

        it('should add the external type to update metadata', function () {
          this.UpdateManager.promises.applyUpdate
            .calledWith(this.project_id, this.doc_id, {
              doc: this.doc_id,
              v: this.version,
              op: this.ops,
              meta: {
                type: 'external',
                source: this.source,
                user_id: this.user_id,
              },
            })
            .should.equal(true)
        })
      })

      describe('without the external flag', function () {
        beforeEach(async function () {
          this.undoing = false
          // Copy ops so we don't interfere with other tests
          this.ops = [
            { i: 'foo', p: 4 },
            { d: 'bar', p: 42 },
          ]
          this.DiffCodec.diffAsShareJsOp.returns(this.ops)
          await this.DocumentManager.promises.setDoc(
            this.project_id,
            this.doc_id,
            this.afterLines,
            this.source,
            this.user_id,
            this.undoing,
            false
          )
        })

        it('should not add the external type to update metadata', function () {
          this.UpdateManager.promises.applyUpdate
            .calledWith(this.project_id, this.doc_id, {
              doc: this.doc_id,
              v: this.version,
              op: this.ops,
              meta: {
                source: this.source,
                user_id: this.user_id,
              },
            })
            .should.equal(true)
        })
      })
    })
  })

  describe('acceptChanges', function () {
    beforeEach(function () {
      this.change_id = 'mock-change-id'
      this.change_ids = [
        'mock-change-id-1',
        'mock-change-id-2',
        'mock-change-id-3',
        'mock-change-id-4',
      ]
      this.version = 34
      this.lines = ['original', 'lines']
      this.ranges = { entries: 'mock', comments: 'mock' }
      this.updated_ranges = { entries: 'updated', comments: 'updated' }
      this.DocumentManager.promises.getDoc = sinon.stub().resolves({
        lines: this.lines,
        version: this.version,
        ranges: this.ranges,
      })
      this.RangesManager.acceptChanges.returns(this.updated_ranges)
    })

    describe('successfully with a single change', function () {
      beforeEach(async function () {
        await this.DocumentManager.promises.acceptChanges(
          this.project_id,
          this.doc_id,
          [this.change_id]
        )
      })

      it("should get the document's current ranges", function () {
        this.DocumentManager.promises.getDoc
          .calledWith(this.project_id, this.doc_id)
          .should.equal(true)
      })

      it('should apply the accept change to the ranges', function () {
        this.RangesManager.acceptChanges.should.have.been.calledWith(
          this.project_id,
          this.doc_id,
          [this.change_id],
          this.ranges
        )
      })

      it('should save the updated ranges', function () {
        this.RedisManager.promises.updateDocument
          .calledWith(
            this.project_id,
            this.doc_id,
            this.lines,
            this.version,
            [],
            this.updated_ranges,
            {}
          )
          .should.equal(true)
      })
    })

    describe('successfully with multiple changes', function () {
      beforeEach(async function () {
        await this.DocumentManager.promises.acceptChanges(
          this.project_id,
          this.doc_id,
          this.change_ids
        )
      })

      it('should apply the accept change to the ranges', function () {
        this.RangesManager.acceptChanges
          .calledWith(
            this.project_id,
            this.doc_id,
            this.change_ids,
            this.ranges
          )
          .should.equal(true)
      })
    })

    describe('when the doc is not found', function () {
      beforeEach(async function () {
        this.DocumentManager.promises.getDoc = sinon
          .stub()
          .resolves({ lines: null, version: null, ranges: null })
        await expect(
          this.DocumentManager.promises.acceptChanges(
            this.project_id,
            this.doc_id,
            [this.change_id]
          )
        ).to.be.rejectedWith(Errors.NotFoundError)
      })

      it('should not save anything', function () {
        this.RedisManager.promises.updateDocument.called.should.equal(false)
      })
    })
  })

  describe('getComment', function () {
    beforeEach(function () {
      this.ranges.comments = [
        {
          id: 'mock-comment-id-1',
        },
        {
          id: 'mock-comment-id-2',
        },
      ]
      this.DocumentManager.promises.getDoc = sinon.stub().resolves({
        lines: this.lines,
        version: this.version,
        ranges: this.ranges,
      })
    })

    describe('when comment exists', function () {
      beforeEach(async function () {
        await expect(
          this.DocumentManager.promises.getComment(
            this.project_id,
            this.doc_id,
            'mock-comment-id-1'
          )
        ).to.eventually.deep.equal({
          comment: { id: 'mock-comment-id-1' },
        })
      })

      it("should get the document's current ranges", function () {
        this.DocumentManager.promises.getDoc
          .calledWith(this.project_id, this.doc_id)
          .should.equal(true)
      })
    })

    describe('when comment doesnt exists', function () {
      beforeEach(async function () {
        await expect(
          this.DocumentManager.promises.getComment(
            this.project_id,
            this.doc_id,
            'mock-comment-id-x'
          )
        ).to.be.rejectedWith(Errors.NotFoundError)
      })

      it("should get the document's current ranges", function () {
        this.DocumentManager.promises.getDoc
          .calledWith(this.project_id, this.doc_id)
          .should.equal(true)
      })
    })

    describe('when the doc is not found', function () {
      beforeEach(async function () {
        this.DocumentManager.promises.getDoc = sinon
          .stub()
          .resolves({ lines: null, version: null, ranges: null })
        await expect(
          this.DocumentManager.promises.acceptChanges(
            this.project_id,
            this.doc_id,
            [this.change_id]
          )
        ).to.be.rejectedWith(Errors.NotFoundError)
      })
    })
  })

  describe('deleteComment', function () {
    beforeEach(function () {
      this.comment_id = 'mock-comment-id'
      this.version = 34
      this.lines = ['original', 'lines']
      this.ranges = { comments: ['one', 'two', 'three'] }
      this.resolvedCommentIds = ['comment1']
      this.updated_ranges = { comments: ['one', 'three'] }
      this.historyRangesSupport = true
      this.DocumentManager.promises.getDoc = sinon.stub().resolves({
        lines: this.lines,
        version: this.version,
        ranges: this.ranges,
        resolvedCommentIds: this.resolvedCommentIds,
        pathname: this.pathname,
        projectHistoryId: this.projectHistoryId,
        unflushedTime: Date.now() - 1e9,
        alreadyLoaded: true,
        historyRangesSupport: this.historyRangesSupport,
      })
      this.RangesManager.deleteComment.returns(this.updated_ranges)
    })

    describe('successfully', function () {
      beforeEach(async function () {
        await this.DocumentManager.promises.deleteComment(
          this.project_id,
          this.doc_id,
          this.comment_id,
          this.user_id
        )
      })

      it("should get the document's current ranges", function () {
        this.DocumentManager.promises.getDoc
          .calledWith(this.project_id, this.doc_id)
          .should.equal(true)
      })

      it('should delete the comment from the ranges', function () {
        this.RangesManager.deleteComment
          .calledWith(this.comment_id, this.ranges)
          .should.equal(true)
      })

      it('should save the updated ranges', function () {
        this.RedisManager.promises.updateDocument
          .calledWith(
            this.project_id,
            this.doc_id,
            this.lines,
            this.version,
            [],
            this.updated_ranges,
            {}
          )
          .should.equal(true)
      })

      it('should unset the comment resolved state', function () {
        this.RedisManager.promises.updateCommentState.should.have.been.calledWith(
          this.doc_id,
          this.comment_id,
          false
        )
      })

      it('should queue the delete comment operation', function () {
        this.ProjectHistoryRedisManager.promises.queueOps.should.have.been.calledWith(
          this.project_id,
          JSON.stringify({
            pathname: this.pathname,
            deleteComment: this.comment_id,
            meta: {
              ts: new Date(),
              user_id: this.user_id,
            },
          })
        )
      })
    })

    describe('when the doc is not found', function () {
      beforeEach(async function () {
        this.DocumentManager.promises.getDoc = sinon
          .stub()
          .resolves({ lines: null, version: null, ranges: null })
        await expect(
          this.DocumentManager.promises.acceptChanges(
            this.project_id,
            this.doc_id,
            [this.comment_id]
          )
        ).to.be.rejectedWith(Errors.NotFoundError)
      })

      it('should not save anything', function () {
        this.RedisManager.promises.updateDocument.called.should.equal(false)
      })
    })
  })

  describe('getDocAndFlushIfOld', function () {
    beforeEach(function () {
      this.DocumentManager.promises.flushDocIfLoaded = sinon.stub().resolves()
    })

    describe('when the doc is in Redis', function () {
      describe('and has changes to be flushed', function () {
        beforeEach(async function () {
          this.DocumentManager.promises.getDoc = sinon.stub().resolves({
            lines: this.lines,
            version: this.version,
            ranges: this.ranges,
            projectHistoryId: this.projectHistoryId,
            pathname: this.pathname,
            unflushedTime: Date.now() - 1e9,
            alreadyLoaded: true,
          })
          this.result = await this.DocumentManager.promises.getDocAndFlushIfOld(
            this.project_id,
            this.doc_id
          )
        })

        it('should get the doc', function () {
          this.DocumentManager.promises.getDoc
            .calledWith(this.project_id, this.doc_id)
            .should.equal(true)
        })

        it('should flush the doc', function () {
          this.DocumentManager.promises.flushDocIfLoaded
            .calledWith(this.project_id, this.doc_id)
            .should.equal(true)
        })

        it('should return the lines and versions', function () {
          expect(this.result).to.deep.equal({
            lines: this.lines,
            version: this.version,
          })
        })
      })

      describe("and has only changes that don't need to be flushed", function () {
        beforeEach(async function () {
          this.DocumentManager.promises.getDoc = sinon.stub().resolves({
            lines: this.lines,
            version: this.version,
            ranges: this.ranges,
            pathname: this.pathname,
            unflushedTime: Date.now() - 100,
            alreadyLoaded: true,
          })
          this.result = await this.DocumentManager.promises.getDocAndFlushIfOld(
            this.project_id,
            this.doc_id
          )
        })

        it('should get the doc', function () {
          this.DocumentManager.promises.getDoc
            .calledWith(this.project_id, this.doc_id)
            .should.equal(true)
        })

        it('should not flush the doc', function () {
          this.DocumentManager.promises.flushDocIfLoaded.called.should.equal(
            false
          )
        })

        it('should return the lines and versions', function () {
          expect(this.result).to.deep.equal({
            lines: this.lines,
            version: this.version,
          })
        })
      })
    })

    describe('when the doc is not in Redis', function () {
      beforeEach(async function () {
        this.DocumentManager.promises.getDoc = sinon.stub().resolves({
          lines: this.lines,
          version: this.version,
          ranges: this.ranges,
          alreadyLoaded: false,
        })
        this.result = await this.DocumentManager.promises.getDocAndFlushIfOld(
          this.project_id,
          this.doc_id
        )
      })

      it('should get the doc', function () {
        this.DocumentManager.promises.getDoc
          .calledWith(this.project_id, this.doc_id)
          .should.equal(true)
      })

      it('should not flush the doc', function () {
        this.DocumentManager.promises.flushDocIfLoaded.called.should.equal(
          false
        )
      })

      it('should return the lines and versions', function () {
        expect(this.result).to.deep.equal({
          lines: this.lines,
          version: this.version,
        })
      })
    })
  })

  describe('renameDoc', function () {
    beforeEach(function () {
      this.update = 'some-update'
    })

    describe('successfully', function () {
      beforeEach(async function () {
        await this.DocumentManager.promises.renameDoc(
          this.project_id,
          this.doc_id,
          this.user_id,
          this.update,
          this.projectHistoryId
        )
      })

      it('should rename the document', function () {
        this.RedisManager.promises.renameDoc
          .calledWith(
            this.project_id,
            this.doc_id,
            this.user_id,
            this.update,
            this.projectHistoryId
          )
          .should.equal(true)
      })
    })
  })

  describe('resyncDocContents', function () {
    describe('when doc is loaded in redis', function () {
      beforeEach(async function () {
        this.pathnameFromProjectStructureUpdate = '/foo/bar.tex'
        this.RedisManager.promises.getDoc.resolves({
          lines: this.lines,
          version: this.version,
          ranges: this.ranges,
          resolvedCommentIds: this.resolvedCommentIds,
          pathname: this.pathname,
          projectHistoryId: this.projectHistoryId,
          historyRangesSupport: this.historyRangesSupport,
        })
        await this.DocumentManager.promises.resyncDocContents(
          this.project_id,
          this.doc_id,
          this.pathnameFromProjectStructureUpdate
        )
      })

      it('gets the doc contents from redis', function () {
        this.RedisManager.promises.getDoc
          .calledWith(this.project_id, this.doc_id)
          .should.equal(true)
      })

      it('queues a resync doc content update', function () {
        this.ProjectHistoryRedisManager.promises.queueResyncDocContent
          .calledWith(
            this.project_id,
            this.projectHistoryId,
            this.doc_id,
            this.lines,
            this.ranges,
            this.resolvedCommentIds,
            this.version,
            this.pathnameFromProjectStructureUpdate,
            this.historyRangesSupport
          )
          .should.equal(true)
      })
    })

    describe('when doc is not loaded in redis', function () {
      beforeEach(async function () {
        this.pathnameFromProjectStructureUpdate = '/foo/bar.tex'
        this.RedisManager.promises.getDoc.resolves({})
        this.PersistenceManager.promises.getDoc.resolves({
          lines: this.lines,
          version: this.version,
          ranges: this.ranges,
          resolvedCommentIds: this.resolvedCommentIds,
          pathname: this.pathname,
          projectHistoryId: this.projectHistoryId,
          historyRangesSupport: this.historyRangesSupport,
        })
        await this.DocumentManager.promises.resyncDocContents(
          this.project_id,
          this.doc_id,
          this.pathnameFromProjectStructureUpdate
        )
      })

      it('tries to get the doc contents from redis', function () {
        this.RedisManager.promises.getDoc
          .calledWith(this.project_id, this.doc_id)
          .should.equal(true)
      })

      it('gets the doc contents from web', function () {
        this.PersistenceManager.promises.getDoc
          .calledWith(this.project_id, this.doc_id, { peek: true })
          .should.equal(true)
      })

      it('queues a resync doc content update', function () {
        this.ProjectHistoryRedisManager.promises.queueResyncDocContent
          .calledWith(
            this.project_id,
            this.projectHistoryId,
            this.doc_id,
            this.lines,
            this.ranges,
            this.resolvedCommentIds,
            this.version,
            this.pathnameFromProjectStructureUpdate,
            this.historyRangesSupport
          )
          .should.equal(true)
      })
    })

    describe('when a doc has no ranges in docstore', function () {
      beforeEach(async function () {
        this.pathnameFromProjectStructureUpdate = '/foo/bar.tex'
        this.RedisManager.promises.getDoc.resolves({})
        this.PersistenceManager.promises.getDoc.resolves({
          lines: this.lines,
          version: this.version,
          ranges: undefined,
          resolvedCommentIds: [],
          pathname: this.pathname,
          projectHistoryId: this.projectHistoryId,
          historyRangesSupport: this.historyRangesSupport,
        })
        await this.DocumentManager.promises.resyncDocContents(
          this.project_id,
          this.doc_id,
          this.pathnameFromProjectStructureUpdate
        )
      })

      it('gets the doc contents from web', function () {
        this.PersistenceManager.promises.getDoc
          .calledWith(this.project_id, this.doc_id, { peek: true })
          .should.equal(true)
      })

      it('queues a resync doc content update with an empty ranges object', function () {
        this.ProjectHistoryRedisManager.promises.queueResyncDocContent
          .calledWith(
            this.project_id,
            this.projectHistoryId,
            this.doc_id,
            this.lines,
            {},
            [],
            this.version,
            this.pathnameFromProjectStructureUpdate,
            this.historyRangesSupport
          )
          .should.equal(true)
      })
    })
  })

  describe('appendToDoc', function () {
    describe('sucessfully', function () {
      beforeEach(async function () {
        this.lines = ['one', 'two', 'three']
        this.DocumentManager.promises.setDoc = sinon
          .stub()
          .resolves({ rev: '123' })
        this.DocumentManager.promises.getDoc = sinon.stub().resolves({
          lines: this.lines,
        })
        this.result = await this.DocumentManager.promises.appendToDoc(
          this.project_id,
          this.doc_id,
          ['four', 'five', 'six'],
          this.source,
          this.user_id
        )
      })

      it('should call setDoc with concatenated lines', function () {
        this.DocumentManager.promises.setDoc
          .calledWith(
            this.project_id,
            this.doc_id,
            ['one', 'two', 'three', 'four', 'five', 'six'],
            this.source,
            this.user_id,
            false,
            false
          )
          .should.equal(true)
      })

      it('should return output from setDoc', function () {
        this.result.should.deep.equal({ rev: '123' })
      })
    })

    describe('when doc would become too big', function () {
      beforeEach(async function () {
        this.Settings.max_doc_length = 100
        this.lines = ['one', 'two', 'three']
        this.DocumentManager.promises.setDoc = sinon
          .stub()
          .resolves({ rev: '123' })
        this.DocumentManager.promises.getDoc = sinon.stub().resolves({
          lines: this.lines,
        })
      })

      it('should fail with FileTooLarge error', async function () {
        expect(
          this.DocumentManager.promises.appendToDoc(
            this.project_id,
            this.doc_id,
            ['x'.repeat(1000)],
            this.source,
            this.user_id
          )
        ).to.eventually.be.rejectedWith(Errors.FileTooLargeError)
      })
    })
  })
})
