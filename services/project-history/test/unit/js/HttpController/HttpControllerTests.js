import sinon from 'sinon'
import { strict as esmock } from 'esmock'
import mongodb from 'mongodb-legacy'
const { ObjectId } = mongodb

const MODULE_PATH = '../../../../app/js/HttpController.js'

describe('HttpController', function () {
  beforeEach(async function () {
    this.UpdatesProcessor = {
      processUpdatesForProject: sinon.stub().yields(),
    }
    this.SummarizedUpdatesManager = {
      getSummarizedProjectUpdates: sinon.stub(),
    }
    this.DiffManager = {
      getDiff: sinon.stub(),
    }
    this.HistoryStoreManager = {
      deleteProject: sinon.stub().yields(),
      getMostRecentVersion: sinon.stub(),
      getProjectBlobStream: sinon.stub(),
      initializeProject: sinon.stub(),
    }
    this.SnapshotManager = {
      getFileSnapshotStream: sinon.stub(),
      getProjectSnapshot: sinon.stub(),
    }
    this.HealthChecker = {}
    this.SyncManager = {
      clearResyncState: sinon.stub().yields(),
      startResync: sinon.stub().yields(),
    }
    this.WebApiManager = {
      getHistoryId: sinon.stub(),
    }
    this.RedisManager = {
      destroyDocUpdatesQueue: sinon.stub().yields(),
      clearFirstOpTimestamp: sinon.stub().yields(),
      clearCachedHistoryId: sinon.stub().yields(),
    }
    this.ErrorRecorder = {
      clearError: sinon.stub().yields(),
    }
    this.LabelsManager = {
      createLabel: sinon.stub(),
      deleteLabel: sinon.stub().yields(),
      deleteLabelForUser: sinon.stub().yields(),
      getLabels: sinon.stub(),
    }
    this.HistoryApiManager = {
      shouldUseProjectHistory: sinon.stub(),
    }
    this.RetryManager = {}
    this.FlushManager = {}
    this.request = {}
    this.pipeline = sinon.stub()
    this.HttpController = await esmock(MODULE_PATH, {
      request: this.request,
      stream: { pipeline: this.pipeline },
      '../../../../app/js/UpdatesProcessor.js': this.UpdatesProcessor,
      '../../../../app/js/SummarizedUpdatesManager.js':
        this.SummarizedUpdatesManager,
      '../../../../app/js/DiffManager.js': this.DiffManager,
      '../../../../app/js/HistoryStoreManager.js': this.HistoryStoreManager,
      '../../../../app/js/SnapshotManager.js': this.SnapshotManager,
      '../../../../app/js/HealthChecker.js': this.HealthChecker,
      '../../../../app/js/SyncManager.js': this.SyncManager,
      '../../../../app/js/WebApiManager.js': this.WebApiManager,
      '../../../../app/js/RedisManager.js': this.RedisManager,
      '../../../../app/js/ErrorRecorder.js': this.ErrorRecorder,
      '../../../../app/js/LabelsManager.js': this.LabelsManager,
      '../../../../app/js/HistoryApiManager.js': this.HistoryApiManager,
      '../../../../app/js/RetryManager.js': this.RetryManager,
      '../../../../app/js/FlushManager.js': this.FlushManager,
    })
    this.pathname = 'doc-id-123'
    this.projectId = new ObjectId().toString()
    this.projectOwnerId = new ObjectId().toString()
    this.next = sinon.stub()
    this.userId = new ObjectId().toString()
    this.now = Date.now()
    this.res = {
      json: sinon.stub(),
      send: sinon.stub(),
      sendStatus: sinon.stub(),
      setHeader: sinon.stub(),
    }
  })

  describe('getProjectBlob', function () {
    beforeEach(function () {
      this.blobHash = 'abcd'
      this.stream = {}
      this.historyId = 1337
      this.HistoryStoreManager.getProjectBlobStream.yields(null, this.stream)
      this.HttpController.getProjectBlob(
        { params: { history_id: this.historyId, hash: this.blobHash } },
        this.res,
        this.next
      )
    })

    it('should get a blob stream', function () {
      this.HistoryStoreManager.getProjectBlobStream
        .calledWith(this.historyId, this.blobHash)
        .should.equal(true)
      this.pipeline.should.have.been.calledWith(this.stream, this.res)
    })

    it('should set caching header', function () {
      this.res.setHeader.should.have.been.calledWith(
        'Cache-Control',
        'private, max-age=86400'
      )
    })
  })

  describe('initializeProject', function () {
    beforeEach(function () {
      this.historyId = new ObjectId().toString()
      this.req = { body: { historyId: this.historyId } }
      this.HistoryStoreManager.initializeProject.yields(null, this.historyId)
      this.HttpController.initializeProject(this.req, this.res, this.next)
    })

    it('should initialize the project', function () {
      this.HistoryStoreManager.initializeProject.calledWith().should.equal(true)
    })

    it('should return the new overleaf id', function () {
      this.res.json
        .calledWith({ project: { id: this.historyId } })
        .should.equal(true)
    })
  })

  describe('flushProject', function () {
    beforeEach(function () {
      this.req = {
        params: {
          project_id: this.projectId,
        },
        query: {},
      }
      this.HttpController.flushProject(this.req, this.res, this.next)
    })

    it('should process the updates', function () {
      this.UpdatesProcessor.processUpdatesForProject
        .calledWith(this.projectId)
        .should.equal(true)
    })

    it('should return a success code', function () {
      this.res.sendStatus.calledWith(204).should.equal(true)
    })
  })

  describe('getDiff', function () {
    beforeEach(function () {
      this.from = 42
      this.to = 45
      this.req = {
        params: {
          project_id: this.projectId,
        },
        query: {
          pathname: this.pathname,
          from: this.from,
          to: this.to,
        },
      }
      this.diff = [{ u: 'mock-diff' }]
      this.DiffManager.getDiff.yields(null, this.diff)
      this.HttpController.getDiff(this.req, this.res, this.next)
    })

    it('should get the diff', function () {
      this.DiffManager.getDiff.should.have.been.calledWith(
        this.projectId,
        this.pathname,
        this.from,
        this.to
      )
    })

    it('should return the diff', function () {
      this.res.json.calledWith({ diff: this.diff }).should.equal(true)
    })
  })

  describe('getUpdates', function () {
    beforeEach(function () {
      this.before = Date.now()
      this.nextBeforeTimestamp = this.before - 100
      this.min_count = 10
      this.req = {
        params: {
          project_id: this.projectId,
        },
        query: {
          before: this.before,
          min_count: this.min_count,
        },
      }
      this.updates = [{ i: 'mock-summarized-updates', p: 10 }]
      this.SummarizedUpdatesManager.getSummarizedProjectUpdates.yields(
        null,
        this.updates,
        this.nextBeforeTimestamp
      )
      this.HttpController.getUpdates(this.req, this.res, this.next)
    })

    it('should get the updates', function () {
      this.SummarizedUpdatesManager.getSummarizedProjectUpdates.should.have.been.calledWith(
        this.projectId,
        {
          before: this.before,
          min_count: this.min_count,
        }
      )
    })

    it('should return the formatted updates', function () {
      this.res.json.should.have.been.calledWith({
        updates: this.updates,
        nextBeforeTimestamp: this.nextBeforeTimestamp,
      })
    })
  })

  describe('latestVersion', function () {
    beforeEach(function () {
      this.historyId = 1234
      this.req = {
        params: {
          project_id: this.projectId,
        },
      }

      this.version = 99
      this.lastChange = {
        v2Authors: ['1234'],
        timestamp: '2016-08-16T10:44:40.227Z',
      }
      this.versionInfo = {
        version: this.version,
        v2Authors: ['1234'],
        timestamp: '2016-08-16T10:44:40.227Z',
      }
      this.WebApiManager.getHistoryId.yields(null, this.historyId)
      this.HistoryStoreManager.getMostRecentVersion.yields(
        null,
        this.version,
        {},
        this.lastChange
      )
      this.HttpController.latestVersion(this.req, this.res, this.next)
    })

    it('should process the updates', function () {
      this.UpdatesProcessor.processUpdatesForProject
        .calledWith(this.projectId)
        .should.equal(true)
    })

    it('should get the ol project id', function () {
      this.WebApiManager.getHistoryId
        .calledWith(this.projectId)
        .should.equal(true)
    })

    it('should get the latest version', function () {
      this.HistoryStoreManager.getMostRecentVersion
        .calledWith(this.projectId, this.historyId)
        .should.equal(true)
    })

    it('should return version number', function () {
      this.res.json.calledWith(this.versionInfo).should.equal(true)
    })
  })

  describe('resyncProject', function () {
    beforeEach(function () {
      this.req = {
        params: {
          project_id: this.projectId,
        },
        query: {},
        body: {},
      }
      this.HttpController.resyncProject(this.req, this.res, this.next)
    })

    it('should resync the project', function () {
      this.SyncManager.startResync.calledWith(this.projectId).should.equal(true)
    })

    it('should flush the queue', function () {
      this.UpdatesProcessor.processUpdatesForProject
        .calledWith(this.projectId)
        .should.equal(true)
    })

    it('should return 204', function () {
      this.res.sendStatus.calledWith(204).should.equal(true)
    })
  })

  describe('getFileSnapshot', function () {
    beforeEach(function () {
      this.version = 42
      this.pathname = 'foo.tex'
      this.req = {
        params: {
          project_id: this.projectId,
          version: this.version,
          pathname: this.pathname,
        },
      }
      this.res = { mock: 'res' }
      this.stream = {}
      this.SnapshotManager.getFileSnapshotStream.yields(null, this.stream)
      this.HttpController.getFileSnapshot(this.req, this.res, this.next)
    })

    it('should get the snapshot', function () {
      this.SnapshotManager.getFileSnapshotStream.should.have.been.calledWith(
        this.projectId,
        this.version,
        this.pathname
      )
    })

    it('should pipe the returned stream into the response', function () {
      this.pipeline.should.have.been.calledWith(this.stream, this.res)
    })
  })

  describe('getProjectSnapshot', function () {
    beforeEach(function () {
      this.version = 42
      this.req = {
        params: {
          project_id: this.projectId,
          version: this.version,
        },
      }
      this.res = { json: sinon.stub() }
      this.snapshotData = { one: 1 }
      this.SnapshotManager.getProjectSnapshot.yields(null, this.snapshotData)
      this.HttpController.getProjectSnapshot(this.req, this.res, this.next)
    })

    it('should get the snapshot', function () {
      this.SnapshotManager.getProjectSnapshot.should.have.been.calledWith(
        this.projectId,
        this.version
      )
    })

    it('should send json response', function () {
      this.res.json.calledWith(this.snapshotData).should.equal(true)
    })
  })

  describe('getLabels', function () {
    beforeEach(function () {
      this.req = {
        params: {
          project_id: this.projectId,
        },
      }
      this.labels = ['label-1', 'label-2']
      this.LabelsManager.getLabels.yields(null, this.labels)
    })

    describe('project history is enabled', function () {
      beforeEach(function () {
        this.HistoryApiManager.shouldUseProjectHistory.yields(null, true)
        this.HttpController.getLabels(this.req, this.res, this.next)
      })

      it('should get the labels for a project', function () {
        this.LabelsManager.getLabels
          .calledWith(this.projectId)
          .should.equal(true)
      })

      it('should return the labels', function () {
        this.res.json.calledWith(this.labels).should.equal(true)
      })
    })

    describe('project history is not enabled', function () {
      beforeEach(function () {
        this.HistoryApiManager.shouldUseProjectHistory.yields(null, false)
        this.HttpController.getLabels(this.req, this.res, this.next)
      })

      it('should return 409', function () {
        this.res.sendStatus.calledWith(409).should.equal(true)
      })
    })
  })

  describe('createLabel', function () {
    beforeEach(function () {
      this.req = {
        params: {
          project_id: this.projectId,
        },
        body: {
          version: (this.version = 'label-1'),
          comment: (this.comment = 'a comment'),
          created_at: (this.created_at = Date.now().toString()),
          validate_exists: true,
          user_id: this.userId,
        },
      }
      this.label = { _id: new ObjectId() }
      this.LabelsManager.createLabel.yields(null, this.label)
    })

    describe('project history is enabled', function () {
      beforeEach(function () {
        this.HistoryApiManager.shouldUseProjectHistory.yields(null, true)
        this.HttpController.createLabel(this.req, this.res, this.next)
      })

      it('should create a label for a project', function () {
        this.LabelsManager.createLabel.should.have.been.calledWith(
          this.projectId,
          this.userId,
          this.version,
          this.comment,
          this.created_at,
          true
        )
      })

      it('should return the label', function () {
        this.res.json.calledWith(this.label).should.equal(true)
      })
    })

    describe('validate_exists = false is passed', function () {
      beforeEach(function () {
        this.req.body.validate_exists = false
        this.HistoryApiManager.shouldUseProjectHistory.yields(null, true)
        this.HttpController.createLabel(this.req, this.res, this.next)
      })

      it('should create a label for a project', function () {
        this.LabelsManager.createLabel
          .calledWith(
            this.projectId,
            this.userId,
            this.version,
            this.comment,
            this.created_at,
            false
          )
          .should.equal(true)
      })

      it('should return the label', function () {
        this.res.json.calledWith(this.label).should.equal(true)
      })
    })

    describe('project history is not enabled', function () {
      beforeEach(function () {
        this.HistoryApiManager.shouldUseProjectHistory.yields(null, false)
        this.HttpController.createLabel(this.req, this.res, this.next)
      })

      it('should return 409', function () {
        this.res.sendStatus.calledWith(409).should.equal(true)
      })
    })
  })

  describe('deleteLabelForUser', function () {
    beforeEach(function () {
      this.req = {
        params: {
          project_id: this.projectId,
          user_id: this.userId,
          label_id: (this.label_id = new ObjectId()),
        },
      }
      this.HttpController.deleteLabelForUser(this.req, this.res, this.next)
    })

    it('should delete a label for a project', function () {
      this.LabelsManager.deleteLabelForUser
        .calledWith(this.projectId, this.userId, this.label_id)
        .should.equal(true)
    })

    it('should return 204', function () {
      this.res.sendStatus.calledWith(204).should.equal(true)
    })
  })

  describe('deleteLabel', function () {
    beforeEach(function () {
      this.req = {
        params: {
          project_id: this.projectId,
          label_id: (this.label_id = new ObjectId()),
        },
      }
      this.HttpController.deleteLabel(this.req, this.res, this.next)
    })

    it('should delete a label for a project', function () {
      this.LabelsManager.deleteLabel
        .calledWith(this.projectId, this.label_id)
        .should.equal(true)
    })

    it('should return 204', function () {
      this.res.sendStatus.calledWith(204).should.equal(true)
    })
  })

  describe('deleteProject', function () {
    beforeEach(function () {
      this.req = {
        params: {
          project_id: this.projectId,
        },
      }
      this.WebApiManager.getHistoryId
        .withArgs(this.projectId)
        .yields(null, this.historyId)
      this.HttpController.deleteProject(this.req, this.res, this.next)
    })

    it('should delete the updates queue', function () {
      this.RedisManager.destroyDocUpdatesQueue.should.have.been.calledWith(
        this.projectId
      )
    })

    it('should clear the first op timestamp', function () {
      this.RedisManager.clearFirstOpTimestamp.should.have.been.calledWith(
        this.projectId
      )
    })

    it('should clear the cached history id', function () {
      this.RedisManager.clearCachedHistoryId.should.have.been.calledWith(
        this.projectId
      )
    })

    it('should clear the resync state', function () {
      this.SyncManager.clearResyncState.should.have.been.calledWith(
        this.projectId
      )
    })

    it('should clear any failure record', function () {
      this.ErrorRecorder.clearError.should.have.been.calledWith(this.projectId)
    })
  })
})
