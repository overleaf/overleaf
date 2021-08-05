/* eslint-disable
    no-return-assign,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const sinon = require('sinon')
const modulePath = '../../../../app/js/DocumentManager.js'
const SandboxedModule = require('sandboxed-module')
const Errors = require('../../../../app/js/Errors')
const tk = require('timekeeper')

describe('DocumentManager', function () {
  beforeEach(function () {
    let Timer
    tk.freeze(new Date())
    this.DocumentManager = SandboxedModule.require(modulePath, {
      requires: {
        './RedisManager': (this.RedisManager = {}),
        './ProjectHistoryRedisManager': (this.ProjectHistoryRedisManager = {}),
        './PersistenceManager': (this.PersistenceManager = {}),
        './HistoryManager': (this.HistoryManager = {
          flushDocChangesAsync: sinon.stub(),
          flushProjectChangesAsync: sinon.stub(),
        }),
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
        './RealTimeRedisManager': (this.RealTimeRedisManager = {}),
        './DiffCodec': (this.DiffCodec = {}),
        './UpdateManager': (this.UpdateManager = {}),
        './RangesManager': (this.RangesManager = {}),
        './Errors': Errors,
      },
    })
    this.project_id = 'project-id-123'
    this.projectHistoryId = 'history-id-123'
    this.projectHistoryType = 'project-history'
    this.doc_id = 'doc-id-123'
    this.user_id = 1234
    this.callback = sinon.stub()
    this.lines = ['one', 'two', 'three']
    this.version = 42
    this.ranges = { comments: 'mock', entries: 'mock' }
    this.pathname = '/a/b/c.tex'
    this.unflushedTime = Date.now()
    this.lastUpdatedAt = Date.now()
    return (this.lastUpdatedBy = 'last-author-id')
  })

  afterEach(function () {
    return tk.reset()
  })

  describe('flushAndDeleteDoc', function () {
    describe('successfully', function () {
      beforeEach(function () {
        this.RedisManager.removeDocFromMemory = sinon.stub().callsArg(2)
        this.DocumentManager.flushDocIfLoaded = sinon.stub().callsArgWith(2)
        return this.DocumentManager.flushAndDeleteDoc(
          this.project_id,
          this.doc_id,
          {},
          this.callback
        )
      })

      it('should flush the doc', function () {
        return this.DocumentManager.flushDocIfLoaded
          .calledWith(this.project_id, this.doc_id)
          .should.equal(true)
      })

      it('should remove the doc from redis', function () {
        return this.RedisManager.removeDocFromMemory
          .calledWith(this.project_id, this.doc_id)
          .should.equal(true)
      })

      it('should call the callback without error', function () {
        return this.callback.calledWith(null).should.equal(true)
      })

      it('should time the execution', function () {
        return this.Metrics.Timer.prototype.done.called.should.equal(true)
      })

      return it('should flush to the history api', function () {
        return this.HistoryManager.flushDocChangesAsync
          .calledWithExactly(this.project_id, this.doc_id)
          .should.equal(true)
      })
    })

    return describe('when a flush error occurs', function () {
      beforeEach(function () {
        this.DocumentManager.flushDocIfLoaded = sinon
          .stub()
          .callsArgWith(2, new Error('boom!'))
        return (this.RedisManager.removeDocFromMemory = sinon
          .stub()
          .callsArg(2))
      })

      it('should not remove the doc from redis', function (done) {
        return this.DocumentManager.flushAndDeleteDoc(
          this.project_id,
          this.doc_id,
          {},
          error => {
            error.should.exist
            this.RedisManager.removeDocFromMemory.called.should.equal(false)
            return done()
          }
        )
      })

      return describe('when ignoring flush errors', function () {
        return it('should remove the doc from redis', function (done) {
          return this.DocumentManager.flushAndDeleteDoc(
            this.project_id,
            this.doc_id,
            { ignoreFlushErrors: true },
            error => {
              if (error != null) {
                return done(error)
              }
              this.RedisManager.removeDocFromMemory.called.should.equal(true)
              return done()
            }
          )
        })
      })
    })
  })

  describe('flushDocIfLoaded', function () {
    describe('when the doc is in Redis', function () {
      beforeEach(function () {
        this.RedisManager.getDoc = sinon
          .stub()
          .callsArgWith(
            2,
            null,
            this.lines,
            this.version,
            this.ranges,
            this.pathname,
            this.projectHistoryId,
            this.unflushedTime,
            this.lastUpdatedAt,
            this.lastUpdatedBy
          )
        this.RedisManager.clearUnflushedTime = sinon
          .stub()
          .callsArgWith(1, null)
        this.PersistenceManager.setDoc = sinon.stub().yields()
        return this.DocumentManager.flushDocIfLoaded(
          this.project_id,
          this.doc_id,
          this.callback
        )
      })

      it('should get the doc from redis', function () {
        return this.RedisManager.getDoc
          .calledWith(this.project_id, this.doc_id)
          .should.equal(true)
      })

      it('should write the doc lines to the persistence layer', function () {
        return this.PersistenceManager.setDoc
          .calledWith(
            this.project_id,
            this.doc_id,
            this.lines,
            this.version,
            this.ranges,
            this.lastUpdatedAt,
            this.lastUpdatedBy
          )
          .should.equal(true)
      })

      it('should call the callback without error', function () {
        return this.callback.calledWith(null).should.equal(true)
      })

      return it('should time the execution', function () {
        return this.Metrics.Timer.prototype.done.called.should.equal(true)
      })
    })

    return describe('when the document is not in Redis', function () {
      beforeEach(function () {
        this.RedisManager.getDoc = sinon
          .stub()
          .callsArgWith(2, null, null, null, null)
        this.PersistenceManager.setDoc = sinon.stub().yields()
        return this.DocumentManager.flushDocIfLoaded(
          this.project_id,
          this.doc_id,
          this.callback
        )
      })

      it('should get the doc from redis', function () {
        return this.RedisManager.getDoc
          .calledWith(this.project_id, this.doc_id)
          .should.equal(true)
      })

      it('should not write anything to the persistence layer', function () {
        this.PersistenceManager.setDoc.called.should.equal(false)
      })

      it('should call the callback without error', function () {
        return this.callback.calledWith(null).should.equal(true)
      })

      return it('should time the execution', function () {
        return this.Metrics.Timer.prototype.done.called.should.equal(true)
      })
    })
  })

  describe('getDocAndRecentOps', function () {
    describe('with a previous version specified', function () {
      beforeEach(function () {
        this.DocumentManager.getDoc = sinon
          .stub()
          .callsArgWith(
            2,
            null,
            this.lines,
            this.version,
            this.ranges,
            this.pathname,
            this.projectHistoryId
          )
        this.RedisManager.getPreviousDocOps = sinon
          .stub()
          .callsArgWith(3, null, this.ops)
        return this.DocumentManager.getDocAndRecentOps(
          this.project_id,
          this.doc_id,
          this.fromVersion,
          this.callback
        )
      })

      it('should get the doc', function () {
        return this.DocumentManager.getDoc
          .calledWith(this.project_id, this.doc_id)
          .should.equal(true)
      })

      it('should get the doc ops', function () {
        return this.RedisManager.getPreviousDocOps
          .calledWith(this.doc_id, this.fromVersion, this.version)
          .should.equal(true)
      })

      it('should call the callback with the doc info', function () {
        return this.callback
          .calledWith(
            null,
            this.lines,
            this.version,
            this.ops,
            this.ranges,
            this.pathname,
            this.projectHistoryId
          )
          .should.equal(true)
      })

      return it('should time the execution', function () {
        return this.Metrics.Timer.prototype.done.called.should.equal(true)
      })
    })

    return describe('with no previous version specified', function () {
      beforeEach(function () {
        this.DocumentManager.getDoc = sinon
          .stub()
          .callsArgWith(
            2,
            null,
            this.lines,
            this.version,
            this.ranges,
            this.pathname,
            this.projectHistoryId
          )
        this.RedisManager.getPreviousDocOps = sinon
          .stub()
          .callsArgWith(3, null, this.ops)
        return this.DocumentManager.getDocAndRecentOps(
          this.project_id,
          this.doc_id,
          -1,
          this.callback
        )
      })

      it('should get the doc', function () {
        return this.DocumentManager.getDoc
          .calledWith(this.project_id, this.doc_id)
          .should.equal(true)
      })

      it('should not need to get the doc ops', function () {
        return this.RedisManager.getPreviousDocOps.called.should.equal(false)
      })

      it('should call the callback with the doc info', function () {
        return this.callback
          .calledWith(
            null,
            this.lines,
            this.version,
            [],
            this.ranges,
            this.pathname,
            this.projectHistoryId
          )
          .should.equal(true)
      })

      return it('should time the execution', function () {
        return this.Metrics.Timer.prototype.done.called.should.equal(true)
      })
    })
  })

  describe('getDoc', function () {
    describe('when the doc exists in Redis', function () {
      beforeEach(function () {
        this.RedisManager.getDoc = sinon
          .stub()
          .callsArgWith(
            2,
            null,
            this.lines,
            this.version,
            this.ranges,
            this.pathname,
            this.projectHistoryId,
            this.unflushedTime
          )
        return this.DocumentManager.getDoc(
          this.project_id,
          this.doc_id,
          this.callback
        )
      })

      it('should get the doc from Redis', function () {
        return this.RedisManager.getDoc
          .calledWith(this.project_id, this.doc_id)
          .should.equal(true)
      })

      it('should call the callback with the doc info', function () {
        return this.callback
          .calledWith(
            null,
            this.lines,
            this.version,
            this.ranges,
            this.pathname,
            this.projectHistoryId,
            this.unflushedTime,
            true
          )
          .should.equal(true)
      })

      return it('should time the execution', function () {
        return this.Metrics.Timer.prototype.done.called.should.equal(true)
      })
    })

    return describe('when the doc does not exist in Redis', function () {
      beforeEach(function () {
        this.RedisManager.getDoc = sinon
          .stub()
          .callsArgWith(2, null, null, null, null, null, null)
        this.PersistenceManager.getDoc = sinon
          .stub()
          .callsArgWith(
            2,
            null,
            this.lines,
            this.version,
            this.ranges,
            this.pathname,
            this.projectHistoryId,
            this.projectHistoryType
          )
        this.RedisManager.putDocInMemory = sinon.stub().yields()
        this.RedisManager.setHistoryType = sinon.stub().yields()
        return this.DocumentManager.getDoc(
          this.project_id,
          this.doc_id,
          this.callback
        )
      })

      it('should try to get the doc from Redis', function () {
        return this.RedisManager.getDoc
          .calledWith(this.project_id, this.doc_id)
          .should.equal(true)
      })

      it('should get the doc from the PersistenceManager', function () {
        return this.PersistenceManager.getDoc
          .calledWith(this.project_id, this.doc_id)
          .should.equal(true)
      })

      it('should set the doc in Redis', function () {
        return this.RedisManager.putDocInMemory
          .calledWith(
            this.project_id,
            this.doc_id,
            this.lines,
            this.version,
            this.ranges,
            this.pathname,
            this.projectHistoryId
          )
          .should.equal(true)
      })

      it('should set the history type in Redis', function () {
        return this.RedisManager.setHistoryType
          .calledWith(this.doc_id, this.projectHistoryType)
          .should.equal(true)
      })

      it('should call the callback with the doc info', function () {
        return this.callback
          .calledWith(
            null,
            this.lines,
            this.version,
            this.ranges,
            this.pathname,
            this.projectHistoryId,
            null,
            false
          )
          .should.equal(true)
      })

      return it('should time the execution', function () {
        return this.Metrics.Timer.prototype.done.called.should.equal(true)
      })
    })
  })

  describe('setDoc', function () {
    return describe('with plain tex lines', function () {
      beforeEach(function () {
        this.beforeLines = ['before', 'lines']
        this.afterLines = ['after', 'lines']
        this.ops = [
          { i: 'foo', p: 4 },
          { d: 'bar', p: 42 },
        ]
        this.DocumentManager.getDoc = sinon
          .stub()
          .callsArgWith(
            2,
            null,
            this.beforeLines,
            this.version,
            this.ranges,
            this.pathname,
            this.projectHistoryId,
            this.unflushedTime,
            true
          )
        this.DiffCodec.diffAsShareJsOp = sinon
          .stub()
          .callsArgWith(2, null, this.ops)
        this.UpdateManager.applyUpdate = sinon.stub().callsArgWith(3, null)
        this.DocumentManager.flushDocIfLoaded = sinon.stub().callsArg(2)
        return (this.DocumentManager.flushAndDeleteDoc = sinon
          .stub()
          .callsArg(3))
      })

      describe('when already loaded', function () {
        beforeEach(function () {
          return this.DocumentManager.setDoc(
            this.project_id,
            this.doc_id,
            this.afterLines,
            this.source,
            this.user_id,
            false,
            this.callback
          )
        })

        it('should get the current doc lines', function () {
          return this.DocumentManager.getDoc
            .calledWith(this.project_id, this.doc_id)
            .should.equal(true)
        })

        it('should return a diff of the old and new lines', function () {
          return this.DiffCodec.diffAsShareJsOp
            .calledWith(this.beforeLines, this.afterLines)
            .should.equal(true)
        })

        it('should apply the diff as a ShareJS op', function () {
          return this.UpdateManager.applyUpdate
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

        it('should flush the doc to Mongo', function () {
          return this.DocumentManager.flushDocIfLoaded
            .calledWith(this.project_id, this.doc_id)
            .should.equal(true)
        })

        it('should not flush the project history', function () {
          return this.HistoryManager.flushProjectChangesAsync.called.should.equal(
            false
          )
        })

        it('should call the callback', function () {
          return this.callback.calledWith(null).should.equal(true)
        })

        return it('should time the execution', function () {
          return this.Metrics.Timer.prototype.done.called.should.equal(true)
        })
      })

      describe('when not already loaded', function () {
        beforeEach(function () {
          this.DocumentManager.getDoc = sinon
            .stub()
            .callsArgWith(
              2,
              null,
              this.beforeLines,
              this.version,
              this.pathname,
              null,
              false
            )
          return this.DocumentManager.setDoc(
            this.project_id,
            this.doc_id,
            this.afterLines,
            this.source,
            this.user_id,
            false,
            this.callback
          )
        })

        it('should flush and delete the doc from the doc updater', function () {
          return this.DocumentManager.flushAndDeleteDoc
            .calledWith(this.project_id, this.doc_id, {})
            .should.equal(true)
        })

        return it('should not flush the project history', function () {
          return this.HistoryManager.flushProjectChangesAsync
            .calledWithExactly(this.project_id)
            .should.equal(true)
        })
      })

      describe('without new lines', function () {
        beforeEach(function () {
          return this.DocumentManager.setDoc(
            this.project_id,
            this.doc_id,
            null,
            this.source,
            this.user_id,
            false,
            this.callback
          )
        })

        it('should return the callback with an error', function () {
          return this.callback.calledWith(
            new Error('No lines were passed to setDoc')
          )
        })

        return it('should not try to get the doc lines', function () {
          return this.DocumentManager.getDoc.called.should.equal(false)
        })
      })

      return describe('with the undoing flag', function () {
        beforeEach(function () {
          // Copy ops so we don't interfere with other tests
          this.ops = [
            { i: 'foo', p: 4 },
            { d: 'bar', p: 42 },
          ]
          this.DiffCodec.diffAsShareJsOp = sinon
            .stub()
            .callsArgWith(2, null, this.ops)
          return this.DocumentManager.setDoc(
            this.project_id,
            this.doc_id,
            this.afterLines,
            this.source,
            this.user_id,
            true,
            this.callback
          )
        })

        return it('should set the undo flag on each op', function () {
          return Array.from(this.ops).map(op => op.u.should.equal(true))
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
      this.DocumentManager.getDoc = sinon
        .stub()
        .yields(null, this.lines, this.version, this.ranges)
      this.RangesManager.acceptChanges = sinon
        .stub()
        .yields(null, this.updated_ranges)
      return (this.RedisManager.updateDocument = sinon.stub().yields())
    })

    describe('successfully with a single change', function () {
      beforeEach(function () {
        return this.DocumentManager.acceptChanges(
          this.project_id,
          this.doc_id,
          [this.change_id],
          this.callback
        )
      })

      it("should get the document's current ranges", function () {
        return this.DocumentManager.getDoc
          .calledWith(this.project_id, this.doc_id)
          .should.equal(true)
      })

      it('should apply the accept change to the ranges', function () {
        return this.RangesManager.acceptChanges
          .calledWith([this.change_id], this.ranges)
          .should.equal(true)
      })

      it('should save the updated ranges', function () {
        return this.RedisManager.updateDocument
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

      return it('should call the callback', function () {
        return this.callback.called.should.equal(true)
      })
    })

    describe('successfully with multiple changes', function () {
      beforeEach(function () {
        return this.DocumentManager.acceptChanges(
          this.project_id,
          this.doc_id,
          this.change_ids,
          this.callback
        )
      })

      return it('should apply the accept change to the ranges', function () {
        return this.RangesManager.acceptChanges
          .calledWith(this.change_ids, this.ranges)
          .should.equal(true)
      })
    })

    return describe('when the doc is not found', function () {
      beforeEach(function () {
        this.DocumentManager.getDoc = sinon
          .stub()
          .yields(null, null, null, null)
        return this.DocumentManager.acceptChanges(
          this.project_id,
          this.doc_id,
          [this.change_id],
          this.callback
        )
      })

      it('should not save anything', function () {
        return this.RedisManager.updateDocument.called.should.equal(false)
      })

      return it('should call the callback with a not found error', function () {
        return this.callback
          .calledWith(sinon.match.instanceOf(Errors.NotFoundError))
          .should.equal(true)
      })
    })
  })

  describe('deleteComment', function () {
    beforeEach(function () {
      this.comment_id = 'mock-comment-id'
      this.version = 34
      this.lines = ['original', 'lines']
      this.ranges = { comments: ['one', 'two', 'three'] }
      this.updated_ranges = { comments: ['one', 'three'] }
      this.DocumentManager.getDoc = sinon
        .stub()
        .yields(null, this.lines, this.version, this.ranges)
      this.RangesManager.deleteComment = sinon
        .stub()
        .yields(null, this.updated_ranges)
      return (this.RedisManager.updateDocument = sinon.stub().yields())
    })

    describe('successfully', function () {
      beforeEach(function () {
        return this.DocumentManager.deleteComment(
          this.project_id,
          this.doc_id,
          this.comment_id,
          this.callback
        )
      })

      it("should get the document's current ranges", function () {
        return this.DocumentManager.getDoc
          .calledWith(this.project_id, this.doc_id)
          .should.equal(true)
      })

      it('should delete the comment from the ranges', function () {
        return this.RangesManager.deleteComment
          .calledWith(this.comment_id, this.ranges)
          .should.equal(true)
      })

      it('should save the updated ranges', function () {
        return this.RedisManager.updateDocument
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

      return it('should call the callback', function () {
        return this.callback.called.should.equal(true)
      })
    })

    return describe('when the doc is not found', function () {
      beforeEach(function () {
        this.DocumentManager.getDoc = sinon
          .stub()
          .yields(null, null, null, null)
        return this.DocumentManager.acceptChanges(
          this.project_id,
          this.doc_id,
          [this.comment_id],
          this.callback
        )
      })

      it('should not save anything', function () {
        return this.RedisManager.updateDocument.called.should.equal(false)
      })

      return it('should call the callback with a not found error', function () {
        return this.callback
          .calledWith(sinon.match.instanceOf(Errors.NotFoundError))
          .should.equal(true)
      })
    })
  })

  describe('getDocAndFlushIfOld', function () {
    beforeEach(function () {
      return (this.DocumentManager.flushDocIfLoaded = sinon.stub().callsArg(2))
    })

    describe('when the doc is in Redis', function () {
      describe('and has changes to be flushed', function () {
        beforeEach(function () {
          this.DocumentManager.getDoc = sinon
            .stub()
            .callsArgWith(
              2,
              null,
              this.lines,
              this.version,
              this.ranges,
              this.projectHistoryId,
              this.pathname,
              Date.now() - 1e9,
              true
            )
          return this.DocumentManager.getDocAndFlushIfOld(
            this.project_id,
            this.doc_id,
            this.callback
          )
        })

        it('should get the doc', function () {
          return this.DocumentManager.getDoc
            .calledWith(this.project_id, this.doc_id)
            .should.equal(true)
        })

        it('should flush the doc', function () {
          return this.DocumentManager.flushDocIfLoaded
            .calledWith(this.project_id, this.doc_id)
            .should.equal(true)
        })

        return it('should call the callback with the lines and versions', function () {
          return this.callback
            .calledWith(null, this.lines, this.version)
            .should.equal(true)
        })
      })

      return describe("and has only changes that don't need to be flushed", function () {
        beforeEach(function () {
          this.DocumentManager.getDoc = sinon
            .stub()
            .callsArgWith(
              2,
              null,
              this.lines,
              this.version,
              this.ranges,
              this.pathname,
              Date.now() - 100,
              true
            )
          return this.DocumentManager.getDocAndFlushIfOld(
            this.project_id,
            this.doc_id,
            this.callback
          )
        })

        it('should get the doc', function () {
          return this.DocumentManager.getDoc
            .calledWith(this.project_id, this.doc_id)
            .should.equal(true)
        })

        it('should not flush the doc', function () {
          return this.DocumentManager.flushDocIfLoaded.called.should.equal(
            false
          )
        })

        return it('should call the callback with the lines and versions', function () {
          return this.callback
            .calledWith(null, this.lines, this.version)
            .should.equal(true)
        })
      })
    })

    return describe('when the doc is not in Redis', function () {
      beforeEach(function () {
        this.DocumentManager.getDoc = sinon
          .stub()
          .callsArgWith(
            2,
            null,
            this.lines,
            this.version,
            this.ranges,
            null,
            false
          )
        return this.DocumentManager.getDocAndFlushIfOld(
          this.project_id,
          this.doc_id,
          this.callback
        )
      })

      it('should get the doc', function () {
        return this.DocumentManager.getDoc
          .calledWith(this.project_id, this.doc_id)
          .should.equal(true)
      })

      it('should not flush the doc', function () {
        return this.DocumentManager.flushDocIfLoaded.called.should.equal(false)
      })

      return it('should call the callback with the lines and versions', function () {
        return this.callback
          .calledWith(null, this.lines, this.version)
          .should.equal(true)
      })
    })
  })

  describe('renameDoc', function () {
    beforeEach(function () {
      this.update = 'some-update'
      return (this.RedisManager.renameDoc = sinon.stub().yields())
    })

    return describe('successfully', function () {
      beforeEach(function () {
        return this.DocumentManager.renameDoc(
          this.project_id,
          this.doc_id,
          this.user_id,
          this.update,
          this.projectHistoryId,
          this.callback
        )
      })

      it('should rename the document', function () {
        return this.RedisManager.renameDoc
          .calledWith(
            this.project_id,
            this.doc_id,
            this.user_id,
            this.update,
            this.projectHistoryId
          )
          .should.equal(true)
      })

      return it('should call the callback', function () {
        return this.callback.called.should.equal(true)
      })
    })
  })

  return describe('resyncDocContents', function () {
    describe('when doc is loaded in redis', function () {
      beforeEach(function () {
        this.RedisManager.getDoc = sinon
          .stub()
          .callsArgWith(
            2,
            null,
            this.lines,
            this.version,
            this.ranges,
            this.pathname,
            this.projectHistoryId
          )
        this.ProjectHistoryRedisManager.queueResyncDocContent = sinon.stub()
        return this.DocumentManager.resyncDocContents(
          this.project_id,
          this.doc_id,
          this.callback
        )
      })

      it('gets the doc contents from redis', function () {
        return this.RedisManager.getDoc
          .calledWith(this.project_id, this.doc_id)
          .should.equal(true)
      })

      return it('queues a resync doc content update', function () {
        return this.ProjectHistoryRedisManager.queueResyncDocContent
          .calledWith(
            this.project_id,
            this.projectHistoryId,
            this.doc_id,
            this.lines,
            this.version,
            this.pathname,
            this.callback
          )
          .should.equal(true)
      })
    })

    return describe('when doc is not loaded in redis', function () {
      beforeEach(function () {
        this.RedisManager.getDoc = sinon.stub().callsArgWith(2, null)
        this.PersistenceManager.getDoc = sinon
          .stub()
          .callsArgWith(
            2,
            null,
            this.lines,
            this.version,
            this.ranges,
            this.pathname,
            this.projectHistoryId
          )
        this.ProjectHistoryRedisManager.queueResyncDocContent = sinon.stub()
        return this.DocumentManager.resyncDocContents(
          this.project_id,
          this.doc_id,
          this.callback
        )
      })

      it('tries to get the doc contents from redis', function () {
        return this.RedisManager.getDoc
          .calledWith(this.project_id, this.doc_id)
          .should.equal(true)
      })

      it('gets the doc contents from web', function () {
        return this.PersistenceManager.getDoc
          .calledWith(this.project_id, this.doc_id)
          .should.equal(true)
      })

      return it('queues a resync doc content update', function () {
        return this.ProjectHistoryRedisManager.queueResyncDocContent
          .calledWith(
            this.project_id,
            this.projectHistoryId,
            this.doc_id,
            this.lines,
            this.version,
            this.pathname,
            this.callback
          )
          .should.equal(true)
      })
    })
  })
})
