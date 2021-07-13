const sinon = require('sinon')
const modulePath = '../../../../app/js/HttpController.js'
const SandboxedModule = require('sandboxed-module')
const Errors = require('../../../../app/js/Errors.js')

describe('HttpController', function () {
  beforeEach(function () {
    this.HttpController = SandboxedModule.require(modulePath, {
      requires: {
        './DocumentManager': (this.DocumentManager = {}),
        './HistoryManager': (this.HistoryManager = {
          flushProjectChangesAsync: sinon.stub(),
        }),
        './ProjectManager': (this.ProjectManager = {}),
        './ProjectFlusher': { flushAllProjects() {} },
        './DeleteQueueManager': (this.DeleteQueueManager = {}),
        './Metrics': (this.Metrics = {}),
        './Errors': Errors,
      },
    })
    this.Metrics.Timer = class Timer {}
    this.Metrics.Timer.prototype.done = sinon.stub()

    this.project_id = 'project-id-123'
    this.doc_id = 'doc-id-123'
    this.next = sinon.stub()
    this.res = {
      send: sinon.stub(),
      sendStatus: sinon.stub(),
      json: sinon.stub(),
    }
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
      beforeEach(function () {
        this.DocumentManager.getDocAndRecentOpsWithLock = sinon
          .stub()
          .callsArgWith(
            3,
            null,
            this.lines,
            this.version,
            [],
            this.ranges,
            this.pathname
          )
        this.HttpController.getDoc(this.req, this.res, this.next)
      })

      it('should get the doc', function () {
        this.DocumentManager.getDocAndRecentOpsWithLock
          .calledWith(this.project_id, this.doc_id, -1)
          .should.equal(true)
      })

      it('should return the doc as JSON', function () {
        this.res.json
          .calledWith({
            id: this.doc_id,
            lines: this.lines,
            version: this.version,
            ops: [],
            ranges: this.ranges,
            pathname: this.pathname,
          })
          .should.equal(true)
      })

      it('should log the request', function () {
        this.logger.log
          .calledWith(
            { docId: this.doc_id, projectId: this.project_id },
            'getting doc via http'
          )
          .should.equal(true)
      })

      it('should time the request', function () {
        this.Metrics.Timer.prototype.done.called.should.equal(true)
      })
    })

    describe('when recent ops are requested', function () {
      beforeEach(function () {
        this.DocumentManager.getDocAndRecentOpsWithLock = sinon
          .stub()
          .callsArgWith(
            3,
            null,
            this.lines,
            this.version,
            this.ops,
            this.ranges,
            this.pathname
          )
        this.req.query = { fromVersion: `${this.fromVersion}` }
        this.HttpController.getDoc(this.req, this.res, this.next)
      })

      it('should get the doc', function () {
        this.DocumentManager.getDocAndRecentOpsWithLock
          .calledWith(this.project_id, this.doc_id, this.fromVersion)
          .should.equal(true)
      })

      it('should return the doc as JSON', function () {
        this.res.json
          .calledWith({
            id: this.doc_id,
            lines: this.lines,
            version: this.version,
            ops: this.ops,
            ranges: this.ranges,
            pathname: this.pathname,
          })
          .should.equal(true)
      })

      it('should log the request', function () {
        this.logger.log
          .calledWith(
            { docId: this.doc_id, projectId: this.project_id },
            'getting doc via http'
          )
          .should.equal(true)
      })

      it('should time the request', function () {
        this.Metrics.Timer.prototype.done.called.should.equal(true)
      })
    })

    describe('when the document does not exist', function () {
      beforeEach(function () {
        this.DocumentManager.getDocAndRecentOpsWithLock = sinon
          .stub()
          .callsArgWith(3, null, null, null)
        this.HttpController.getDoc(this.req, this.res, this.next)
      })

      it('should call next with NotFoundError', function () {
        this.next
          .calledWith(sinon.match.instanceOf(Errors.NotFoundError))
          .should.equal(true)
      })
    })

    describe('when an errors occurs', function () {
      beforeEach(function () {
        this.DocumentManager.getDocAndRecentOpsWithLock = sinon
          .stub()
          .callsArgWith(3, new Error('oops'), null, null)
        this.HttpController.getDoc(this.req, this.res, this.next)
      })

      it('should call next with the error', function () {
        this.next.calledWith(sinon.match.instanceOf(Error)).should.equal(true)
      })
    })
  })

  describe('setDoc', function () {
    beforeEach(function () {
      this.lines = ['one', 'two', 'three']
      this.source = 'dropbox'
      this.user_id = 'user-id-123'
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
      beforeEach(function () {
        this.DocumentManager.setDocWithLock = sinon.stub().callsArgWith(6)
        this.HttpController.setDoc(this.req, this.res, this.next)
      })

      it('should set the doc', function () {
        this.DocumentManager.setDocWithLock
          .calledWith(
            this.project_id,
            this.doc_id,
            this.lines,
            this.source,
            this.user_id,
            this.undoing
          )
          .should.equal(true)
      })

      it('should return a successful No Content response', function () {
        this.res.sendStatus.calledWith(204).should.equal(true)
      })

      it('should log the request', function () {
        this.logger.log
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
      beforeEach(function () {
        this.DocumentManager.setDocWithLock = sinon
          .stub()
          .callsArgWith(6, new Error('oops'))
        this.HttpController.setDoc(this.req, this.res, this.next)
      })

      it('should call next with the error', function () {
        this.next.calledWith(sinon.match.instanceOf(Error)).should.equal(true)
      })
    })

    describe('when the payload is too large', function () {
      beforeEach(function () {
        const lines = []
        for (let _ = 0; _ <= 200000; _++) {
          lines.push('test test test')
        }
        this.req.body.lines = lines
        this.DocumentManager.setDocWithLock = sinon.stub().callsArgWith(6)
        this.HttpController.setDoc(this.req, this.res, this.next)
      })

      it('should send back a 406 response', function () {
        this.res.sendStatus.calledWith(406).should.equal(true)
      })

      it('should not call setDocWithLock', function () {
        this.DocumentManager.setDocWithLock.callCount.should.equal(0)
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
      beforeEach(function () {
        this.ProjectManager.flushProjectWithLocks = sinon.stub().callsArgWith(1)
        this.HttpController.flushProject(this.req, this.res, this.next)
      })

      it('should flush the project', function () {
        this.ProjectManager.flushProjectWithLocks
          .calledWith(this.project_id)
          .should.equal(true)
      })

      it('should return a successful No Content response', function () {
        this.res.sendStatus.calledWith(204).should.equal(true)
      })

      it('should log the request', function () {
        this.logger.log
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
      beforeEach(function () {
        this.ProjectManager.flushProjectWithLocks = sinon
          .stub()
          .callsArgWith(1, new Error('oops'))
        this.HttpController.flushProject(this.req, this.res, this.next)
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
      beforeEach(function () {
        this.DocumentManager.flushDocIfLoadedWithLock = sinon
          .stub()
          .callsArgWith(2)
        this.HttpController.flushDocIfLoaded(this.req, this.res, this.next)
      })

      it('should flush the doc', function () {
        this.DocumentManager.flushDocIfLoadedWithLock
          .calledWith(this.project_id, this.doc_id)
          .should.equal(true)
      })

      it('should return a successful No Content response', function () {
        this.res.sendStatus.calledWith(204).should.equal(true)
      })

      it('should log the request', function () {
        this.logger.log
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
      beforeEach(function () {
        this.DocumentManager.flushDocIfLoadedWithLock = sinon
          .stub()
          .callsArgWith(2, new Error('oops'))
        this.HttpController.flushDocIfLoaded(this.req, this.res, this.next)
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
      beforeEach(function () {
        this.DocumentManager.flushAndDeleteDocWithLock = sinon
          .stub()
          .callsArgWith(3)
        this.HttpController.deleteDoc(this.req, this.res, this.next)
      })

      it('should flush and delete the doc', function () {
        this.DocumentManager.flushAndDeleteDocWithLock
          .calledWith(this.project_id, this.doc_id, {
            ignoreFlushErrors: false,
          })
          .should.equal(true)
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
        this.logger.log
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
      beforeEach(function () {
        this.req.query.ignore_flush_errors = 'true'
        this.DocumentManager.flushAndDeleteDocWithLock = sinon.stub().yields()
        this.HttpController.deleteDoc(this.req, this.res, this.next)
      })

      it('should delete the doc', function () {
        this.DocumentManager.flushAndDeleteDocWithLock
          .calledWith(this.project_id, this.doc_id, { ignoreFlushErrors: true })
          .should.equal(true)
      })

      it('should return a successful No Content response', function () {
        this.res.sendStatus.calledWith(204).should.equal(true)
      })
    })

    describe('when an errors occurs', function () {
      beforeEach(function () {
        this.DocumentManager.flushAndDeleteDocWithLock = sinon
          .stub()
          .callsArgWith(3, new Error('oops'))
        this.HttpController.deleteDoc(this.req, this.res, this.next)
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
      beforeEach(function () {
        this.ProjectManager.flushAndDeleteProjectWithLocks = sinon
          .stub()
          .callsArgWith(2)
        this.HttpController.deleteProject(this.req, this.res, this.next)
      })

      it('should delete the project', function () {
        this.ProjectManager.flushAndDeleteProjectWithLocks
          .calledWith(this.project_id)
          .should.equal(true)
      })

      it('should return a successful No Content response', function () {
        this.res.sendStatus.calledWith(204).should.equal(true)
      })

      it('should log the request', function () {
        this.logger.log
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
      beforeEach(function () {
        this.ProjectManager.queueFlushAndDeleteProject = sinon
          .stub()
          .callsArgWith(1)
        this.req.query = { background: true, shutdown: true }
        this.HttpController.deleteProject(this.req, this.res, this.next)
      })

      it('should queue the flush and delete', function () {
        this.ProjectManager.queueFlushAndDeleteProject
          .calledWith(this.project_id)
          .should.equal(true)
      })
    })

    describe('when an errors occurs', function () {
      beforeEach(function () {
        this.ProjectManager.flushAndDeleteProjectWithLocks = sinon
          .stub()
          .callsArgWith(2, new Error('oops'))
        this.HttpController.deleteProject(this.req, this.res, this.next)
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
          change_id: (this.change_id = 'mock-change-od-1'),
        },
        query: {},
        body: {},
      }
    })

    describe('successfully with a single change', function () {
      beforeEach(function () {
        this.DocumentManager.acceptChangesWithLock = sinon
          .stub()
          .callsArgWith(3)
        this.HttpController.acceptChanges(this.req, this.res, this.next)
      })

      it('should accept the change', function () {
        this.DocumentManager.acceptChangesWithLock
          .calledWith(this.project_id, this.doc_id, [this.change_id])
          .should.equal(true)
      })

      it('should return a successful No Content response', function () {
        this.res.sendStatus.calledWith(204).should.equal(true)
      })

      it('should log the request', function () {
        this.logger.log
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
      beforeEach(function () {
        this.change_ids = [
          'mock-change-od-1',
          'mock-change-od-2',
          'mock-change-od-3',
          'mock-change-od-4',
        ]
        this.req.body = { change_ids: this.change_ids }
        this.DocumentManager.acceptChangesWithLock = sinon
          .stub()
          .callsArgWith(3)
        this.HttpController.acceptChanges(this.req, this.res, this.next)
      })

      it('should accept the changes in the body payload', function () {
        this.DocumentManager.acceptChangesWithLock
          .calledWith(this.project_id, this.doc_id, this.change_ids)
          .should.equal(true)
      })

      it('should log the request with the correct number of changes', function () {
        this.logger.log
          .calledWith(
            { projectId: this.project_id, docId: this.doc_id },
            `accepting ${this.change_ids.length} changes via http`
          )
          .should.equal(true)
      })
    })

    describe('when an errors occurs', function () {
      beforeEach(function () {
        this.DocumentManager.acceptChangesWithLock = sinon
          .stub()
          .callsArgWith(3, new Error('oops'))
        this.HttpController.acceptChanges(this.req, this.res, this.next)
      })

      it('should call next with the error', function () {
        this.next.calledWith(sinon.match.instanceOf(Error)).should.equal(true)
      })
    })
  })

  describe('deleteComment', function () {
    beforeEach(function () {
      this.req = {
        params: {
          project_id: this.project_id,
          doc_id: this.doc_id,
          comment_id: (this.comment_id = 'mock-comment-id'),
        },
        query: {},
        body: {},
      }
    })

    describe('successfully', function () {
      beforeEach(function () {
        this.DocumentManager.deleteCommentWithLock = sinon
          .stub()
          .callsArgWith(3)
        this.HttpController.deleteComment(this.req, this.res, this.next)
      })

      it('should accept the change', function () {
        this.DocumentManager.deleteCommentWithLock
          .calledWith(this.project_id, this.doc_id, this.comment_id)
          .should.equal(true)
      })

      it('should return a successful No Content response', function () {
        this.res.sendStatus.calledWith(204).should.equal(true)
      })

      it('should log the request', function () {
        this.logger.log
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
      beforeEach(function () {
        this.DocumentManager.deleteCommentWithLock = sinon
          .stub()
          .callsArgWith(3, new Error('oops'))
        this.HttpController.deleteComment(this.req, this.res, this.next)
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
      beforeEach(function () {
        this.ProjectManager.getProjectDocsAndFlushIfOld = sinon
          .stub()
          .callsArgWith(3, null, this.docs)
        this.HttpController.getProjectDocsAndFlushIfOld(
          this.req,
          this.res,
          this.next
        )
      })

      it('should get docs from the project manager', function () {
        this.ProjectManager.getProjectDocsAndFlushIfOld
          .calledWith(this.project_id, this.state, {})
          .should.equal(true)
      })

      it('should return a successful response', function () {
        this.res.send.calledWith(this.docs).should.equal(true)
      })

      it('should log the request', function () {
        this.logger.log
          .calledWith(
            { projectId: this.project_id, exclude: [] },
            'getting docs via http'
          )
          .should.equal(true)
      })

      it('should log the response', function () {
        this.logger.log
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
      beforeEach(function () {
        this.ProjectManager.getProjectDocsAndFlushIfOld = sinon
          .stub()
          .callsArgWith(
            3,
            new Errors.ProjectStateChangedError('project state changed')
          )
        this.HttpController.getProjectDocsAndFlushIfOld(
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
      beforeEach(function () {
        this.ProjectManager.getProjectDocsAndFlushIfOld = sinon
          .stub()
          .callsArgWith(3, new Error('oops'))
        this.HttpController.getProjectDocsAndFlushIfOld(
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
      this.projectHistoryId = 'history-id-123'
      this.userId = 'user-id-123'
      this.updates = [
        {
          type: 'rename-doc',
          id: 1,
          pathname: 'thesis.tex',
          newPathname: 'book.tex',
        },
        { type: 'add-doc', id: 2, pathname: 'article.tex', docLines: 'hello' },
        {
          type: 'rename-file',
          id: 3,
          pathname: 'apple.png',
          newPathname: 'banana.png',
        },
        { type: 'add-file', id: 4, url: 'filestore.example.com/4' },
      ]
      this.version = 1234567
      this.req = {
        query: {},
        body: {
          projectHistoryId: this.projectHistoryId,
          userId: this.userId,
          updates: this.updates,
          version: this.version,
        },
        params: {
          project_id: this.project_id,
        },
      }
    })

    describe('successfully', function () {
      beforeEach(function () {
        this.ProjectManager.updateProjectWithLocks = sinon.stub().yields()
        this.HttpController.updateProject(this.req, this.res, this.next)
      })

      it('should accept the change', function () {
        this.ProjectManager.updateProjectWithLocks
          .calledWith(
            this.project_id,
            this.projectHistoryId,
            this.userId,
            this.updates,
            this.version
          )
          .should.equal(true)
      })

      it('should return a successful No Content response', function () {
        this.res.sendStatus.calledWith(204).should.equal(true)
      })

      it('should time the request', function () {
        this.Metrics.Timer.prototype.done.called.should.equal(true)
      })
    })

    describe('when an errors occurs', function () {
      beforeEach(function () {
        this.ProjectManager.updateProjectWithLocks = sinon
          .stub()
          .yields(new Error('oops'))
        this.HttpController.updateProject(this.req, this.res, this.next)
      })

      it('should call next with the error', function () {
        this.next.calledWith(sinon.match.instanceOf(Error)).should.equal(true)
      })
    })
  })

  describe('resyncProjectHistory', function () {
    beforeEach(function () {
      this.projectHistoryId = 'history-id-123'
      this.docs = sinon.stub()
      this.files = sinon.stub()
      this.fileUpdates = sinon.stub()
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
      beforeEach(function () {
        this.HistoryManager.resyncProjectHistory = sinon.stub().callsArgWith(4)
        this.HttpController.resyncProjectHistory(this.req, this.res, this.next)
      })

      it('should accept the change', function () {
        this.HistoryManager.resyncProjectHistory
          .calledWith(
            this.project_id,
            this.projectHistoryId,
            this.docs,
            this.files
          )
          .should.equal(true)
      })

      it('should return a successful No Content response', function () {
        this.res.sendStatus.calledWith(204).should.equal(true)
      })
    })

    describe('when an errors occurs', function () {
      beforeEach(function () {
        this.HistoryManager.resyncProjectHistory = sinon
          .stub()
          .callsArgWith(4, new Error('oops'))
        this.HttpController.resyncProjectHistory(this.req, this.res, this.next)
      })

      it('should call next with the error', function () {
        this.next.calledWith(sinon.match.instanceOf(Error)).should.equal(true)
      })
    })
  })
})
