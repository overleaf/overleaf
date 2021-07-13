const sinon = require('sinon')
const modulePath = '../../../../app/js/ProjectManager.js'
const SandboxedModule = require('sandboxed-module')
const _ = require('lodash')

describe('ProjectManager', function () {
  beforeEach(function () {
    this.RedisManager = {}
    this.ProjectHistoryRedisManager = {
      queueRenameEntity: sinon.stub().yields(),
      queueAddEntity: sinon.stub().yields(),
    }
    this.DocumentManager = {
      renameDocWithLock: sinon.stub().yields(),
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
    this.callback = sinon.stub()
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
        beforeEach(function () {
          this.ProjectManager.updateProjectWithLocks(
            this.project_id,
            this.projectHistoryId,
            this.user_id,
            this.updates,
            this.version,
            this.callback
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
          this.DocumentManager.renameDocWithLock
            .calledWith(
              this.project_id,
              this.firstDocUpdate.id,
              this.user_id,
              firstDocUpdateWithVersion,
              this.projectHistoryId
            )
            .should.equal(true)
          this.DocumentManager.renameDocWithLock
            .calledWith(
              this.project_id,
              this.secondDocUpdate.id,
              this.user_id,
              secondDocUpdateWithVersion,
              this.projectHistoryId
            )
            .should.equal(true)
        })

        it('should rename the files in the updates', function () {
          const firstFileUpdateWithVersion = _.extend(
            {},
            this.firstFileUpdate,
            { version: `${this.version}.2` }
          )
          this.ProjectHistoryRedisManager.queueRenameEntity
            .calledWith(
              this.project_id,
              this.projectHistoryId,
              'file',
              this.firstFileUpdate.id,
              this.user_id,
              firstFileUpdateWithVersion
            )
            .should.equal(true)
        })

        it('should not flush the history', function () {
          this.HistoryManager.flushProjectChangesAsync
            .calledWith(this.project_id)
            .should.equal(false)
        })

        it('should call the callback', function () {
          this.callback.called.should.equal(true)
        })
      })

      describe('when renaming a doc fails', function () {
        beforeEach(function () {
          this.error = new Error('error')
          this.DocumentManager.renameDocWithLock.yields(this.error)
          this.ProjectManager.updateProjectWithLocks(
            this.project_id,
            this.projectHistoryId,
            this.user_id,
            this.updates,
            this.version,
            this.callback
          )
        })

        it('should call the callback with the error', function () {
          this.callback.calledWith(this.error).should.equal(true)
        })
      })

      describe('when renaming a file fails', function () {
        beforeEach(function () {
          this.error = new Error('error')
          this.ProjectHistoryRedisManager.queueRenameEntity.yields(this.error)
          this.ProjectManager.updateProjectWithLocks(
            this.project_id,
            this.projectHistoryId,
            this.user_id,
            this.updates,
            this.version,
            this.callback
          )
        })

        it('should call the callback with the error', function () {
          this.callback.calledWith(this.error).should.equal(true)
        })
      })

      describe('with enough ops to flush', function () {
        beforeEach(function () {
          this.HistoryManager.shouldFlushHistoryOps.returns(true)
          this.ProjectManager.updateProjectWithLocks(
            this.project_id,
            this.projectHistoryId,
            this.user_id,
            this.updates,
            this.version,
            this.callback
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
        beforeEach(function () {
          this.ProjectManager.updateProjectWithLocks(
            this.project_id,
            this.projectHistoryId,
            this.user_id,
            this.updates,
            this.version,
            this.callback
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
          this.ProjectHistoryRedisManager.queueAddEntity
            .getCall(0)
            .calledWith(
              this.project_id,
              this.projectHistoryId,
              'doc',
              this.firstDocUpdate.id,
              this.user_id,
              firstDocUpdateWithVersion
            )
            .should.equal(true)
          this.ProjectHistoryRedisManager.queueAddEntity
            .getCall(1)
            .calledWith(
              this.project_id,
              this.projectHistoryId,
              'doc',
              this.secondDocUpdate.id,
              this.user_id,
              secondDocUpdateWithVersion
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
          this.ProjectHistoryRedisManager.queueAddEntity
            .getCall(2)
            .calledWith(
              this.project_id,
              this.projectHistoryId,
              'file',
              this.firstFileUpdate.id,
              this.user_id,
              firstFileUpdateWithVersion
            )
            .should.equal(true)
          this.ProjectHistoryRedisManager.queueAddEntity
            .getCall(3)
            .calledWith(
              this.project_id,
              this.projectHistoryId,
              'file',
              this.secondFileUpdate.id,
              this.user_id,
              secondFileUpdateWithVersion
            )
            .should.equal(true)
        })

        it('should not flush the history', function () {
          this.HistoryManager.flushProjectChangesAsync
            .calledWith(this.project_id)
            .should.equal(false)
        })

        it('should call the callback', function () {
          this.callback.called.should.equal(true)
        })
      })

      describe('when adding a doc fails', function () {
        beforeEach(function () {
          this.error = new Error('error')
          this.ProjectHistoryRedisManager.queueAddEntity.yields(this.error)
          this.ProjectManager.updateProjectWithLocks(
            this.project_id,
            this.projectHistoryId,
            this.user_id,
            this.updates,
            this.version,
            this.callback
          )
        })

        it('should call the callback with the error', function () {
          this.callback.calledWith(this.error).should.equal(true)
        })
      })

      describe('when adding a file fails', function () {
        beforeEach(function () {
          this.error = new Error('error')
          this.ProjectHistoryRedisManager.queueAddEntity.yields(this.error)
          this.ProjectManager.updateProjectWithLocks(
            this.project_id,
            this.projectHistoryId,
            this.user_id,
            this.updates,
            this.version,
            this.callback
          )
        })

        it('should call the callback with the error', function () {
          this.callback.calledWith(this.error).should.equal(true)
        })
      })

      describe('with enough ops to flush', function () {
        beforeEach(function () {
          this.HistoryManager.shouldFlushHistoryOps.returns(true)
          this.ProjectManager.updateProjectWithLocks(
            this.project_id,
            this.projectHistoryId,
            this.user_id,
            this.updates,
            this.version,
            this.callback
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
      beforeEach(function () {
        this.updates = [{ type: 'brew-coffee' }]
        this.ProjectManager.updateProjectWithLocks(
          this.project_id,
          this.projectHistoryId,
          this.user_id,
          this.updates,
          this.version,
          this.callback
        )
      })

      it('should call back with an error', function () {
        this.callback.calledWith(sinon.match.instanceOf(Error)).should.be.true
      })
    })
  })
})
