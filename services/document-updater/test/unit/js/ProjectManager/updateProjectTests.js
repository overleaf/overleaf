const { expect } = require('chai')
const sinon = require('sinon')
const modulePath = '../../../../app/js/ProjectManager.js'
const SandboxedModule = require('sandboxed-module')
const _ = require('lodash')

describe('ProjectManager', function () {
  beforeEach(function () {
    this.RedisManager = {}
    this.ProjectHistoryRedisManager = {
      promises: {
        queueRenameEntity: sinon.stub().resolves(),
        queueAddEntity: sinon.stub().resolves(),
      },
    }
    this.DocumentManager = {
      promises: {
        renameDocWithLock: sinon.stub().resolves(),
      },
    }
    this.HistoryManager = {
      flushProjectChangesAsync: sinon.stub(),
      shouldFlushHistoryOps: sinon.stub().returns(false),
    }
    this.Metrics = {
      Timer: class Timer {},
    }
    this.Metrics.Timer.prototype.done = sinon.stub()

    this.ProjectManager = SandboxedModule.require(modulePath, {
      requires: {
        './RedisManager': this.RedisManager,
        './ProjectHistoryRedisManager': this.ProjectHistoryRedisManager,
        './DocumentManager': this.DocumentManager,
        './HistoryManager': this.HistoryManager,
        './Metrics': this.Metrics,
      },
    })

    this.project_id = 'project-id-123'
    this.projectHistoryId = 'history-id-123'
    this.user_id = 'user-id-123'
    this.version = 1234567
    this.source = 'editor'
  })

  describe('updateProjectWithLocks', function () {
    describe('rename operations', function () {
      beforeEach(function () {
        this.firstDocUpdate = {
          type: 'rename-doc',
          id: 1,
          pathname: 'foo',
          newPathname: 'foo',
        }
        this.secondDocUpdate = {
          type: 'rename-doc',
          id: 2,
          pathname: 'bar',
          newPathname: 'bar2',
        }
        this.firstFileUpdate = {
          type: 'rename-file',
          id: 2,
          pathname: 'bar',
          newPathname: 'bar2',
        }
        this.updates = [
          this.firstDocUpdate,
          this.secondDocUpdate,
          this.firstFileUpdate,
        ]
      })

      describe('successfully', function () {
        beforeEach(async function () {
          await this.ProjectManager.promises.updateProjectWithLocks(
            this.project_id,
            this.projectHistoryId,
            this.user_id,
            this.updates,
            this.version,
            this.source
          )
        })

        it('should rename the docs in the updates', function () {
          const firstDocUpdateWithVersion = _.extend({}, this.firstDocUpdate, {
            version: `${this.version}.0`,
          })
          const secondDocUpdateWithVersion = _.extend(
            {},
            this.secondDocUpdate,
            { version: `${this.version}.1` }
          )
          this.DocumentManager.promises.renameDocWithLock.should.have.been.calledWith(
            this.project_id,
            this.firstDocUpdate.id,
            this.user_id,
            firstDocUpdateWithVersion,
            this.projectHistoryId
          )
          this.DocumentManager.promises.renameDocWithLock.should.have.been.calledWith(
            this.project_id,
            this.secondDocUpdate.id,
            this.user_id,
            secondDocUpdateWithVersion,
            this.projectHistoryId
          )
        })

        it('should rename the files in the updates', function () {
          const firstFileUpdateWithVersion = _.extend(
            {},
            this.firstFileUpdate,
            { version: `${this.version}.2` }
          )
          this.ProjectHistoryRedisManager.promises.queueRenameEntity.should.have.been.calledWith(
            this.project_id,
            this.projectHistoryId,
            'file',
            this.firstFileUpdate.id,
            this.user_id,
            firstFileUpdateWithVersion,
            this.source
          )
        })

        it('should not flush the history', function () {
          this.HistoryManager.flushProjectChangesAsync
            .calledWith(this.project_id)
            .should.equal(false)
        })
      })

      describe('when renaming a doc fails', function () {
        it('throws an error', async function () {
          this.DocumentManager.promises.renameDocWithLock.rejects(
            new Error('error')
          )
          await expect(
            this.ProjectManager.promises.updateProjectWithLocks(
              this.project_id,
              this.projectHistoryId,
              this.user_id,
              this.updates,
              this.version,
              this.source
            )
          ).to.be.rejected
        })
      })

      describe('when renaming a file fails', function () {
        it('throws an error', async function () {
          this.ProjectHistoryRedisManager.promises.queueRenameEntity.rejects(
            new Error('error')
          )
          await expect(
            this.ProjectManager.promises.updateProjectWithLocks(
              this.project_id,
              this.projectHistoryId,
              this.user_id,
              this.updates,
              this.version,
              this.source
            )
          ).to.be.rejected
        })
      })

      describe('with enough ops to flush', function () {
        beforeEach(async function () {
          this.HistoryManager.shouldFlushHistoryOps.returns(true)
          await this.ProjectManager.promises.updateProjectWithLocks(
            this.project_id,
            this.projectHistoryId,
            this.user_id,
            this.updates,
            this.version,
            this.source
          )
        })

        it('should flush the history', function () {
          this.HistoryManager.flushProjectChangesAsync
            .calledWith(this.project_id)
            .should.equal(true)
        })
      })
    })

    describe('add operations', function () {
      beforeEach(function () {
        this.firstDocUpdate = {
          type: 'add-doc',
          id: 1,
          docLines: 'a\nb',
        }
        this.secondDocUpdate = {
          type: 'add-doc',
          id: 2,
          docLines: 'a\nb',
        }
        this.firstFileUpdate = {
          type: 'add-file',
          id: 3,
          url: 'filestore.example.com/2',
        }
        this.secondFileUpdate = {
          type: 'add-file',
          id: 4,
          url: 'filestore.example.com/3',
        }
        this.updates = [
          this.firstDocUpdate,
          this.secondDocUpdate,
          this.firstFileUpdate,
          this.secondFileUpdate,
        ]
      })

      describe('successfully', function () {
        beforeEach(async function () {
          await this.ProjectManager.promises.updateProjectWithLocks(
            this.project_id,
            this.projectHistoryId,
            this.user_id,
            this.updates,
            this.version,
            this.source
          )
        })

        it('should add the docs in the updates', function () {
          const firstDocUpdateWithVersion = _.extend({}, this.firstDocUpdate, {
            version: `${this.version}.0`,
          })
          const secondDocUpdateWithVersion = _.extend(
            {},
            this.secondDocUpdate,
            { version: `${this.version}.1` }
          )
          this.ProjectHistoryRedisManager.promises.queueAddEntity
            .getCall(0)
            .calledWith(
              this.project_id,
              this.projectHistoryId,
              'doc',
              this.firstDocUpdate.id,
              this.user_id,
              firstDocUpdateWithVersion,
              this.source
            )
            .should.equal(true)
          this.ProjectHistoryRedisManager.promises.queueAddEntity
            .getCall(1)
            .calledWith(
              this.project_id,
              this.projectHistoryId,
              'doc',
              this.secondDocUpdate.id,
              this.user_id,
              secondDocUpdateWithVersion,
              this.source
            )
            .should.equal(true)
        })

        it('should add the files in the updates', function () {
          const firstFileUpdateWithVersion = _.extend(
            {},
            this.firstFileUpdate,
            { version: `${this.version}.2` }
          )
          const secondFileUpdateWithVersion = _.extend(
            {},
            this.secondFileUpdate,
            { version: `${this.version}.3` }
          )
          this.ProjectHistoryRedisManager.promises.queueAddEntity
            .getCall(2)
            .calledWith(
              this.project_id,
              this.projectHistoryId,
              'file',
              this.firstFileUpdate.id,
              this.user_id,
              firstFileUpdateWithVersion,
              this.source
            )
            .should.equal(true)
          this.ProjectHistoryRedisManager.promises.queueAddEntity
            .getCall(3)
            .calledWith(
              this.project_id,
              this.projectHistoryId,
              'file',
              this.secondFileUpdate.id,
              this.user_id,
              secondFileUpdateWithVersion,
              this.source
            )
            .should.equal(true)
        })

        it('should not flush the history', function () {
          this.HistoryManager.flushProjectChangesAsync
            .calledWith(this.project_id)
            .should.equal(false)
        })
      })

      describe('when adding a doc fails', function () {
        it('it should throw an error', async function () {
          this.error = new Error('error')
          this.ProjectHistoryRedisManager.promises.queueAddEntity.rejects(
            this.error
          )
          await expect(
            this.ProjectManager.promises.updateProjectWithLocks(
              this.project_id,
              this.projectHistoryId,
              this.user_id,
              this.updates,
              this.version,
              this.source
            )
          ).to.be.rejected
        })
      })

      describe('when adding a file fails', function () {
        beforeEach(async function () {
          this.ProjectHistoryRedisManager.promises.queueAddEntity.rejects(
            new Error('error')
          )
          await expect(
            this.ProjectManager.promises.updateProjectWithLocks(
              this.project_id,
              this.projectHistoryId,
              this.user_id,
              this.updates,
              this.version,
              this.source
            )
          ).to.be.rejected
        })
      })

      describe('with enough ops to flush', function () {
        beforeEach(async function () {
          this.HistoryManager.shouldFlushHistoryOps.returns(true)
          await this.ProjectManager.promises.updateProjectWithLocks(
            this.project_id,
            this.projectHistoryId,
            this.user_id,
            this.updates,
            this.version,
            this.source
          )
        })

        it('should flush the history', function () {
          this.HistoryManager.flushProjectChangesAsync
            .calledWith(this.project_id)
            .should.equal(true)
        })
      })
    })

    describe('when given an unknown operation type', function () {
      it('throws an error', async function () {
        this.updates = [{ type: 'brew-coffee' }]
        await expect(
          this.ProjectManager.promises.updateProjectWithLocks(
            this.project_id,
            this.projectHistoryId,
            this.user_id,
            this.updates,
            this.version,
            this.source
          )
        ).to.be.rejected
      })
    })
  })
})
