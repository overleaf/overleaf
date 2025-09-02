const { expect } = require('chai')
const sinon = require('sinon')
const SandboxedModule = require('sandboxed-module')
const Errors = require('../../../../app/js/Errors.js')

const MODULE_PATH = '../../../../app/js/ProjectManager.js'

describe('ProjectManager - getProjectDocsAndFlushIfOld', function () {
  beforeEach(function () {
    this.RedisManager = {
      promises: {
        checkOrSetProjectState: sinon.stub().resolves(),
        getDocIdsInProject: sinon.stub(),
        clearProjectState: sinon.stub().resolves(),
      },
    }
    this.ProjectHistoryRedisManager = {}
    this.DocumentManager = {
      promises: {
        getDocAndFlushIfOldWithLock: sinon.stub(),
      },
    }
    this.HistoryManager = {}
    this.Metrics = {
      Timer: class Timer {},
    }
    this.Metrics.Timer.prototype.done = sinon.stub()

    this.ProjectManager = SandboxedModule.require(MODULE_PATH, {
      requires: {
        './RedisManager': this.RedisManager,
        './ProjectHistoryRedisManager': this.ProjectHistoryRedisManager,
        './DocumentManager': this.DocumentManager,
        './HistoryManager': this.HistoryManager,
        './Metrics': this.Metrics,
        './Errors': Errors,
      },
    })
    this.project_id = 'project-id-123'
    this.doc_versions = [111, 222, 333]
  })

  describe('successfully', function () {
    beforeEach(async function () {
      this.doc_ids = ['doc-id-1', 'doc-id-2', 'doc-id-3']
      this.doc_lines = [
        ['aaa', 'aaa'],
        ['bbb', 'bbb'],
        ['ccc', 'ccc'],
      ]
      this.docs = [
        {
          _id: this.doc_ids[0],
          lines: this.doc_lines[0],
          v: this.doc_versions[0],
        },
        {
          _id: this.doc_ids[1],
          lines: this.doc_lines[1],
          v: this.doc_versions[1],
        },
        {
          _id: this.doc_ids[2],
          lines: this.doc_lines[2],
          v: this.doc_versions[2],
        },
      ]
      this.RedisManager.promises.getDocIdsInProject.resolves(this.doc_ids)
      this.DocumentManager.promises.getDocAndFlushIfOldWithLock
        .withArgs(this.project_id, this.doc_ids[0])
        .resolves({ lines: this.doc_lines[0], version: this.doc_versions[0] })
      this.DocumentManager.promises.getDocAndFlushIfOldWithLock
        .withArgs(this.project_id, this.doc_ids[1])
        .resolves({ lines: this.doc_lines[1], version: this.doc_versions[1] })
      this.DocumentManager.promises.getDocAndFlushIfOldWithLock
        .withArgs(this.project_id, this.doc_ids[2])
        .resolves({ lines: this.doc_lines[2], version: this.doc_versions[2] })
      this.result =
        await this.ProjectManager.promises.getProjectDocsAndFlushIfOld(
          this.project_id,
          this.projectStateHash,
          this.excludeVersions
        )
    })

    it('should check the project state', function () {
      this.RedisManager.promises.checkOrSetProjectState.should.have.been.calledWith(
        this.project_id,
        this.projectStateHash
      )
    })

    it('should get the doc ids in the project', function () {
      this.RedisManager.promises.getDocIdsInProject.should.have.been.calledWith(
        this.project_id
      )
    })

    it('should return docs', function () {
      expect(this.result).to.deep.equal(this.docs)
    })

    it('should time the execution', function () {
      this.Metrics.Timer.prototype.done.called.should.equal(true)
    })
  })

  describe('when the state does not match', function () {
    beforeEach(async function () {
      this.doc_ids = ['doc-id-1', 'doc-id-2', 'doc-id-3']
      this.RedisManager.promises.checkOrSetProjectState.resolves(true)
      await expect(
        this.ProjectManager.promises.getProjectDocsAndFlushIfOld(
          this.project_id,
          this.projectStateHash,
          this.excludeVersions
        )
      ).to.be.rejectedWith(Errors.ProjectStateChangedError)
    })

    it('should check the project state', function () {
      this.RedisManager.promises.checkOrSetProjectState.should.have.been.calledWith(
        this.project_id,
        this.projectStateHash
      )
    })

    it('should time the execution', function () {
      this.Metrics.Timer.prototype.done.called.should.equal(true)
    })
  })

  describe('when a doc errors', function () {
    it('should call the callback with an error', async function () {
      this.doc_ids = ['doc-id-1', 'doc-id-2', 'doc-id-3']
      this.error = new Error('oops')
      this.RedisManager.promises.getDocIdsInProject.resolves(this.doc_ids)
      this.DocumentManager.promises.getDocAndFlushIfOldWithLock
        .withArgs(this.project_id, 'doc-id-1')
        .resolves({
          lines: ['test doc content'],
          version: this.doc_versions[1],
        })
      this.DocumentManager.promises.getDocAndFlushIfOldWithLock
        .withArgs(this.project_id, 'doc-id-2')
        .rejects(this.error)
      await expect(
        this.ProjectManager.promises.getProjectDocsAndFlushIfOld(
          this.project_id,
          this.projectStateHash,
          this.excludeVersions
        )
      ).to.be.rejected
    })
  })

  describe('clearing the project state with clearProjectState', function () {
    beforeEach(async function () {
      await this.ProjectManager.promises.clearProjectState(this.project_id)
    })

    it('should clear the project state', function () {
      this.RedisManager.promises.clearProjectState.should.have.been.calledWith(
        this.project_id
      )
    })
  })
})
