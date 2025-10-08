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
        '@overleaf/fetch-utils': (this.fetchUtils = {
          fetchNothing: sinon.stub().resolves(),
        }),
        '@overleaf/settings': (this.Settings = {
          shortHistoryQueues: [],
          apis: {
            project_history: {
              url: 'http://project_history.example.com',
            },
          },
        }),
        './DocumentManager': (this.DocumentManager = {
          promises: {
            resyncDocContentsWithLock: sinon.stub().resolves(),
          },
        }),
        './RedisManager': (this.RedisManager = {}),
        './ProjectHistoryRedisManager': (this.ProjectHistoryRedisManager = {
          promises: {
            queueResyncProjectStructure: sinon.stub().resolves(),
          },
        }),
        './Metrics': (this.metrics = { inc: sinon.stub() }),
      },
    })
    this.project_id = 'mock-project-id'
  })

  describe('flushProjectChangesAsync', function () {
    beforeEach(function () {
      this.HistoryManager.flushProjectChangesAsync(this.project_id)
    })

    it('should send a request to the project history api', function () {
      this.fetchUtils.fetchNothing.should.have.been.calledWith(
        new URL(
          `${this.Settings.apis.project_history.url}/project/${this.project_id}/flush?background=true`
        )
      )
    })
  })

  describe('flushProjectChanges', function () {
    describe('in the normal case', function () {
      beforeEach(async function () {
        await this.HistoryManager.promises.flushProjectChanges(
          this.project_id,
          {
            background: true,
          }
        )
      })

      it('should send a request to the project history api', function () {
        this.fetchUtils.fetchNothing.should.have.been.calledWith(
          new URL(
            `${this.Settings.apis.project_history.url}/project/${this.project_id}/flush?background=true`
          )
        )
      })
    })

    describe('with the skip_history_flush option', function () {
      beforeEach(async function () {
        await this.HistoryManager.promises.flushProjectChanges(
          this.project_id,
          {
            skip_history_flush: true,
          }
        )
      })

      it('should not send a request to the project history api', function () {
        this.fetchUtils.fetchNothing.should.not.have.been.called
      })
    })
  })

  describe('recordAndFlushHistoryOps', function () {
    beforeEach(function () {
      this.ops = ['mock-ops']
      this.project_ops_length = 500

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
        this.fetchUtils.fetchNothing.should.not.have.been.called
      })
    })

    describe('with enough ops to flush project changes', function () {
      beforeEach(function () {
        this.HistoryManager.recordAndFlushHistoryOps(
          this.project_id,
          this.ops,
          this.project_ops_length
        )
      })

      it('should flush project changes', function () {
        this.fetchUtils.fetchNothing.should.have.been.calledWith(
          new URL(
            `${this.Settings.apis.project_history.url}/project/${this.project_id}/flush?background=true`
          )
        )
      })
    })

    describe('shouldFlushHistoryOps', function () {
      it('should return false if the number of ops is not known', function () {
        this.HistoryManager.shouldFlushHistoryOps(
          this.project_id,
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
          this.project_id,
          14,
          ['a', 'b', 'c'].length,
          5
        ).should.equal(false)

        it('should return true if the updates took to the threshold', function () {})
        // Currently there are 15 ops
        // Previously we were on 12 ops
        // We've reached a new multiple of 5
        this.HistoryManager.shouldFlushHistoryOps(
          this.project_id,
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
          this.project_id,
          17,
          ['a', 'b', 'c'].length,
          5
        ).should.equal(true)
      })

      it('should return true if the project has a short queue', function () {
        this.Settings.shortHistoryQueues = [this.project_id]
        this.HistoryManager.shouldFlushHistoryOps(
          this.project_id,
          14,
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
    })

    describe('full sync', function () {
      beforeEach(async function () {
        await this.HistoryManager.promises.resyncProjectHistory(
          this.project_id,
          this.projectHistoryId,
          this.docs,
          this.files,
          {}
        )
      })

      it('should queue a project structure reync', function () {
        this.ProjectHistoryRedisManager.promises.queueResyncProjectStructure.should.have.been.calledWith(
          this.project_id,
          this.projectHistoryId,
          this.docs,
          this.files
        )
      })

      it('should queue doc content reyncs', function () {
        this.DocumentManager.promises.resyncDocContentsWithLock.should.have.been.calledWith(
          this.project_id,
          this.docs[0].doc,
          this.docs[0].path
        )
      })
    })

    describe('resyncProjectStructureOnly=true', function () {
      beforeEach(async function () {
        await this.HistoryManager.promises.resyncProjectHistory(
          this.project_id,
          this.projectHistoryId,
          this.docs,
          this.files,
          { resyncProjectStructureOnly: true }
        )
      })

      it('should queue a project structure reync', function () {
        this.ProjectHistoryRedisManager.promises.queueResyncProjectStructure.should.have.been.calledWith(
          this.project_id,
          this.projectHistoryId,
          this.docs,
          this.files,
          { resyncProjectStructureOnly: true }
        )
      })

      it('should not queue doc content reyncs', function () {
        this.DocumentManager.promises.resyncDocContentsWithLock.should.not.have
          .been.called
      })
    })
  })
})
