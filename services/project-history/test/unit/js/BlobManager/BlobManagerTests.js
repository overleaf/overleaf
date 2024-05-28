import sinon from 'sinon'
import { strict as esmock } from 'esmock'

const MODULE_PATH = '../../../../app/js/BlobManager.js'

describe('BlobManager', function () {
  beforeEach(async function () {
    this.callback = sinon.stub()
    this.extendLock = sinon.stub().yields()
    this.project_id = 'project-1'
    this.historyId = 12345
    this.HistoryStoreManager = {
      createBlobForUpdate: sinon.stub(),
    }
    this.UpdateTranslator = {
      isAddUpdate: sinon.stub().returns(false),
    }
    this.BlobManager = await esmock(MODULE_PATH, {
      '../../../../app/js/HistoryStoreManager.js': this.HistoryStoreManager,
      '../../../../app/js/UpdateTranslator.js': this.UpdateTranslator,
    })
    this.updates = ['update-1', 'update-2']
  })

  describe('createBlobsForUpdates', function () {
    describe('when there are no blobs to create', function () {
      beforeEach(function (done) {
        this.BlobManager.createBlobsForUpdates(
          this.project_id,
          this.historyId,
          this.updates,
          this.extendLock,
          (error, updatesWithBlobs) => {
            this.callback(error, updatesWithBlobs)
            done()
          }
        )
      })

      it('should not create any blobs', function () {
        this.HistoryStoreManager.createBlobForUpdate.called.should.equal(false)
      })

      it('should call the callback with the updates', function () {
        const updatesWithBlobs = this.updates.map(update => ({
          update,
        }))
        this.callback.calledWith(null, updatesWithBlobs).should.equal(true)
      })
    })

    describe('when there are blobs to create', function () {
      beforeEach(function (done) {
        this.UpdateTranslator.isAddUpdate.returns(true)
        this.blobHash = 'test hash'
        this.HistoryStoreManager.createBlobForUpdate.yields(null, {
          file: this.blobHash,
        })
        this.BlobManager.createBlobsForUpdates(
          this.project_id,
          this.historyId,
          this.updates,
          this.extendLock,
          (error, updatesWithBlobs) => {
            this.callback(error, updatesWithBlobs)
            done()
          }
        )
      })

      it('should create blobs', function () {
        this.HistoryStoreManager.createBlobForUpdate
          .calledWith(this.project_id, this.historyId, this.updates[0])
          .should.equal(true)
      })

      it('should extend the lock', function () {
        this.extendLock.called.should.equal(true)
      })

      it('should call the callback with the updates', function () {
        const updatesWithBlobs = this.updates.map(update => ({
          update,
          blobHashes: { file: this.blobHash },
        }))
        this.callback.calledWith(null, updatesWithBlobs).should.equal(true)
      })
    })

    describe('when there are blobs to create and there is a single network error', function () {
      beforeEach(function (done) {
        this.UpdateTranslator.isAddUpdate.returns(true)
        this.blobHash = 'test hash'
        this.HistoryStoreManager.createBlobForUpdate
          .onFirstCall()
          .yields(new Error('random failure'))
        this.HistoryStoreManager.createBlobForUpdate.yields(null, {
          file: this.blobHash,
        })
        this.BlobManager.createBlobsForUpdates(
          this.project_id,
          this.historyId,
          this.updates,
          this.extendLock,
          (error, updatesWithBlobs) => {
            this.callback(error, updatesWithBlobs)
            done()
          }
        )
      })

      it('should create blobs', function () {
        this.HistoryStoreManager.createBlobForUpdate
          .calledWith(this.project_id, this.historyId, this.updates[0])
          .should.equal(true)
      })

      it('should extend the lock', function () {
        this.extendLock.called.should.equal(true)
      })

      it('should call the callback with the updates', function () {
        const updatesWithBlobs = this.updates.map(update => ({
          update,
          blobHashes: { file: this.blobHash },
        }))
        this.callback.calledWith(null, updatesWithBlobs).should.equal(true)
      })
    })

    describe('when there are blobs to create and there are multiple network errors', function () {
      beforeEach(function (done) {
        this.UpdateTranslator.isAddUpdate.returns(true)
        this.blobHash = 'test hash'
        this.error = new Error('random failure')
        this.HistoryStoreManager.createBlobForUpdate.yields(this.error)
        this.BlobManager.createBlobsForUpdates(
          this.project_id,
          this.historyId,
          this.updates,
          this.extendLock,
          (error, updatesWithBlobs) => {
            this.callback(error, updatesWithBlobs)
            done()
          }
        )
      })

      it('should try to create blobs', function () {
        this.HistoryStoreManager.createBlobForUpdate
          .calledWith(this.project_id, this.historyId, this.updates[0])
          .should.equal(true)
      })

      it('should call the callback with an error', function () {
        this.callback.calledWith(this.error).should.equal(true)
      })
    })
  })
})
