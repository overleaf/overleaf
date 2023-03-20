/* eslint-disable
    mocha/no-nested-tests,
    no-return-assign,
    no-undef,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
import sinon from 'sinon'
import { expect } from 'chai'
import { strict as esmock } from 'esmock'
import * as Errors from '../../../../app/js/Errors.js'

const MODULE_PATH = '../../../../app/js/UpdatesProcessor.js'

describe('UpdatesProcessor', function () {
  before(async function () {
    this.extendLock = sinon.stub()
    this.BlobManager = {
      createBlobForUpdates: sinon.stub(),
    }
    this.HistoryStoreManager = {
      getMostRecentVersion: sinon.stub(),
      sendChanges: sinon.stub().yields(),
    }
    this.LockManager = {
      runWithLock: sinon.spy((key, runner, callback) =>
        runner(this.extendLock, callback)
      ),
    }
    this.RedisManager = {}
    this.UpdateCompressor = {
      compressRawUpdates: sinon.stub(),
    }
    this.UpdateTranslator = {
      convertToChanges: sinon.stub(),
      isProjectStructureUpdate: sinon.stub(),
      isTextUpdate: sinon.stub(),
    }
    this.WebApiManager = {
      getHistoryId: sinon.stub(),
    }
    this.SyncManager = {
      expandSyncUpdates: sinon.stub(),
      setResyncState: sinon.stub().yields(),
      skipUpdatesDuringSync: sinon.stub(),
    }
    this.ErrorRecorder = {
      getLastFailure: sinon.stub(),
      record: sinon.stub().yields(),
    }
    this.Profiler = {
      Profiler: sinon.stub(),
    }
    this.Metrics = {
      gauge: sinon.stub(),
      inc: sinon.stub(),
    }
    this.Settings = {
      redis: {
        lock: {
          key_schema: {
            projectHistoryLock({ project_id: projectId }) {
              return `ProjectHistoryLock:${projectId}`
            },
          },
        },
      },
    }
    this.UpdatesProcessor = await esmock(MODULE_PATH, {
      '../../../../app/js/BlobManager.js': this.BlobManager,
      '../../../../app/js/HistoryStoreManager.js': this.HistoryStoreManager,
      '../../../../app/js/LockManager.js': this.LockManager,
      '../../../../app/js/RedisManager.js': this.RedisManager,
      '../../../../app/js/UpdateCompressor.js': this.UpdateCompressor,
      '../../../../app/js/UpdateTranslator.js': this.UpdateTranslator,
      '../../../../app/js/WebApiManager.js': this.WebApiManager,
      '../../../../app/js/SyncManager.js': this.SyncManager,
      '../../../../app/js/ErrorRecorder.js': this.ErrorRecorder,
      '../../../../app/js/Profiler.js': this.Profiler,
      '../../../../app/js/Errors.js': Errors,
      '@overleaf/metrics': this.Metrics,
      '@overleaf/settings': this.Settings,
    })
    this.doc_id = 'doc-id-123'
    this.project_id = 'project-id-123'
    this.ol_project_id = 'ol-project-id-234'
    this.callback = sinon.stub()
    return (this.temporary = 'temp-mock')
  })

  describe('processUpdatesForProject', function () {
    beforeEach(function () {
      this.error = new Error('error')
      this.queueSize = 445
      this.UpdatesProcessor._mocks._countAndProcessUpdates = sinon
        .stub()
        .callsArgWith(3, this.error, this.queueSize)
    })

    describe('when there is no existing error', function () {
      beforeEach(function (done) {
        this.ErrorRecorder.getLastFailure.yields()
        return this.UpdatesProcessor.processUpdatesForProject(
          this.project_id,
          done
        )
      })

      it('processes updates', function () {
        return this.UpdatesProcessor._mocks._countAndProcessUpdates
          .calledWith(this.project_id)
          .should.equal(true)
      })

      return it('records errors', function () {
        return this.ErrorRecorder.record
          .calledWith(this.project_id, this.queueSize, this.error)
          .should.equal(true)
      })
    })
  })

  describe('_getHistoryId', function () {
    describe('projectHistoryId is not present', function () {
      beforeEach(function () {
        this.updates = [
          { p: 0, i: 'a' },
          { p: 1, i: 's' },
        ]
        this.WebApiManager.getHistoryId.yields(null)
      })

      return it('returns null', function (done) {
        return this.UpdatesProcessor._getHistoryId(
          this.project_id,
          this.updates,
          (error, projectHistoryId) => {
            expect(error).to.be.null
            expect(projectHistoryId).to.be.null
            return done()
          }
        )
      })
    })

    describe('projectHistoryId is not present in updates', function () {
      beforeEach(function () {
        return (this.updates = [
          { p: 0, i: 'a' },
          { p: 1, i: 's' },
        ])
      })

      it('returns the id from web', function (done) {
        this.projectHistoryId = '1234'
        this.WebApiManager.getHistoryId.yields(null, this.projectHistoryId)

        return this.UpdatesProcessor._getHistoryId(
          this.project_id,
          this.updates,
          (error, projectHistoryId) => {
            expect(error).to.be.null
            expect(projectHistoryId).equal(this.projectHistoryId)
            return done()
          }
        )
      })

      return it('returns errors from web', function (done) {
        this.error = new Error('oh no!')
        this.WebApiManager.getHistoryId.yields(this.error)

        return this.UpdatesProcessor._getHistoryId(
          this.project_id,
          this.updates,
          error => {
            expect(error).to.equal(this.error)
            return done()
          }
        )
      })
    })

    return describe('projectHistoryId is present in some updates', function () {
      beforeEach(function () {
        this.projectHistoryId = '1234'
        return (this.updates = [
          { p: 0, i: 'a' },
          { p: 1, i: 's', projectHistoryId: this.projectHistoryId },
          { p: 2, i: 'd', projectHistoryId: this.projectHistoryId },
        ])
      })

      it('returns an error if the id is inconsistent between updates', function (done) {
        this.updates[1].projectHistoryId = 2345
        return this.UpdatesProcessor._getHistoryId(
          this.project_id,
          this.updates,
          error => {
            expect(error.message).to.equal(
              'inconsistent project history id between updates'
            )
            return done()
          }
        )
      })

      it('returns an error if the id is inconsistent between updates and web', function (done) {
        this.WebApiManager.getHistoryId.yields(null, 2345)
        return this.UpdatesProcessor._getHistoryId(
          this.project_id,
          this.updates,
          error => {
            expect(error.message).to.equal(
              'inconsistent project history id between updates and web'
            )
            return done()
          }
        )
      })

      it('returns the id if it is consistent between updates and web', function (done) {
        this.WebApiManager.getHistoryId.yields(null, this.projectHistoryId)
        return this.UpdatesProcessor._getHistoryId(
          this.project_id,
          this.updates,
          (error, projectHistoryId) => {
            expect(error).to.be.null
            expect(projectHistoryId).equal(this.projectHistoryId)
            return done()
          }
        )
      })

      return it('returns the id if it is consistent between updates but unavaiable in web', function (done) {
        this.WebApiManager.getHistoryId.yields(new Error('oh no!'))
        return this.UpdatesProcessor._getHistoryId(
          this.project_id,
          this.updates,
          (error, projectHistoryId) => {
            expect(error).to.be.null
            expect(projectHistoryId).equal(this.projectHistoryId)
            return done()
          }
        )
      })
    })
  })

  describe('_processUpdates', function () {
    return beforeEach(function () {
      this.mostRecentVersionInfo = { version: 1 }
      this.rawUpdates = ['raw updates']
      this.expandedUpdates = ['expanded updates']
      this.filteredUpdates = ['filtered updates']
      this.compressedUpdates = ['compressed updates']
      this.updatesWithBlobs = ['updates with blob']
      this.changes = ['changes']
      this.newSyncState = { resyncProjectStructure: false }

      this.extendLock = sinon.stub().yields()

      this.HistoryStoreManager.getMostRecentVersion.yields(
        null,
        this.mostRecentVersionInfo
      )
      this.SyncManager.skipUpdatesDuringSync.yields(
        null,
        this.filteredUpdates,
        this.newSyncState
      )
      this.SyncManager.expandSyncUpdates.yields(null, this.expandedUpdates)
      this.UpdateCompressor.compressRawUpdates.returns(this.compressedUpdates)
      this.BlobManager.createBlobForUpdates.yields(null, this.updatesWithBlobs)
      this.UpdateTranslator.convertToChanges.yields(null, this.changes)

      this.UpdatesProcessor._processUpdates(
        this.project_id,
        this.rawUpdates,
        this.extendLock,
        done
      )

      it('should get the latest version id', function () {
        return this.HistoryStoreManager.getMostRecentVersion
          .calledWith(this.project_id, this.ol_project_id)
          .should.equal(true)
      })

      it('should skip updates when resyncing', function () {
        return this.SyncManager.skipUpdatesDuringSync
          .calledWith(this.project_id, this.rawUpdates)
          .should.equal(true)
      })

      it('should expand sync updates', function () {
        return this.SyncManager.expandSyncUpdates
          .calledWith(
            this.project_id,
            this.ol_project_id,
            this.filteredUpdates,
            this.extendLock
          )
          .should.equal(true)
      })

      it('should compress updates', function () {
        return this.UpdateCompressor.compressRawUpdates
          .calledWith(this.expandedUpdates)
          .should.equal(true)
      })

      it('should not create any blobs', function () {
        return this.BlobManager.createBlobForUpdates
          .calledWith(this.project_id, this.compressedUpdates)
          .called.should.equal(false)
      })

      it('should convert the updates into a change requests', function () {
        return this.UpdateTranslator.convertToChanges
          .calledWith(
            this.project_id,
            this.updatesWithBlobs,
            this.mostRecentVersionInfo.version
          )
          .should.equal(true)
      })

      it('should send the change request to the history store', function () {
        return this.HistoryStoreManager.sendChanges
          .calledWith(this.project_id, this.ol_project_id, this.changes)
          .should.equal(true)
      })

      it('should set the sync state', function () {
        return this.SyncManager.setResyncState
          .calledWith(this.project_id, this.newSyncState)
          .should.equal(true)
      })

      return it('should call the callback with no error', function () {
        return this.callback.called.should.equal(true)
      })
    })
  })

  return describe('_skipAlreadyAppliedUpdates', function () {
    before(function () {
      this.UpdateTranslator.isProjectStructureUpdate.callsFake(
        update => update.version != null
      )
      this.UpdateTranslator.isTextUpdate.callsFake(update => update.v != null)
    })

    describe('with all doc ops in order', function () {
      before(function () {
        this.updates = [
          { doc: 'id', v: 1 },
          { doc: 'id', v: 2 },
          { doc: 'id', v: 3 },
          { doc: 'id', v: 4 },
        ]
        return (this.updatesToApply =
          this.UpdatesProcessor._skipAlreadyAppliedUpdates(
            this.project_id,
            this.updates,
            { docs: {} }
          ))
      })

      return it('should return the original updates', function () {
        return expect(this.updatesToApply).to.eql(this.updates)
      })
    })

    describe('with all project ops in order', function () {
      before(function () {
        this.updates = [
          { version: 1 },
          { version: 2 },
          { version: 3 },
          { version: 4 },
        ]
        return (this.updatesToApply =
          this.UpdatesProcessor._skipAlreadyAppliedUpdates(
            this.project_id,
            this.updates,
            { docs: {} }
          ))
      })

      return it('should return the original updates', function () {
        return expect(this.updatesToApply).to.eql(this.updates)
      })
    })

    describe('with all multiple doc and ops in order', function () {
      before(function () {
        this.updates = [
          { doc: 'id1', v: 1 },
          { doc: 'id1', v: 2 },
          { doc: 'id1', v: 3 },
          { doc: 'id1', v: 4 },
          { doc: 'id2', v: 1 },
          { doc: 'id2', v: 2 },
          { doc: 'id2', v: 3 },
          { doc: 'id2', v: 4 },
          { version: 1 },
          { version: 2 },
          { version: 3 },
          { version: 4 },
        ]
        return (this.updatesToApply =
          this.UpdatesProcessor._skipAlreadyAppliedUpdates(
            this.project_id,
            this.updates,
            { docs: {} }
          ))
      })

      return it('should return the original updates', function () {
        return expect(this.updatesToApply).to.eql(this.updates)
      })
    })

    describe('with doc ops out of order', function () {
      before(function () {
        this.updates = [
          { doc: 'id', v: 1 },
          { doc: 'id', v: 2 },
          { doc: 'id', v: 4 },
          { doc: 'id', v: 3 },
        ]
        this.skipFn = sinon.spy(
          this.UpdatesProcessor._mocks,
          '_skipAlreadyAppliedUpdates'
        )
        try {
          return (this.updatesToApply =
            this.UpdatesProcessor._skipAlreadyAppliedUpdates(
              this.project_id,
              this.updates,
              { docs: {} }
            ))
        } catch (error) {}
      })

      after(function () {
        return this.skipFn.restore()
      })

      return it('should throw an exception', function () {
        return this.skipFn.threw('OpsOutOfOrderError').should.equal(true)
      })
    })

    return describe('with project ops out of order', function () {
      before(function () {
        this.updates = [
          { version: 1 },
          { version: 2 },
          { version: 4 },
          { version: 3 },
        ]
        this.skipFn = sinon.spy(
          this.UpdatesProcessor._mocks,
          '_skipAlreadyAppliedUpdates'
        )
        try {
          return (this.updatesToApply =
            this.UpdatesProcessor._skipAlreadyAppliedUpdates(
              this.project_id,
              this.updates,
              { docs: {} }
            ))
        } catch (error) {}
      })

      after(function () {
        return this.skipFn.restore()
      })

      return it('should throw an exception', function () {
        return this.skipFn.threw('OpsOutOfOrderError').should.equal(true)
      })
    })
  })
})
