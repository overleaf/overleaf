import sinon from 'sinon'
import { expect } from 'chai'
import mongodb from 'mongodb-legacy'
import { strict as esmock } from 'esmock'
const { ObjectId } = mongodb

const MODULE_PATH = '../../../../app/js/RetryManager.js'

describe('RetryManager', function () {
  beforeEach(async function () {
    this.projectId1 = new ObjectId().toString()
    this.projectId2 = new ObjectId().toString()
    this.projectId3 = new ObjectId().toString()
    this.projectId4 = new ObjectId().toString()
    this.historyId = 12345

    this.WebApiManager = {
      promises: {
        getHistoryId: sinon.stub().resolves(this.historyId),
      },
    }
    this.RedisManager = {
      promises: {
        countUnprocessedUpdates: sinon.stub().resolves(0),
      },
    }
    this.ErrorRecorder = {
      promises: {
        getFailedProjects: sinon.stub().resolves([
          {
            project_id: this.projectId1,
            error: 'Error: Timeout',
            attempts: 1,
          },
          {
            project_id: this.projectId2,
            error: 'Error: Timeout',
            attempts: 25,
          },
          {
            project_id: this.projectId3,
            error: 'sync ongoing',
            attempts: 10,
            resyncAttempts: 1,
          },
          {
            project_id: this.projectId4,
            error: 'sync ongoing',
            attempts: 10,
            resyncAttempts: 2,
          },
        ]),
        getFailureRecord: sinon.stub().resolves(),
      },
    }
    this.SyncManager = {
      promises: {
        startResync: sinon.stub().resolves(),
        startHardResync: sinon.stub().resolves(),
      },
    }
    this.UpdatesProcessor = {
      promises: {
        processUpdatesForProject: sinon.stub().resolves(),
      },
    }
    this.settings = {
      redis: {
        lock: {
          key_schema: {
            projectHistoryLock({ projectId }) {
              return `ProjectHistoryLock:${projectId}`
            },
          },
        },
      },
    }
    this.request = {}
    this.RetryManager = await esmock(MODULE_PATH, {
      '../../../../app/js/WebApiManager.js': this.WebApiManager,
      '../../../../app/js/RedisManager.js': this.RedisManager,
      '../../../../app/js/ErrorRecorder.js': this.ErrorRecorder,
      '../../../../app/js/SyncManager.js': this.SyncManager,
      '../../../../app/js/UpdatesProcessor.js': this.UpdatesProcessor,
      '@overleaf/settings': this.settings,
      request: this.request,
    })
  })

  describe('RetryManager', function () {
    describe('for a soft failure', function () {
      beforeEach(async function () {
        await this.RetryManager.promises.retryFailures({ failureType: 'soft' })
      })

      it('should flush the queue', function () {
        expect(
          this.UpdatesProcessor.promises.processUpdatesForProject
        ).to.have.been.calledWith(this.projectId1)
      })
    })

    describe('for a hard failure', function () {
      beforeEach(async function () {
        await this.RetryManager.promises.retryFailures({ failureType: 'hard' })
      })

      it('should check the overleaf project id', function () {
        expect(
          this.WebApiManager.promises.getHistoryId
        ).to.have.been.calledWith(this.projectId2)
      })

      it("should start a soft resync when a resync hasn't been tried yet", function () {
        expect(this.SyncManager.promises.startResync).to.have.been.calledWith(
          this.projectId2
        )
      })

      it('should start a hard resync when a resync has already been tried', function () {
        expect(
          this.SyncManager.promises.startHardResync
        ).to.have.been.calledWith(this.projectId3)
      })

      it("shouldn't try a resync after a hard resync attempt failed", function () {
        expect(
          this.SyncManager.promises.startHardResync
        ).not.to.have.been.calledWith(this.projectId4)
      })

      it('should count the unprocessed updates', function () {
        expect(
          this.RedisManager.promises.countUnprocessedUpdates
        ).to.have.been.calledWith(this.projectId2)
      })

      it('should check the failure record', function () {
        expect(
          this.ErrorRecorder.promises.getFailureRecord
        ).to.have.been.calledWith(this.projectId2)
      })
    })
  })
})
