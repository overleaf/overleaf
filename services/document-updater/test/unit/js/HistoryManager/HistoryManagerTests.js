/* eslint-disable
    mocha/no-nested-tests,
*/
const SandboxedModule = require('sandboxed-module')
const sinon = require('sinon')
const modulePath = require('node:path').join(
  __dirname,
  '../../../../app/js/HistoryManager'
)

describe('HistoryManager', function () {
  beforeEach(function () {
    this.HistoryManager = SandboxedModule.require(modulePath, {
      requires: {
        request: (this.request = {}),
        '@overleaf/settings': (this.Settings = {
          apis: {
            project_history: {
              url: 'http://project_history.example.com',
            },
          },
        }),
        './DocumentManager': (this.DocumentManager = {}),
        './RedisManager': (this.RedisManager = {}),
        './ProjectHistoryRedisManager': (this.ProjectHistoryRedisManager = {}),
        './Metrics': (this.metrics = { inc: sinon.stub() }),
      },
    })
    this.project_id = 'mock-project-id'
    this.callback = sinon.stub()
  })

  describe('flushProjectChangesAsync', function () {
    beforeEach(function () {
      this.request.post = sinon
        .stub()
        .callsArgWith(1, null, { statusCode: 204 })

      this.HistoryManager.flushProjectChangesAsync(this.project_id)
    })

    it('should send a request to the project history api', function () {
      this.request.post
        .calledWith({
          url: `${this.Settings.apis.project_history.url}/project/${this.project_id}/flush`,
          qs: { background: true },
        })
        .should.equal(true)
    })
  })

  describe('flushProjectChanges', function () {
    describe('in the normal case', function () {
      beforeEach(function (done) {
        this.request.post = sinon
          .stub()
          .callsArgWith(1, null, { statusCode: 204 })
        this.HistoryManager.flushProjectChanges(
          this.project_id,
          {
            background: true,
          },
          done
        )
      })

      it('should send a request to the project history api', function () {
        this.request.post
          .calledWith({
            url: `${this.Settings.apis.project_history.url}/project/${this.project_id}/flush`,
            qs: { background: true },
          })
          .should.equal(true)
      })
    })

    describe('with the skip_history_flush option', function () {
      beforeEach(function (done) {
        this.request.post = sinon.stub()
        this.HistoryManager.flushProjectChanges(
          this.project_id,
          {
            skip_history_flush: true,
          },
          done
        )
      })

      it('should not send a request to the project history api', function () {
        this.request.post.called.should.equal(false)
      })
    })
  })

  describe('recordAndFlushHistoryOps', function () {
    beforeEach(function () {
      this.ops = ['mock-ops']
      this.project_ops_length = 10

      this.HistoryManager.flushProjectChangesAsync = sinon.stub()
    })

    describe('with no ops', function () {
      beforeEach(function () {
        this.HistoryManager.recordAndFlushHistoryOps(
          this.project_id,
          [],
          this.project_ops_length
        )
      })

      it('should not flush project changes', function () {
        this.HistoryManager.flushProjectChangesAsync.called.should.equal(false)
      })
    })

    describe('with enough ops to flush project changes', function () {
      beforeEach(function () {
        this.HistoryManager.shouldFlushHistoryOps = sinon.stub()
        this.HistoryManager.shouldFlushHistoryOps
          .withArgs(this.project_ops_length)
          .returns(true)

        this.HistoryManager.recordAndFlushHistoryOps(
          this.project_id,
          this.ops,
          this.project_ops_length
        )
      })

      it('should flush project changes', function () {
        this.HistoryManager.flushProjectChangesAsync
          .calledWith(this.project_id)
          .should.equal(true)
      })
    })

    describe('with enough ops to flush doc changes', function () {
      beforeEach(function () {
        this.HistoryManager.shouldFlushHistoryOps = sinon.stub()
        this.HistoryManager.shouldFlushHistoryOps
          .withArgs(this.project_ops_length)
          .returns(false)

        this.HistoryManager.recordAndFlushHistoryOps(
          this.project_id,
          this.ops,
          this.project_ops_length
        )
      })

      it('should not flush project changes', function () {
        this.HistoryManager.flushProjectChangesAsync.called.should.equal(false)
      })
    })

    describe('shouldFlushHistoryOps', function () {
      it('should return false if the number of ops is not known', function () {
        this.HistoryManager.shouldFlushHistoryOps(
          null,
          ['a', 'b', 'c'].length,
          1
        ).should.equal(false)
      })

      it("should return false if the updates didn't take us past the threshold", function () {
        // Currently there are 14 ops
        // Previously we were on 11 ops
        // We didn't pass over a multiple of 5
        this.HistoryManager.shouldFlushHistoryOps(
          14,
          ['a', 'b', 'c'].length,
          5
        ).should.equal(false)

        it('should return true if the updates took to the threshold', function () {})
        // Currently there are 15 ops
        // Previously we were on 12 ops
        // We've reached a new multiple of 5
        this.HistoryManager.shouldFlushHistoryOps(
          15,
          ['a', 'b', 'c'].length,
          5
        ).should.equal(true)
      })

      it('should return true if the updates took past the threshold', function () {
        // Currently there are 19 ops
        // Previously we were on 16 ops
        // We didn't pass over a multiple of 5
        this.HistoryManager.shouldFlushHistoryOps(
          17,
          ['a', 'b', 'c'].length,
          5
        ).should.equal(true)
      })
    })
  })

  describe('resyncProjectHistory', function () {
    beforeEach(function () {
      this.projectHistoryId = 'history-id-1234'
      this.docs = [
        {
          doc: this.doc_id,
          path: 'main.tex',
        },
      ]
      this.files = [
        {
          file: 'mock-file-id',
          path: 'universe.png',
          url: `www.filestore.test/${this.project_id}/mock-file-id`,
        },
      ]
      this.ProjectHistoryRedisManager.queueResyncProjectStructure = sinon
        .stub()
        .yields()
      this.DocumentManager.resyncDocContentsWithLock = sinon.stub().yields()
    })

    describe('full sync', function () {
      beforeEach(function () {
        this.HistoryManager.resyncProjectHistory(
          this.project_id,
          this.projectHistoryId,
          this.docs,
          this.files,
          {},
          this.callback
        )
      })

      it('should queue a project structure reync', function () {
        this.ProjectHistoryRedisManager.queueResyncProjectStructure
          .calledWith(
            this.project_id,
            this.projectHistoryId,
            this.docs,
            this.files
          )
          .should.equal(true)
      })

      it('should queue doc content reyncs', function () {
        this.DocumentManager.resyncDocContentsWithLock
          .calledWith(this.project_id, this.docs[0].doc, this.docs[0].path)
          .should.equal(true)
      })

      it('should call the callback', function () {
        this.callback.called.should.equal(true)
      })
    })

    describe('resyncProjectStructureOnly=true', function () {
      beforeEach(function () {
        this.HistoryManager.resyncProjectHistory(
          this.project_id,
          this.projectHistoryId,
          this.docs,
          this.files,
          { resyncProjectStructureOnly: true },
          this.callback
        )
      })

      it('should queue a project structure reync', function () {
        this.ProjectHistoryRedisManager.queueResyncProjectStructure
          .calledWith(
            this.project_id,
            this.projectHistoryId,
            this.docs,
            this.files,
            { resyncProjectStructureOnly: true }
          )
          .should.equal(true)
      })

      it('should not queue doc content reyncs', function () {
        this.DocumentManager.resyncDocContentsWithLock.called.should.equal(
          false
        )
      })

      it('should call the callback', function () {
        this.callback.called.should.equal(true)
      })
    })
  })
})
