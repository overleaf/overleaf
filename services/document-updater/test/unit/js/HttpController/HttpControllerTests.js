const sinon = require('sinon')
const modulePath = '../../../../app/js/HttpController.js'
const SandboxedModule = require('sandboxed-module')
const Errors = require('../../../../app/js/Errors.js')

describe('HttpController', function () {
  beforeEach(function () {
    this.project_id = 'aaaaaaaaaaaaaaaaaaaaaaaa'
    this.projectHistoryId = '123'
    this.doc_id = 'bbbbbbbbbbbbbbbbbbbbbbbb'
    this.comment_id = 'cccccccccccccccccccccccc'
    this.source = 'editor'
    this.next = sinon.stub()
    this.res = {
      send: sinon.stub(),
      sendStatus: sinon.stub(),
      json: sinon.stub(),
      status: sinon.stub().returnsThis(),
    }

    this.DocumentManager = {
      promises: {
        getDocAndRecentOpsWithLock: sinon.stub(),
        getCommentWithLock: sinon.stub(),
        setDocWithLock: sinon.stub(),
        flushDocIfLoadedWithLock: sinon.stub().resolves(),
        flushAndDeleteDocWithLock: sinon.stub().resolves(),
        acceptChangesWithLock: sinon.stub().resolves(),
        updateCommentStateWithLock: sinon.stub().resolves(),
        deleteCommentWithLock: sinon.stub().resolves(),
        appendToDocWithLock: sinon.stub(),
      },
    }

    this.HistoryManager = {
      flushProjectChangesAsync: sinon.stub(),
      promises: {
        resyncProjectHistory: sinon.stub().resolves(),
      },
    }

    this.ProjectHistoryRedisManager = {
      promises: {
        queueOps: sinon.stub().resolves(),
      },
    }

    this.ProjectManager = {
      promises: {
        flushProjectWithLocks: sinon.stub().resolves(),
        flushAndDeleteProjectWithLocks: sinon.stub().resolves(),
        queueFlushAndDeleteProject: sinon.stub().resolves(),
        getProjectDocsAndFlushIfOld: sinon.stub(),
        updateProjectWithLocks: sinon.stub().resolves(),
      },
    }

    this.DeleteQueueManager = {}

    this.RedisManager = {
      DOC_OPS_TTL: 42,
    }

    this.Metrics = {
      Timer: class Timer {},
    }
    this.Metrics.Timer.prototype.done = sinon.stub()

    this.Utils = {
      addTrackedDeletesToContent: sinon.stub().returnsArg(0),
    }

    this.HistoryConversions = {
      toHistoryRanges: sinon.stub().returnsArg(0),
    }

    this.HttpController = SandboxedModule.require(modulePath, {
      requires: {
        './DocumentManager': this.DocumentManager,
        './HistoryManager': this.HistoryManager,
        './ProjectHistoryRedisManager': this.ProjectHistoryRedisManager,
        './ProjectManager': this.ProjectManager,
        './DeleteQueueManager': this.DeleteQueueManager,
        './RedisManager': this.RedisManager,
        './Metrics': this.Metrics,
        './Errors': Errors,
        './Utils': this.Utils,
        './HistoryConversions': this.HistoryConversions,
        '@overleaf/settings': { max_doc_length: 2 * 1024 * 1024 },
      },
    })
  })

  describe('getDoc', function () {
    beforeEach(function () {
      this.lines = ['one', 'two', 'three']
      this.ops = ['mock-op-1', 'mock-op-2']
      this.version = 42
      this.fromVersion = 42
      this.ranges = { changes: 'mock', comments: 'mock' }
      this.pathname = '/a/b/c'
      this.req = {
        params: {
          project_id: this.project_id,
          doc_id: this.doc_id,
        },
        query: {},
        body: {},
      }
    })

    describe('when the document exists and no recent ops are requested', function () {
      beforeEach(async function () {
        this.DocumentManager.promises.getDocAndRecentOpsWithLock.resolves({
          lines: this.lines,
          version: this.version,
          ops: [],
          ranges: this.ranges,
          pathname: this.pathname,
          projectHistoryId: this.projectHistoryId,
          type: 'sharejs-text-ot',
        })
        await this.HttpController.getDoc(this.req, this.res, this.next)
      })

      it('should get the doc', function () {
        this.DocumentManager.promises.getDocAndRecentOpsWithLock.should.have.been.calledWith(
          this.project_id,
          this.doc_id,
          -1
        )
      })

      it('should return the doc as JSON', function () {
        this.res.json.should.have.been.calledWith({
          id: this.doc_id,
          lines: this.lines,
          version: this.version,
          ops: [],
          ranges: this.ranges,
          pathname: this.pathname,
          ttlInS: 42,
          type: 'sharejs-text-ot',
        })
      })

      it('should log the request', function () {
        this.logger.debug
          .calledWith(
            {
              docId: this.doc_id,
              projectId: this.project_id,
            },
            'getting doc via http'
          )
          .should.equal(true)
      })

      it('should time the request', function () {
        this.Metrics.Timer.prototype.done.called.should.equal(true)
      })
    })

    describe('when recent ops are requested', function () {
      beforeEach(async function () {
        this.DocumentManager.promises.getDocAndRecentOpsWithLock.resolves({
          lines: this.lines,
          version: this.version,
          ops: this.ops,
          ranges: this.ranges,
          pathname: this.pathname,
          projectHistoryId: this.projectHistoryId,
          type: 'sharejs-text-ot',
        })
        this.req.query = { fromVersion: `${this.fromVersion}` }
        await this.HttpController.getDoc(this.req, this.res, this.next)
      })

      it('should get the doc', function () {
        this.DocumentManager.promises.getDocAndRecentOpsWithLock.should.have.been.calledWith(
          this.project_id,
          this.doc_id,
          this.fromVersion
        )
      })

      it('should return the doc as JSON', function () {
        this.res.json.should.have.been.calledWith({
          id: this.doc_id,
          lines: this.lines,
          version: this.version,
          ops: this.ops,
          ranges: this.ranges,
          pathname: this.pathname,
          ttlInS: 42,
          type: 'sharejs-text-ot',
        })
      })

      it('should log the request', function () {
        this.logger.debug
          .calledWith(
            {
              docId: this.doc_id,
              projectId: this.project_id,
            },
            'getting doc via http'
          )
          .should.equal(true)
      })

      it('should time the request', function () {
        this.Metrics.Timer.prototype.done.called.should.equal(true)
      })
    })

    describe('when the document does not exist', function () {
      beforeEach(async function () {
        this.DocumentManager.promises.getDocAndRecentOpsWithLock.resolves({
          lines: null,
          version: null,
        })
        await this.HttpController.getDoc(this.req, this.res, this.next)
      })

      it('should call next with NotFoundError', function () {
        this.next
          .calledWith(sinon.match.instanceOf(Errors.NotFoundError))
          .should.equal(true)
      })
    })

    describe('when an errors occurs', function () {
      beforeEach(async function () {
        this.DocumentManager.promises.getDocAndRecentOpsWithLock.rejects(
          new Error('oops')
        )
        await this.HttpController.getDoc(this.req, this.res, this.next)
      })

      it('should call next with the error', function () {
        this.next.calledWith(sinon.match.instanceOf(Error)).should.equal(true)
      })
    })
  })

  describe('getComment', function () {
    beforeEach(function () {
      this.ranges = {
        changes: 'mock',
        comments: [
          {
            id: 'comment-id-1',
          },
          {
            id: 'comment-id-2',
          },
        ],
      }
      this.req = {
        params: {
          project_id: this.project_id,
          doc_id: this.doc_id,
          comment_id: this.comment_id,
        },
        query: {},
        body: {},
      }
    })

    beforeEach(async function () {
      this.DocumentManager.promises.getCommentWithLock.resolves(
        this.ranges.comments[0]
      )
      await this.HttpController.getComment(this.req, this.res, this.next)
    })

    it('should get the comment', function () {
      this.DocumentManager.promises.getCommentWithLock.should.have.been.calledWith(
        this.project_id,
        this.doc_id,
        this.comment_id
      )
    })

    it('should return the comment as JSON', function () {
      this.res.json
        .calledWith({
          id: 'comment-id-1',
        })
        .should.equal(true)
    })

    it('should log the request', function () {
      this.logger.debug
        .calledWith(
          {
            projectId: this.project_id,
            docId: this.doc_id,
            commentId: this.comment_id,
          },
          'getting comment via http'
        )
        .should.equal(true)
    })
  })

  describe('setDoc', function () {
    beforeEach(function () {
      this.lines = ['one', 'two', 'three']
      this.source = 'dropbox'
      this.user_id = 'dddddddddddddddddddddddd'
      this.req = {
        headers: {},
        params: {
          project_id: this.project_id,
          doc_id: this.doc_id,
        },
        query: {},
        body: {
          lines: this.lines,
          source: this.source,
          user_id: this.user_id,
          undoing: (this.undoing = true),
        },
      }
    })

    describe('successfully', function () {
      beforeEach(async function () {
        this.DocumentManager.promises.setDocWithLock.resolves({ rev: '123' })
        await this.HttpController.setDoc(this.req, this.res, this.next)
      })

      it('should set the doc', function () {
        this.DocumentManager.promises.setDocWithLock.should.have.been.calledWith(
          this.project_id,
          this.doc_id,
          this.lines,
          this.source,
          this.user_id,
          this.undoing,
          true
        )
      })

      it('should return a json response with the document rev from web', function () {
        this.res.json.calledWithMatch({ rev: '123' }).should.equal(true)
      })

      it('should log the request', function () {
        this.logger.debug
          .calledWith(
            {
              docId: this.doc_id,
              projectId: this.project_id,
              lines: this.lines,
              source: this.source,
              userId: this.user_id,
              undoing: this.undoing,
            },
            'setting doc via http'
          )
          .should.equal(true)
      })

      it('should time the request', function () {
        this.Metrics.Timer.prototype.done.called.should.equal(true)
      })
    })

    describe('when an errors occurs', function () {
      beforeEach(async function () {
        this.DocumentManager.promises.setDocWithLock.rejects(new Error('oops'))
        await this.HttpController.setDoc(this.req, this.res, this.next)
      })

      it('should call next with the error', function () {
        this.next.calledWith(sinon.match.instanceOf(Error)).should.equal(true)
      })
    })

    describe('when the payload is too large', function () {
      beforeEach(async function () {
        const lines = []
        for (let _ = 0; _ <= 200000; _++) {
          lines.push('test test test')
        }
        this.req.body.lines = lines
        this.DocumentManager.promises.setDocWithLock.resolves()
        await this.HttpController.setDoc(this.req, this.res, this.next)
      })

      it('should send back a 406 response', function () {
        this.res.sendStatus.calledWith(406).should.equal(true)
      })

      it('should not call setDocWithLock', function () {
        this.DocumentManager.promises.setDocWithLock.should.not.have.been.called
      })
    })
  })

  describe('flushProject', function () {
    beforeEach(function () {
      this.req = {
        params: {
          project_id: this.project_id,
        },
        query: {},
        body: {},
      }
    })

    describe('successfully', function () {
      beforeEach(async function () {
        await this.HttpController.flushProject(this.req, this.res, this.next)
      })

      it('should flush the project', function () {
        this.ProjectManager.promises.flushProjectWithLocks.should.have.been.calledWith(
          this.project_id
        )
      })

      it('should return a successful No Content response', function () {
        this.res.sendStatus.calledWith(204).should.equal(true)
      })

      it('should log the request', function () {
        this.logger.debug
          .calledWith(
            { projectId: this.project_id },
            'flushing project via http'
          )
          .should.equal(true)
      })

      it('should time the request', function () {
        this.Metrics.Timer.prototype.done.called.should.equal(true)
      })
    })

    describe('when an errors occurs', function () {
      beforeEach(async function () {
        this.ProjectManager.promises.flushProjectWithLocks.rejects(
          new Error('oops')
        )
        await this.HttpController.flushProject(this.req, this.res, this.next)
      })

      it('should call next with the error', function () {
        this.next.calledWith(sinon.match.instanceOf(Error)).should.equal(true)
      })
    })
  })

  describe('flushDocIfLoaded', function () {
    beforeEach(function () {
      this.lines = ['one', 'two', 'three']
      this.version = 42
      this.req = {
        params: {
          project_id: this.project_id,
          doc_id: this.doc_id,
        },
        query: {},
        body: {},
      }
    })

    describe('successfully', function () {
      beforeEach(async function () {
        await this.HttpController.flushDocIfLoaded(
          this.req,
          this.res,
          this.next
        )
      })

      it('should flush the doc', function () {
        this.DocumentManager.promises.flushDocIfLoadedWithLock.should.have.been.calledWith(
          this.project_id,
          this.doc_id
        )
      })

      it('should return a successful No Content response', function () {
        this.res.sendStatus.calledWith(204).should.equal(true)
      })

      it('should log the request', function () {
        this.logger.debug
          .calledWith(
            { docId: this.doc_id, projectId: this.project_id },
            'flushing doc via http'
          )
          .should.equal(true)
      })

      it('should time the request', function () {
        this.Metrics.Timer.prototype.done.called.should.equal(true)
      })
    })

    describe('when an errors occurs', function () {
      beforeEach(async function () {
        this.DocumentManager.promises.flushDocIfLoadedWithLock.rejects(
          new Error('oops')
        )
        await this.HttpController.flushDocIfLoaded(
          this.req,
          this.res,
          this.next
        )
      })

      it('should call next with the error', function () {
        this.next.calledWith(sinon.match.instanceOf(Error)).should.equal(true)
      })
    })
  })

  describe('deleteDoc', function () {
    beforeEach(function () {
      this.req = {
        params: {
          project_id: this.project_id,
          doc_id: this.doc_id,
        },
        query: {},
        body: {},
      }
    })

    describe('successfully', function () {
      beforeEach(async function () {
        await this.HttpController.deleteDoc(this.req, this.res, this.next)
      })

      it('should flush and delete the doc', function () {
        this.DocumentManager.promises.flushAndDeleteDocWithLock.should.have.been.calledWith(
          this.project_id,
          this.doc_id,
          { ignoreFlushErrors: false }
        )
      })

      it('should flush project history', function () {
        this.HistoryManager.flushProjectChangesAsync
          .calledWithExactly(this.project_id)
          .should.equal(true)
      })

      it('should return a successful No Content response', function () {
        this.res.sendStatus.calledWith(204).should.equal(true)
      })

      it('should log the request', function () {
        this.logger.debug
          .calledWith(
            { docId: this.doc_id, projectId: this.project_id },
            'deleting doc via http'
          )
          .should.equal(true)
      })

      it('should time the request', function () {
        this.Metrics.Timer.prototype.done.called.should.equal(true)
      })
    })

    describe('ignoring errors', function () {
      beforeEach(async function () {
        this.req.query.ignore_flush_errors = 'true'
        await this.HttpController.deleteDoc(this.req, this.res, this.next)
      })

      it('should delete the doc', function () {
        this.DocumentManager.promises.flushAndDeleteDocWithLock.should.have.been.calledWith(
          this.project_id,
          this.doc_id,
          { ignoreFlushErrors: true }
        )
      })

      it('should return a successful No Content response', function () {
        this.res.sendStatus.calledWith(204).should.equal(true)
      })
    })

    describe('when an errors occurs', function () {
      beforeEach(async function () {
        this.DocumentManager.promises.flushAndDeleteDocWithLock.rejects(
          new Error('oops')
        )
        await this.HttpController.deleteDoc(this.req, this.res, this.next)
      })

      it('should flush project history', function () {
        this.HistoryManager.flushProjectChangesAsync
          .calledWithExactly(this.project_id)
          .should.equal(true)
      })

      it('should call next with the error', function () {
        this.next.calledWith(sinon.match.instanceOf(Error)).should.equal(true)
      })
    })
  })

  describe('deleteProject', function () {
    beforeEach(function () {
      this.req = {
        params: {
          project_id: this.project_id,
        },
        query: {},
        body: {},
      }
    })

    describe('successfully', function () {
      beforeEach(async function () {
        await this.HttpController.deleteProject(this.req, this.res, this.next)
      })

      it('should delete the project', function () {
        this.ProjectManager.promises.flushAndDeleteProjectWithLocks.should.have.been.calledWith(
          this.project_id
        )
      })

      it('should return a successful No Content response', function () {
        this.res.sendStatus.calledWith(204).should.equal(true)
      })

      it('should log the request', function () {
        this.logger.debug
          .calledWith(
            { projectId: this.project_id },
            'deleting project via http'
          )
          .should.equal(true)
      })

      it('should time the request', function () {
        this.Metrics.Timer.prototype.done.called.should.equal(true)
      })
    })

    describe('with the background=true option from realtime', function () {
      beforeEach(async function () {
        this.req.query = { background: 'true', shutdown: 'true' }
        await this.HttpController.deleteProject(this.req, this.res, this.next)
      })

      it('should queue the flush and delete', function () {
        this.ProjectManager.promises.queueFlushAndDeleteProject.should.have.been.calledWith(
          this.project_id
        )
      })
    })

    describe('when an errors occurs', function () {
      beforeEach(async function () {
        this.ProjectManager.promises.flushAndDeleteProjectWithLocks.rejects(
          new Error('oops')
        )
        await this.HttpController.deleteProject(this.req, this.res, this.next)
      })

      it('should call next with the error', function () {
        this.next.calledWith(sinon.match.instanceOf(Error)).should.equal(true)
      })
    })
  })

  describe('acceptChanges', function () {
    beforeEach(function () {
      this.req = {
        params: {
          project_id: this.project_id,
          doc_id: this.doc_id,
          change_id: (this.change_id = 'ddddddddddddddddddddddd1'),
        },
        query: {},
        body: {},
      }
    })

    describe('successfully with a single change', function () {
      beforeEach(async function () {
        this.changeContributors = ['user-id-1', 'user-id-2']
        this.previews = [
          {
            sectionPath: [],
            startLine: 1,
            changes: [{ i: 'x', p: 0 }],
            slice: 'x',
            sliceStart: 0,
            userIds: ['user-id-1'],
          },
        ]
        this.DocumentManager.promises.acceptChangesWithLock.resolves({
          changeContributors: this.changeContributors,
          previews: this.previews,
        })
        await this.HttpController.acceptChanges(this.req, this.res, this.next)
      })

      it('should accept the change', function () {
        this.DocumentManager.promises.acceptChangesWithLock.should.have.been.calledWith(
          this.project_id,
          this.doc_id,
          [this.change_id]
        )
      })

      it('should return a successful 200 with the contributors and previews', function () {
        this.res.status.should.have.been.calledWith(200)
        this.res.json.should.have.been.calledWith({
          changeContributors: this.changeContributors,
          previews: this.previews,
        })
      })

      it('should log the request', function () {
        this.logger.debug
          .calledWith(
            { projectId: this.project_id, docId: this.doc_id },
            'accepting 1 changes via http'
          )
          .should.equal(true)
      })

      it('should time the request', function () {
        this.Metrics.Timer.prototype.done.called.should.equal(true)
      })
    })

    describe('succesfully with with multiple changes', function () {
      beforeEach(async function () {
        this.change_ids = [
          'ddddddddddddddddddddddd1',
          'ddddddddddddddddddddddd2',
          'ddddddddddddddddddddddd3',
          'ddddddddddddddddddddddd4',
        ]
        this.req.body = { change_ids: this.change_ids }
        this.DocumentManager.promises.acceptChangesWithLock.resolves({
          changeContributors: [],
          previews: [],
        })
        await this.HttpController.acceptChanges(this.req, this.res, this.next)
      })

      it('should accept the changes in the body payload', function () {
        this.DocumentManager.promises.acceptChangesWithLock.should.have.been.calledWith(
          this.project_id,
          this.doc_id,
          this.change_ids
        )
      })

      it('should log the request with the correct number of changes', function () {
        this.logger.debug
          .calledWith(
            { projectId: this.project_id, docId: this.doc_id },
            `accepting ${this.change_ids.length} changes via http`
          )
          .should.equal(true)
      })
    })

    describe('when an errors occurs', function () {
      beforeEach(async function () {
        this.DocumentManager.promises.acceptChangesWithLock.rejects(
          new Error('oops')
        )
        await this.HttpController.acceptChanges(this.req, this.res, this.next)
      })

      it('should call next with the error', function () {
        this.next.calledWith(sinon.match.instanceOf(Error)).should.equal(true)
      })
    })
  })

  describe('resolveComment', function () {
    beforeEach(function () {
      this.user_id = 'dddddddddddddddddddddddd'
      this.req = {
        params: {
          project_id: this.project_id,
          doc_id: this.doc_id,
          comment_id: (this.comment_id = 'cccccccccccccccccccccccc'),
        },
        query: {},
        body: {
          user_id: this.user_id,
        },
      }
      this.resolved = true
    })

    describe('successfully', function () {
      beforeEach(async function () {
        await this.HttpController.resolveComment(this.req, this.res, this.next)
      })

      it('should accept the change', function () {
        this.DocumentManager.promises.updateCommentStateWithLock.should.have.been.calledWith(
          this.project_id,
          this.doc_id,
          this.comment_id,
          this.user_id,
          this.resolved
        )
      })

      it('should return a successful No Content response', function () {
        this.res.sendStatus.calledWith(204).should.equal(true)
      })

      it('should log the request', function () {
        this.logger.debug
          .calledWith(
            {
              projectId: this.project_id,
              docId: this.doc_id,
              commentId: this.comment_id,
            },
            'resolving comment via http'
          )
          .should.equal(true)
      })
    })

    describe('when an errors occurs', function () {
      beforeEach(async function () {
        this.DocumentManager.promises.updateCommentStateWithLock.rejects(
          new Error('oops')
        )
        await this.HttpController.resolveComment(this.req, this.res, this.next)
      })

      it('should call next with the error', function () {
        this.next.calledWith(sinon.match.instanceOf(Error)).should.equal(true)
      })
    })
  })

  describe('reopenComment', function () {
    beforeEach(function () {
      this.user_id = 'dddddddddddddddddddddddd'
      this.req = {
        params: {
          project_id: this.project_id,
          doc_id: this.doc_id,
          comment_id: (this.comment_id = 'cccccccccccccccccccccccc'),
        },
        query: {},
        body: {
          user_id: this.user_id,
        },
      }
      this.resolved = false
    })

    describe('successfully', function () {
      beforeEach(async function () {
        await this.HttpController.reopenComment(this.req, this.res, this.next)
      })

      it('should accept the change', function () {
        this.DocumentManager.promises.updateCommentStateWithLock.should.have.been.calledWith(
          this.project_id,
          this.doc_id,
          this.comment_id,
          this.user_id,
          this.resolved
        )
      })

      it('should return a successful No Content response', function () {
        this.res.sendStatus.calledWith(204).should.equal(true)
      })

      it('should log the request', function () {
        this.logger.debug
          .calledWith(
            {
              projectId: this.project_id,
              docId: this.doc_id,
              commentId: this.comment_id,
            },
            'reopening comment via http'
          )
          .should.equal(true)
      })
    })

    describe('when an errors occurs', function () {
      beforeEach(async function () {
        this.DocumentManager.promises.updateCommentStateWithLock.rejects(
          new Error('oops')
        )
        await this.HttpController.reopenComment(this.req, this.res, this.next)
      })

      it('should call next with the error', function () {
        this.next.calledWith(sinon.match.instanceOf(Error)).should.equal(true)
      })
    })
  })

  describe('deleteComment', function () {
    beforeEach(function () {
      this.user_id = 'dddddddddddddddddddddddd'
      this.req = {
        params: {
          project_id: this.project_id,
          doc_id: this.doc_id,
          comment_id: (this.comment_id = 'cccccccccccccccccccccccc'),
        },
        query: {},
        body: {
          user_id: this.user_id,
        },
      }
    })

    describe('successfully', function () {
      beforeEach(async function () {
        await this.HttpController.deleteComment(this.req, this.res, this.next)
      })

      it('should accept the change', function () {
        this.DocumentManager.promises.deleteCommentWithLock.should.have.been.calledWith(
          this.project_id,
          this.doc_id,
          this.comment_id,
          this.user_id
        )
      })

      it('should return a successful No Content response', function () {
        this.res.sendStatus.calledWith(204).should.equal(true)
      })

      it('should log the request', function () {
        this.logger.debug
          .calledWith(
            {
              projectId: this.project_id,
              docId: this.doc_id,
              commentId: this.comment_id,
            },
            'deleting comment via http'
          )
          .should.equal(true)
      })

      it('should time the request', function () {
        this.Metrics.Timer.prototype.done.called.should.equal(true)
      })
    })

    describe('when an errors occurs', function () {
      beforeEach(async function () {
        this.DocumentManager.promises.deleteCommentWithLock.rejects(
          new Error('oops')
        )
        await this.HttpController.deleteComment(this.req, this.res, this.next)
      })

      it('should call next with the error', function () {
        this.next.calledWith(sinon.match.instanceOf(Error)).should.equal(true)
      })
    })
  })

  describe('getProjectDocsAndFlushIfOld', function () {
    beforeEach(function () {
      this.state = '01234567890abcdef'
      this.docs = [
        { _id: '1234', lines: 'hello', v: 23 },
        { _id: '4567', lines: 'world', v: 45 },
      ]
      this.req = {
        params: {
          project_id: this.project_id,
        },
        query: {
          state: this.state,
        },
        body: {},
      }
    })

    describe('successfully', function () {
      beforeEach(async function () {
        this.ProjectManager.promises.getProjectDocsAndFlushIfOld.resolves(
          this.docs
        )
        await this.HttpController.getProjectDocsAndFlushIfOld(
          this.req,
          this.res,
          this.next
        )
      })

      it('should get docs from the project manager', function () {
        this.ProjectManager.promises.getProjectDocsAndFlushIfOld.should.have.been.calledWith(
          this.project_id,
          this.state
        )
      })

      it('should return a successful response', function () {
        this.res.send.calledWith(this.docs).should.equal(true)
      })

      it('should log the request', function () {
        this.logger.debug
          .calledWith({ projectId: this.project_id }, 'getting docs via http')
          .should.equal(true)
      })

      it('should log the response', function () {
        this.logger.debug
          .calledWith(
            { projectId: this.project_id, result: ['1234:23', '4567:45'] },
            'got docs via http'
          )
          .should.equal(true)
      })

      it('should time the request', function () {
        this.Metrics.Timer.prototype.done.called.should.equal(true)
      })
    })

    describe('when there is a conflict', function () {
      beforeEach(async function () {
        this.ProjectManager.promises.getProjectDocsAndFlushIfOld.rejects(
          new Errors.ProjectStateChangedError('project state changed')
        )
        await this.HttpController.getProjectDocsAndFlushIfOld(
          this.req,
          this.res,
          this.next
        )
      })

      it('should return an HTTP 409 Conflict response', function () {
        this.res.sendStatus.calledWith(409).should.equal(true)
      })
    })

    describe('when an error occurs', function () {
      beforeEach(async function () {
        this.ProjectManager.promises.getProjectDocsAndFlushIfOld.rejects(
          new Error('oops')
        )
        await this.HttpController.getProjectDocsAndFlushIfOld(
          this.req,
          this.res,
          this.next
        )
      })

      it('should call next with the error', function () {
        this.next.calledWith(sinon.match.instanceOf(Error)).should.equal(true)
      })
    })
  })

  describe('updateProject', function () {
    beforeEach(function () {
      this.projectHistoryId = 'ffffffffffffffffffffffff'
      this.userId = 'dddddddddddddddddddddddd'
      this.updates = [
        {
          type: 'rename-doc',
          id: 'aaaaaaaaaaaaaaaaaaaaaaa1',
          pathname: 'thesis.tex',
          newPathname: 'book.tex',
        },
        {
          type: 'add-doc',
          id: 'aaaaaaaaaaaaaaaaaaaaaaa2',
          pathname: 'article.tex',
          docLines: 'hello',
        },
        {
          type: 'rename-file',
          id: 'aaaaaaaaaaaaaaaaaaaaaaa3',
          pathname: 'apple.png',
          newPathname: 'banana.png',
        },
        {
          type: 'add-file',
          id: 'aaaaaaaaaaaaaaaaaaaaaaa4',
          pathname: 'banana.png',
          url: 'filestore.example.com/4',
        },
      ]
      this.version = 1234567
      this.req = {
        query: {},
        body: {
          projectHistoryId: this.projectHistoryId,
          userId: this.userId,
          updates: this.updates,
          version: this.version,
          source: this.source,
        },
        params: {
          project_id: this.project_id,
        },
      }
    })

    describe('successfully', function () {
      beforeEach(async function () {
        await this.HttpController.updateProject(this.req, this.res, this.next)
      })

      it('should accept the change', function () {
        this.ProjectManager.promises.updateProjectWithLocks.should.have.been.calledWith(
          this.project_id,
          this.projectHistoryId,
          this.userId,
          this.updates,
          this.version,
          this.source
        )
      })

      it('should return a successful No Content response', function () {
        this.res.sendStatus.calledWith(204).should.equal(true)
      })

      it('should time the request', function () {
        this.Metrics.Timer.prototype.done.called.should.equal(true)
      })
    })

    describe('when an errors occurs', function () {
      beforeEach(async function () {
        this.ProjectManager.promises.updateProjectWithLocks.rejects(
          new Error('oops')
        )
        await this.HttpController.updateProject(this.req, this.res, this.next)
      })

      it('should call next with the error', function () {
        this.next.calledWith(sinon.match.instanceOf(Error)).should.equal(true)
      })
    })

    describe('when projectHistoryId is malformed', function () {
      beforeEach(async function () {
        this.req.body.projectHistoryId = '../../../../etc/passwd'
        await this.HttpController.updateProject(this.req, this.res, this.next)
      })

      it('should call next with the error', function () {
        this.next.calledWith(sinon.match.instanceOf(Error)).should.equal(true)
      })

      it('should not update the project', function () {
        this.ProjectManager.promises.updateProjectWithLocks.called.should.equal(
          false
        )
      })
    })

    describe('when an add-file update has linked-file metadata with a null group_id', function () {
      beforeEach(async function () {
        this.req.body.updates[3].metadata = {
          provider: 'zotero',
          format: 'bibtex',
          group_id: null,
          importer_id: this.userId,
          importedAt: '2024-01-01T00:00:00.000Z',
        }
        await this.HttpController.updateProject(this.req, this.res, this.next)
      })

      it('should accept the change', function () {
        this.ProjectManager.promises.updateProjectWithLocks.should.have.been.calledWith(
          this.project_id,
          this.projectHistoryId,
          this.userId,
          this.updates,
          this.version,
          this.source
        )
      })
    })

    describe('when an update has an unrecognized type', function () {
      beforeEach(async function () {
        this.req.body.updates[3].type = 'add-folder'
        await this.HttpController.updateProject(this.req, this.res, this.next)
      })

      it('should call next with the error', function () {
        this.next.calledWith(sinon.match.instanceOf(Error)).should.equal(true)
      })

      it('should not update the project', function () {
        this.ProjectManager.promises.updateProjectWithLocks.called.should.equal(
          false
        )
      })
    })

    describe('when an add-file update has a malformed hash', function () {
      beforeEach(async function () {
        this.req.body.updates[3].hash = 'not-a-valid-hash'
        await this.HttpController.updateProject(this.req, this.res, this.next)
      })

      it('should call next with the error', function () {
        this.next.calledWith(sinon.match.instanceOf(Error)).should.equal(true)
      })

      it('should not update the project', function () {
        this.ProjectManager.promises.updateProjectWithLocks.called.should.equal(
          false
        )
      })
    })
  })

  describe('resyncProjectHistory', function () {
    beforeEach(function () {
      this.projectHistoryId = 'ffffffffffffffffffffffff'
      this.docs = [{ doc: 'bbbbbbbbbbbbbbbbbbbbbbbb', path: 'main.tex' }]
      this.files = [
        {
          file: 'eeeeeeeeeeeeeeeeeeeeeeee',
          path: 'universe.png',
          _hash: 'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
          createdBlob: true,
        },
      ]
      this.req = {
        query: {},
        body: {
          projectHistoryId: this.projectHistoryId,
          docs: this.docs,
          files: this.files,
        },
        params: {
          project_id: this.project_id,
        },
      }
    })

    describe('successfully', function () {
      beforeEach(async function () {
        await this.HttpController.resyncProjectHistory(
          this.req,
          this.res,
          this.next
        )
      })

      it('should accept the change', function () {
        this.HistoryManager.promises.resyncProjectHistory.should.have.been.calledWith(
          this.project_id,
          this.projectHistoryId,
          this.docs,
          this.files,
          {}
        )
      })

      it('should return a successful No Content response', function () {
        this.res.sendStatus.should.have.been.calledWith(204)
      })
    })

    describe('when an errors occurs', function () {
      beforeEach(async function () {
        this.HistoryManager.promises.resyncProjectHistory.rejects(
          new Error('oops')
        )
        await this.HttpController.resyncProjectHistory(
          this.req,
          this.res,
          this.next
        )
      })

      it('should call next with the error', function () {
        this.next.calledWith(sinon.match.instanceOf(Error)).should.equal(true)
      })
    })

    describe('when projectHistoryId is malformed', function () {
      beforeEach(async function () {
        this.req.body.projectHistoryId = '../../../../etc/passwd'
        await this.HttpController.resyncProjectHistory(
          this.req,
          this.res,
          this.next
        )
      })

      it('should call next with the error', function () {
        this.next.calledWith(sinon.match.instanceOf(Error)).should.equal(true)
      })

      it('should not resync the project history', function () {
        this.HistoryManager.promises.resyncProjectHistory.called.should.equal(
          false
        )
      })
    })

    describe('when a file _hash is malformed', function () {
      beforeEach(async function () {
        this.req.body.files[0]._hash = 'not-a-valid-hash'
        await this.HttpController.resyncProjectHistory(
          this.req,
          this.res,
          this.next
        )
      })

      it('should call next with the error', function () {
        this.next.calledWith(sinon.match.instanceOf(Error)).should.equal(true)
      })

      it('should not resync the project history', function () {
        this.HistoryManager.promises.resyncProjectHistory.called.should.equal(
          false
        )
      })
    })
  })

  describe('appendToDoc', function () {
    beforeEach(function () {
      this.lines = ['one', 'two', 'three']
      this.source = 'dropbox'
      this.user_id = 'dddddddddddddddddddddddd'
      this.req = {
        headers: {},
        params: {
          project_id: this.project_id,
          doc_id: this.doc_id,
        },
        query: {},
        body: {
          lines: this.lines,
          source: this.source,
          user_id: this.user_id,
        },
      }
    })

    describe('successfully', function () {
      beforeEach(async function () {
        this.DocumentManager.promises.appendToDocWithLock.resolves({
          rev: '123',
        })
        await this.HttpController.appendToDoc(this.req, this.res, this.next)
      })

      it('should append to the doc', function () {
        this.DocumentManager.promises.appendToDocWithLock.should.have.been.calledWith(
          this.project_id,
          this.doc_id,
          this.lines,
          this.source,
          this.user_id
        )
      })

      it('should return a json response with the document rev from web', function () {
        this.res.json.calledWithMatch({ rev: '123' }).should.equal(true)
      })

      it('should log the request', function () {
        this.logger.debug
          .calledWith(
            {
              docId: this.doc_id,
              projectId: this.project_id,
              lines: this.lines,
              source: this.source,
              userId: this.user_id,
            },
            'appending to doc via http'
          )
          .should.equal(true)
      })

      it('should time the request', function () {
        this.Metrics.Timer.prototype.done.called.should.equal(true)
      })
    })

    describe('when an errors occurs', function () {
      beforeEach(async function () {
        this.DocumentManager.promises.appendToDocWithLock.rejects(
          new Error('oops')
        )
        await this.HttpController.appendToDoc(this.req, this.res, this.next)
      })

      it('should call next with the error', function () {
        this.next.calledWith(sinon.match.instanceOf(Error)).should.equal(true)
      })
    })

    describe('when the payload is too large', function () {
      beforeEach(async function () {
        this.DocumentManager.promises.appendToDocWithLock.rejects(
          new Errors.FileTooLargeError()
        )
        await this.HttpController.appendToDoc(this.req, this.res, this.next)
      })

      it('should send back a 422 response', function () {
        this.res.sendStatus.calledWith(422).should.equal(true)
      })
    })
  })
})
