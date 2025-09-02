const { expect } = require('chai')
const sinon = require('sinon')
const SandboxedModule = require('sandboxed-module')

const MODULE_PATH = '../../../../app/js/ProjectManager.js'

describe('ProjectManager - flushProject', function () {
  beforeEach(function () {
    this.project_id = 'project-id-123'

    this.RedisManager = {
      promises: {
        getDocIdsInProject: sinon.stub(),
      },
    }

    this.ProjectHistoryRedisManager = {}

    this.Metrics = {
      Timer: class Timer {},
    }

    this.DocumentManager = {
      promises: {
        flushDocIfLoadedWithLock: sinon.stub().resolves(),
      },
    }

    this.HistoryManager = {}

    this.Metrics.Timer.prototype.done = sinon.stub()

    this.ProjectManager = SandboxedModule.require(MODULE_PATH, {
      requires: {
        './RedisManager': this.RedisManager,
        './ProjectHistoryRedisManager': this.ProjectHistoryRedisManager,
        './DocumentManager': this.DocumentManager,
        './HistoryManager': this.HistoryManager,
        './Metrics': this.Metrics,
      },
    })
  })

  describe('successfully', function () {
    beforeEach(async function () {
      this.doc_ids = ['doc-id-1', 'doc-id-2', 'doc-id-3']
      this.RedisManager.promises.getDocIdsInProject.resolves(this.doc_ids)
      await this.ProjectManager.promises.flushProjectWithLocks(this.project_id)
    })

    it('should get the doc ids in the project', function () {
      this.RedisManager.promises.getDocIdsInProject.should.have.been.calledWith(
        this.project_id
      )
    })

    it('should flush each doc in the project', function () {
      for (const docId of this.doc_ids) {
        this.DocumentManager.promises.flushDocIfLoadedWithLock.should.have.been.calledWith(
          this.project_id,
          docId
        )
      }
    })

    it('should time the execution', function () {
      this.Metrics.Timer.prototype.done.called.should.equal(true)
    })
  })

  describe('when a doc errors', function () {
    beforeEach(async function () {
      this.doc_ids = ['doc-id-1', 'doc-id-2', 'doc-id-3']
      this.RedisManager.promises.getDocIdsInProject.resolves(this.doc_ids)
      this.DocumentManager.promises.flushDocIfLoadedWithLock.callsFake(
        async (projectId, docId) => {
          if (docId === 'doc-id-1') {
            throw new Error('oops, something went wrong')
          }
        }
      )
      await expect(
        this.ProjectManager.promises.flushProjectWithLocks(this.project_id)
      ).to.be.rejected
    })

    it('should still flush each doc in the project', function () {
      for (const docId of this.doc_ids) {
        this.DocumentManager.promises.flushDocIfLoadedWithLock.should.have.been.calledWith(
          this.project_id,
          docId
        )
      }
    })

    it('should time the execution', function () {
      this.Metrics.Timer.prototype.done.called.should.equal(true)
    })
  })
})
