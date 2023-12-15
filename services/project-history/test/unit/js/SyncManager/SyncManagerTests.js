import sinon from 'sinon'
import { expect } from 'chai'
import mongodb from 'mongodb-legacy'
import tk from 'timekeeper'
import { strict as esmock } from 'esmock'
const { ObjectId } = mongodb

const MODULE_PATH = '../../../../app/js/SyncManager.js'

const timestamp = new Date()

const resyncProjectStructureUpdate = (docs, files) => ({
  resyncProjectStructure: { docs, files },

  meta: {
    ts: timestamp,
  },
})

const docContentSyncUpdate = (doc, content) => ({
  path: doc.path,
  doc: doc.doc,

  resyncDocContent: {
    content,
  },

  meta: {
    ts: timestamp,
  },
})

describe('SyncManager', function () {
  beforeEach(async function () {
    this.now = new Date()
    tk.freeze(this.now)
    this.projectId = new ObjectId().toString()
    this.historyId = 'mock-overleaf-id'
    this.syncState = { origin: { kind: 'history-resync' } }
    this.db = {
      projectHistorySyncState: {
        findOne: sinon.stub().yields(null, this.syncState),
        updateOne: sinon.stub().yields(),
      },
    }
    this.callback = sinon.stub()
    this.extendLock = sinon.stub().yields()
    this.LockManager = {
      runWithLock: sinon.spy((key, runner, callback) => {
        runner(this.extendLock, callback)
      }),
    }
    this.UpdateCompressor = {
      diffAsShareJsOps: sinon.stub(),
    }
    this.UpdateTranslator = {
      isTextUpdate: sinon.stub(),
      _convertPathname: sinon.stub(),
    }
    this.WebApiManager = {
      getHistoryId: sinon.stub(),
      requestResync: sinon.stub().yields(),
    }
    this.WebApiManager.getHistoryId
      .withArgs(this.projectId)
      .yields(null, this.historyId)
    this.ErrorRecorder = {
      record: sinon.stub().yields(),
      recordSyncStart: sinon.stub().yields(),
    }
    this.RedisManager = {}
    this.SnapshotManager = {
      getLatestSnapshot: sinon.stub(),
    }
    this.HistoryStoreManager = {
      getBlobStore: sinon.stub(),
      _getBlobHashFromString: sinon.stub().returns('random-hash'),
    }
    this.HashManager = {
      _getBlobHashFromString: sinon.stub(),
    }
    this.Metrics = { inc: sinon.stub() }
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
    this.SyncManager = await esmock(MODULE_PATH, {
      '../../../../app/js/LockManager.js': this.LockManager,
      '../../../../app/js/UpdateCompressor.js': this.UpdateCompressor,
      '../../../../app/js/UpdateTranslator.js': this.UpdateTranslator,
      '../../../../app/js/mongodb.js': { ObjectId, db: this.db },
      '../../../../app/js/WebApiManager.js': this.WebApiManager,
      '../../../../app/js/ErrorRecorder.js': this.ErrorRecorder,
      '../../../../app/js/RedisManager.js': this.RedisManager,
      '../../../../app/js/SnapshotManager.js': this.SnapshotManager,
      '../../../../app/js/HistoryStoreManager.js': this.HistoryStoreManager,
      '../../../../app/js/HashManager.js': this.HashManager,
      '@overleaf/metrics': this.Metrics,
      '@overleaf/settings': this.Settings,
    })
  })

  afterEach(function () {
    tk.reset()
  })

  describe('startResync', function () {
    describe('if a sync is not in progress', function () {
      beforeEach(function () {
        this.db.projectHistorySyncState.findOne.yields(null, {})
        this.SyncManager.startResync(this.projectId, this.callback)
      })

      it('takes the project lock', function () {
        expect(this.LockManager.runWithLock).to.have.been.calledWith(
          `ProjectHistoryLock:${this.projectId}`
        )
      })

      it('gets the sync state from mongo', function () {
        expect(this.db.projectHistorySyncState.findOne).to.have.been.calledWith(
          { project_id: new ObjectId(this.projectId) }
        )
      })

      it('requests a resync from web', function () {
        expect(this.WebApiManager.requestResync).to.have.been.calledWith(
          this.projectId
        )
      })

      it('sets the sync state in mongo and prevents it expiring', function () {
        expect(
          this.db.projectHistorySyncState.updateOne
        ).to.have.been.calledWith(
          {
            project_id: new ObjectId(this.projectId),
          },
          sinon.match({
            $set: {
              resyncProjectStructure: true,
              resyncDocContents: [],
              origin: { kind: 'history-resync' },
            },
            $currentDate: { lastUpdated: true },
            $inc: { resyncCount: 1 },
            $unset: { expiresAt: true },
          }),
          {
            upsert: true,
          }
        )
      })

      it('calls the callback', function () {
        expect(this.callback).to.have.been.called
      })
    })

    describe('if project structure sync is in progress', function () {
      beforeEach(function () {
        const syncState = { resyncProjectStructure: true }
        this.db.projectHistorySyncState.findOne.yields(null, syncState)
        this.SyncManager.startResync(this.projectId, this.callback)
      })

      it('returns an error if already syncing', function () {
        expect(this.callback).to.have.been.calledWithMatch({
          message: 'sync ongoing',
        })
      })
    })

    describe('if doc content sync in is progress', function () {
      beforeEach(function () {
        const syncState = { resyncDocContents: ['/foo.tex'] }
        this.db.projectHistorySyncState.findOne.yields(null, syncState)
        this.SyncManager.startResync(this.projectId, this.callback)
      })

      it('returns an error if already syncing', function () {
        expect(this.callback).to.have.been.calledWithMatch({
          message: 'sync ongoing',
        })
      })
    })
  })

  describe('setResyncState', function () {
    describe('when the sync is starting', function () {
      beforeEach(function () {
        this.syncState = {
          toRaw() {
            return {
              resyncProjectStructure: true,
              resyncDocContents: [],
              origin: { kind: 'history-resync' },
            }
          },
          isSyncOngoing: sinon.stub().returns(true),
        }
      })

      it('sets the sync state in mongo and prevents it expiring', function (done) {
        // SyncState is a private class of SyncManager
        // we know the interface however:
        this.SyncManager.setResyncState(
          this.projectId,
          this.syncState,
          error => {
            expect(error).to.be.undefined
            expect(
              this.db.projectHistorySyncState.updateOne
            ).to.have.been.calledWith(
              {
                project_id: new ObjectId(this.projectId),
              },
              sinon.match({
                $set: this.syncState.toRaw(),
                $currentDate: { lastUpdated: true },
                $inc: { resyncCount: 1 },
                $unset: { expiresAt: true },
              }),
              {
                upsert: true,
              }
            )
            done()
          }
        )
      })
    })

    describe('when the sync is ending', function () {
      beforeEach(function () {
        this.syncState = {
          toRaw() {
            return {
              resyncProjectStructure: false,
              resyncDocContents: [],
              origin: { kind: 'history-resync' },
            }
          },
          isSyncOngoing: sinon.stub().returns(false),
        }
      })

      it('sets the sync state entry in mongo to expire', function (done) {
        this.SyncManager.setResyncState(
          this.projectId,
          this.syncState,
          error => {
            expect(error).to.be.undefined
            expect(
              this.db.projectHistorySyncState.updateOne
            ).to.have.been.calledWith(
              {
                project_id: new ObjectId(this.projectId),
              },
              sinon.match({
                $set: {
                  resyncProjectStructure: false,
                  resyncDocContents: [],
                  origin: { kind: 'history-resync' },
                  expiresAt: new Date(
                    this.now.getTime() + 90 * 24 * 3600 * 1000
                  ),
                },
                $currentDate: { lastUpdated: true },
              }),
              {
                upsert: true,
              }
            )
            done()
          }
        )
      })
    })

    describe('when the new sync state is null', function () {
      it('does not update the sync state in mongo', function (done) {
        // SyncState is a private class of SyncManager
        // we know the interface however:
        this.SyncManager.setResyncState(this.projectId, null, error => {
          expect(error).to.be.undefined
          expect(this.db.projectHistorySyncState.updateOne).to.not.have.been
            .called
          done()
        })
      })
    })
  })

  describe('skipUpdatesDuringSync', function () {
    describe('if a sync is not in progress', function () {
      beforeEach(function () {
        this.db.projectHistorySyncState.findOne.yields(null, {})
        this.updates = ['some', 'mock', 'updates']
        this.SyncManager.skipUpdatesDuringSync(
          this.projectId,
          this.updates,
          this.callback
        )
      })

      it('returns all updates', function () {
        expect(this.callback).to.have.been.calledWith(null, this.updates)
      })

      it('should not return any newSyncState', function () {
        expect(this.callback).to.have.been.calledWithExactly(null, this.updates)
      })
    })

    describe('if a sync in is progress', function () {
      beforeEach(function () {
        this.renameUpdate = {
          pathname: 'old.tex',
          newPathname: 'new.tex',
        }
        this.projectStructureSyncUpdate = {
          resyncProjectStructure: {
            docs: [{ path: 'new.tex' }],
            files: [],
          },
        }
        this.textUpdate = {
          doc: new ObjectId(),
          op: [{ i: 'a', p: 4 }],
          meta: {
            pathname: 'new.tex',
            doc_length: 4,
          },
        }
        this.docContentSyncUpdate = {
          path: 'new.tex',
          resyncDocContent: {
            content: 'a',
          },
        }
        this.UpdateTranslator.isTextUpdate
          .withArgs(this.renameUpdate)
          .returns(false)
        this.UpdateTranslator.isTextUpdate
          .withArgs(this.projectStructureSyncUpdate)
          .returns(false)
        this.UpdateTranslator.isTextUpdate
          .withArgs(this.docContentSyncUpdate)
          .returns(false)
        this.UpdateTranslator.isTextUpdate
          .withArgs(this.textUpdate)
          .returns(true)

        const syncState = {
          resyncProjectStructure: true,
          resyncDocContents: [],
          origin: { kind: 'history-resync' },
        }
        this.db.projectHistorySyncState.findOne.yields(null, syncState)
      })

      it('remove updates before a project structure sync update', function () {
        const updates = [
          this.renameUpdate,
          this.textUpdate,
          this.projectStructureSyncUpdate,
        ]
        this.SyncManager.skipUpdatesDuringSync(
          this.projectId,
          updates,
          (error, filteredUpdates, syncState) => {
            expect(error).to.be.null
            expect(filteredUpdates).to.deep.equal([
              this.projectStructureSyncUpdate,
            ])
            expect(syncState.toRaw()).to.deep.equal({
              resyncProjectStructure: false,
              resyncDocContents: ['new.tex'],
              origin: { kind: 'history-resync' },
            })
          }
        )
      })

      it('allow project structure updates after project structure sync update', function () {
        const updates = [this.projectStructureSyncUpdate, this.renameUpdate]
        this.SyncManager.skipUpdatesDuringSync(
          this.projectId,
          updates,
          (error, filteredUpdates, syncState) => {
            expect(error).to.be.null
            expect(filteredUpdates).to.deep.equal([
              this.projectStructureSyncUpdate,
              this.renameUpdate,
            ])
            expect(syncState.toRaw()).to.deep.equal({
              resyncProjectStructure: false,
              resyncDocContents: ['new.tex'],
              origin: { kind: 'history-resync' },
            })
          }
        )
      })

      it('remove text updates for a doc before doc sync update', function () {
        const updates = [
          this.projectStructureSyncUpdate,
          this.textUpdate,
          this.docContentSyncUpdate,
        ]
        this.SyncManager.skipUpdatesDuringSync(
          this.projectId,
          updates,
          (error, filteredUpdates, syncState) => {
            expect(error).to.be.null
            expect(filteredUpdates).to.deep.equal([
              this.projectStructureSyncUpdate,
              this.docContentSyncUpdate,
            ])
            expect(syncState.toRaw()).to.deep.equal({
              resyncProjectStructure: false,
              resyncDocContents: [],
              origin: { kind: 'history-resync' },
            })
          }
        )
      })

      it('allow text updates for a doc after doc sync update', function () {
        const updates = [
          this.projectStructureSyncUpdate,
          this.docContentSyncUpdate,
          this.textUpdate,
        ]
        this.SyncManager.skipUpdatesDuringSync(
          this.projectId,
          updates,
          (error, filteredUpdates, syncState) => {
            expect(error).to.be.null
            expect(filteredUpdates).to.deep.equal([
              this.projectStructureSyncUpdate,
              this.docContentSyncUpdate,
              this.textUpdate,
            ])
            expect(syncState.toRaw()).to.deep.equal({
              resyncProjectStructure: false,
              resyncDocContents: [],
              origin: { kind: 'history-resync' },
            })
          }
        )
      })
    })
  })

  describe('expandSyncUpdates', function () {
    beforeEach(function () {
      this.persistedDoc = {
        doc: { data: { hash: 'abcdef' } },
        path: 'main.tex',
        content: 'asdf',
      }
      this.persistedFile = {
        file: { data: { hash: '123456789a' } },
        path: '1.png',
      }
      this.fileMap = {
        'main.tex': {
          isEditable: sinon.stub().returns(true),
          content: this.persistedDoc.content,
        },
        '1.png': {
          isEditable: sinon.stub().returns(false),
          data: { hash: this.persistedFile.file.data.hash },
        },
      }
      this.UpdateTranslator._convertPathname
        .withArgs('main.tex')
        .returns('main.tex')
      this.UpdateTranslator._convertPathname
        .withArgs('/main.tex')
        .returns('main.tex')
      this.UpdateTranslator._convertPathname
        .withArgs('another.tex')
        .returns('another.tex')
      this.UpdateTranslator._convertPathname.withArgs('1.png').returns('1.png')
      this.UpdateTranslator._convertPathname.withArgs('2.png').returns('2.png')
      this.SnapshotManager.getLatestSnapshot.yields(null, this.fileMap)
    })

    it('returns updates if no sync updates are queued', function () {
      const updates = ['some', 'mock', 'updates']
      this.SyncManager.expandSyncUpdates(
        this.projectId,
        this.historyId,
        updates,
        this.extendLock,
        (error, expandedUpdates) => {
          expect(error).to.be.null
          expect(expandedUpdates).to.equal(updates)
          expect(this.SnapshotManager.getLatestSnapshot).to.not.have.been.called
          expect(this.extendLock).to.not.have.been.called
        }
      )
    })

    describe('expanding project structure sync updates', function () {
      it('queues nothing for expected docs and files', function () {
        const updates = [
          resyncProjectStructureUpdate(
            [this.persistedDoc],
            [this.persistedFile]
          ),
        ]
        this.SyncManager.expandSyncUpdates(
          this.projectId,
          this.historyId,
          updates,
          this.extendLock,
          (error, expandedUpdates) => {
            expect(error).to.be.null
            expect(expandedUpdates).to.deep.equal([])
            expect(this.extendLock).to.have.been.called
          }
        )
      })

      it('queues file removes for unexpected files', function () {
        const updates = [resyncProjectStructureUpdate([this.persistedDoc], [])]
        this.SyncManager.expandSyncUpdates(
          this.projectId,
          this.historyId,
          updates,
          this.extendLock,
          (error, expandedUpdates) => {
            expect(error).to.be.null
            expect(expandedUpdates).to.deep.equal([
              {
                pathname: this.persistedFile.path,
                new_pathname: '',
                meta: {
                  resync: true,
                  ts: timestamp,
                  origin: { kind: 'history-resync' },
                },
              },
            ])
            expect(this.extendLock).to.have.been.called
          }
        )
      })

      it('queues doc removes for unexpected docs', function () {
        const updates = [resyncProjectStructureUpdate([], [this.persistedFile])]
        this.SyncManager.expandSyncUpdates(
          this.projectId,
          this.historyId,
          updates,
          this.extendLock,
          (error, expandedUpdates) => {
            expect(error).to.be.null
            expect(expandedUpdates).to.deep.equal([
              {
                pathname: this.persistedDoc.path,
                new_pathname: '',
                meta: {
                  resync: true,
                  ts: timestamp,
                  origin: { kind: 'history-resync' },
                },
              },
            ])
            expect(this.extendLock).to.have.been.called
          }
        )
      })

      it('queues file additions for missing files', function () {
        const newFile = {
          path: '2.png',
          file: {},
          url: 'filestore/2.png',
        }
        const updates = [
          resyncProjectStructureUpdate(
            [this.persistedDoc],
            [this.persistedFile, newFile]
          ),
        ]
        this.SyncManager.expandSyncUpdates(
          this.projectId,
          this.historyId,
          updates,
          this.extendLock,
          (error, expandedUpdates) => {
            expect(error).to.be.null
            expect(expandedUpdates).to.deep.equal([
              {
                pathname: newFile.path,
                file: newFile.file,
                url: newFile.url,
                meta: {
                  resync: true,
                  ts: timestamp,
                  origin: { kind: 'history-resync' },
                },
              },
            ])
            expect(this.extendLock).to.have.been.called
          }
        )
      })

      it('queues blank doc additions for missing docs', function () {
        const newDoc = {
          path: 'another.tex',
          doc: new ObjectId().toString(),
        }
        const updates = [
          resyncProjectStructureUpdate(
            [this.persistedDoc, newDoc],
            [this.persistedFile]
          ),
        ]
        this.SyncManager.expandSyncUpdates(
          this.projectId,
          this.historyId,
          updates,
          this.extendLock,
          (error, expandedUpdates) => {
            expect(error).to.be.null
            expect(expandedUpdates).to.deep.equal([
              {
                pathname: newDoc.path,
                doc: newDoc.doc,
                docLines: '',
                meta: {
                  resync: true,
                  ts: timestamp,
                  origin: { kind: 'history-resync' },
                },
              },
            ])
            expect(this.extendLock).to.have.been.called
          }
        )
      })

      it('removes and re-adds files if whether they are binary differs', function () {
        const fileWichWasADoc = {
          path: this.persistedDoc.path,
          url: 'filestore/2.png',
          _hash: 'other-hash',
        }

        const updates = [
          resyncProjectStructureUpdate(
            [],
            [fileWichWasADoc, this.persistedFile]
          ),
        ]
        this.SyncManager.expandSyncUpdates(
          this.projectId,
          this.historyId,
          updates,
          this.extendLock,
          (error, expandedUpdates) => {
            expect(error).to.be.null
            expect(expandedUpdates).to.deep.equal([
              {
                pathname: fileWichWasADoc.path,
                new_pathname: '',
                meta: {
                  resync: true,
                  ts: timestamp,
                  origin: { kind: 'history-resync' },
                },
              },
              {
                pathname: fileWichWasADoc.path,
                file: fileWichWasADoc.file,
                url: fileWichWasADoc.url,
                meta: {
                  resync: true,
                  ts: timestamp,
                  origin: { kind: 'history-resync' },
                },
              },
            ])
            expect(this.extendLock).to.have.been.called
          }
        )
      })

      it("does not remove and re-add files if the expected file doesn't have a hash", function () {
        const fileWichWasADoc = {
          path: this.persistedDoc.path,
          url: 'filestore/2.png',
        }

        const updates = [
          resyncProjectStructureUpdate(
            [],
            [fileWichWasADoc, this.persistedFile]
          ),
        ]
        this.SyncManager.expandSyncUpdates(
          this.projectId,
          this.historyId,
          updates,
          this.extendLock,
          (error, expandedUpdates) => {
            expect(error).to.be.null
            expect(expandedUpdates).to.deep.equal([])
            expect(this.extendLock).to.have.been.called
          }
        )
      })

      it('does not remove and re-add editable files if there is a binary file with same hash', function () {
        const binaryFile = {
          file: Object().toString(),
          // The paths in the resyncProjectStructureUpdate must have a leading slash ('/')
          // The other unit tests in this file are incorrectly missing the leading slash.
          // The leading slash is present in web where the paths are created with
          // ProjectEntityHandler.getAllEntitiesFromProject in ProjectEntityUpdateHandler.resyncProjectHistory.
          path: '/' + this.persistedDoc.path,
          url: 'filestore/12345',
          _hash: 'abcdef',
        }
        this.fileMap['main.tex'].data = { hash: 'abcdef' }

        const updates = [
          resyncProjectStructureUpdate([], [binaryFile, this.persistedFile]),
        ]
        this.SyncManager.expandSyncUpdates(
          this.projectId,
          this.historyId,
          updates,
          this.extendLock,
          (error, expandedUpdates) => {
            expect(error).to.be.null
            expect(expandedUpdates).to.deep.equal([])
            expect(this.extendLock).to.have.been.called
          }
        )
      })

      it('removes and re-adds binary files if they do not have same hash', function () {
        const persistedFileWithNewContent = {
          _hash: 'anotherhashvalue',
          hello: 'world',
          path: '1.png',
          url: 'filestore-new-url',
        }
        const updates = [
          resyncProjectStructureUpdate(
            [this.persistedDoc],
            [persistedFileWithNewContent]
          ),
        ]
        this.SyncManager.expandSyncUpdates(
          this.projectId,
          this.historyId,
          updates,
          this.extendLock,
          (error, expandedUpdates) => {
            expect(error).to.be.null
            expect(expandedUpdates).to.deep.equal([
              {
                pathname: persistedFileWithNewContent.path,
                new_pathname: '',
                meta: {
                  resync: true,
                  ts: timestamp,
                  origin: { kind: 'history-resync' },
                },
              },
              {
                pathname: persistedFileWithNewContent.path,
                file: persistedFileWithNewContent.file,
                url: persistedFileWithNewContent.url,
                meta: {
                  resync: true,
                  ts: timestamp,
                  origin: { kind: 'history-resync' },
                },
              },
            ])
            expect(this.extendLock).to.have.been.called
          }
        )
      })

      it('preserves other updates', function () {
        const update = 'mock-update'
        const updates = [
          update,
          resyncProjectStructureUpdate(
            [this.persistedDoc],
            [this.persistedFile]
          ),
        ]
        this.SyncManager.expandSyncUpdates(
          this.projectId,
          this.historyId,
          updates,
          this.extendLock,
          (error, expandedUpdates) => {
            expect(error).to.be.null
            expect(expandedUpdates).to.deep.equal([update])
            expect(this.extendLock).to.have.been.called
          }
        )
      })
    })

    describe('expanding doc contents sync updates', function () {
      it('returns errors from diffAsShareJsOps', function () {
        const diffError = new Error('test')
        this.UpdateCompressor.diffAsShareJsOps.throws(diffError)
        const updates = [
          resyncProjectStructureUpdate(
            [this.persistedDoc],
            [this.persistedFile]
          ),
          docContentSyncUpdate(this.persistedDoc, this.persistedDoc.content),
        ]
        this.SyncManager.expandSyncUpdates(
          this.projectId,
          this.historyId,
          updates,
          this.extendLock,
          (error, expandedUpdates) => {
            expect(error).to.equal(diffError)
            expect(this.extendLock).to.have.been.called
          }
        )
      })

      it('handles an update for a file that is missing from the snapshot', function () {
        const updates = [docContentSyncUpdate('not-in-snapshot.txt', 'test')]
        this.SyncManager.expandSyncUpdates(
          this.projectId,
          this.historyId,
          updates,
          this.extendLock,
          (error, expandedUpdates) => {
            expect(error).to.exist
            expect(error.message).to.equal('unrecognised file: not in snapshot')
          }
        )
      })

      it('queues nothing for in docs whose contents is in sync', function () {
        const updates = [
          resyncProjectStructureUpdate(
            [this.persistedDoc],
            [this.persistedFile]
          ),
          docContentSyncUpdate(this.persistedDoc, this.persistedDoc.content),
        ]
        this.UpdateCompressor.diffAsShareJsOps.returns([])
        this.SyncManager.expandSyncUpdates(
          this.projectId,
          this.historyId,
          updates,
          this.extendLock,
          (error, expandedUpdates) => {
            expect(error).to.be.null
            expect(expandedUpdates).to.deep.equal([])
            expect(this.extendLock).to.have.been.called
          }
        )
      })

      it('queues text updates for docs whose contents is out of sync', function () {
        const updates = [
          resyncProjectStructureUpdate(
            [this.persistedDoc],
            [this.persistedFile]
          ),
          docContentSyncUpdate(this.persistedDoc, 'a'),
        ]
        this.UpdateCompressor.diffAsShareJsOps.returns([{ d: 'sdf', p: 1 }])
        this.SyncManager.expandSyncUpdates(
          this.projectId,
          this.historyId,
          updates,
          this.extendLock,
          (error, expandedUpdates) => {
            expect(error).to.be.null
            expect(expandedUpdates).to.deep.equal([
              {
                doc: this.persistedDoc.doc,
                op: [{ d: 'sdf', p: 1 }],
                meta: {
                  pathname: this.persistedDoc.path,
                  doc_length: 4,
                  resync: true,
                  ts: timestamp,
                  origin: { kind: 'history-resync' },
                },
              },
            ])
            expect(this.extendLock).to.have.been.called
          }
        )
      })

      it('queues text updates for docs created by project structure sync', function () {
        this.UpdateCompressor.diffAsShareJsOps.returns([{ i: 'a', p: 0 }])
        const newDoc = {
          path: 'another.tex',
          doc: new ObjectId().toString(),
          content: 'a',
        }
        const updates = [
          resyncProjectStructureUpdate(
            [this.persistedDoc, newDoc],
            [this.persistedFile]
          ),
          docContentSyncUpdate(newDoc, newDoc.content),
        ]
        this.SyncManager.expandSyncUpdates(
          this.projectId,
          this.historyId,
          updates,
          this.extendLock,
          (error, expandedUpdates) => {
            expect(error).to.be.null
            expect(expandedUpdates).to.deep.equal([
              {
                pathname: newDoc.path,
                doc: newDoc.doc,
                docLines: '',
                meta: {
                  resync: true,
                  ts: timestamp,
                  origin: { kind: 'history-resync' },
                },
              },
              {
                doc: newDoc.doc,
                op: [{ i: 'a', p: 0 }],
                meta: {
                  pathname: newDoc.path,
                  doc_length: 0,
                  resync: true,
                  ts: timestamp,
                  origin: { kind: 'history-resync' },
                },
              },
            ])
            expect(this.extendLock).to.have.been.called
          }
        )
      })

      it('skips text updates for docs when hashes match', function () {
        this.fileMap['main.tex'].getHash = sinon.stub().returns('special-hash')
        this.HashManager._getBlobHashFromString.returns('special-hash')
        const updates = [
          resyncProjectStructureUpdate(
            [this.persistedDoc],
            [this.persistedFile]
          ),
          docContentSyncUpdate(this.persistedDoc, 'hello'),
        ]
        this.SyncManager.expandSyncUpdates(
          this.projectId,
          this.historyId,
          updates,
          this.extendLock,
          (error, expandedUpdates) => {
            expect(error).to.be.null
            expect(expandedUpdates).to.deep.equal([])
            expect(this.extendLock).to.have.been.called
          }
        )
      })

      it('computes text updates for docs when hashes differ', function () {
        this.fileMap['main.tex'].getHash = sinon.stub().returns('first-hash')
        this.HashManager._getBlobHashFromString.returns('second-hash')
        this.UpdateCompressor.diffAsShareJsOps.returns([
          { i: 'test diff', p: 0 },
        ])
        const updates = [
          resyncProjectStructureUpdate(
            [this.persistedDoc],
            [this.persistedFile]
          ),
          docContentSyncUpdate(this.persistedDoc, 'hello'),
        ]
        this.SyncManager.expandSyncUpdates(
          this.projectId,
          this.historyId,
          updates,
          this.extendLock,
          (error, expandedUpdates) => {
            expect(error).to.be.null
            expect(expandedUpdates).to.deep.equal([
              {
                doc: this.persistedDoc.doc,
                op: [{ i: 'test diff', p: 0 }],
                meta: {
                  pathname: this.persistedDoc.path,
                  doc_length: 4,
                  resync: true,
                  ts: timestamp,
                  origin: { kind: 'history-resync' },
                },
              },
            ])
            expect(this.extendLock).to.have.been.called
          }
        )
      })

      describe('for docs whose contents is out of sync', function () {
        beforeEach(function (done) {
          const updates = [
            resyncProjectStructureUpdate(
              [this.persistedDoc],
              [this.persistedFile]
            ),
            docContentSyncUpdate(this.persistedDoc, 'a'),
          ]
          const file = { getContent: sinon.stub().returns('stored content') }
          this.fileMap['main.tex'].load = sinon.stub().resolves(file)
          this.UpdateCompressor.diffAsShareJsOps.returns([{ d: 'sdf', p: 1 }])
          this.SyncManager.expandSyncUpdates(
            this.projectId,
            this.historyId,
            updates,
            this.extendLock,
            (error, expandedUpdates) => {
              this.error = error
              this.expandedUpdates = expandedUpdates
              done()
            }
          )
        })

        it('loads content from the history service when needed', function () {
          expect(this.error).to.be.null
          expect(this.expandedUpdates).to.deep.equal([
            {
              doc: this.persistedDoc.doc,
              op: [{ d: 'sdf', p: 1 }],
              meta: {
                pathname: this.persistedDoc.path,
                doc_length: 'stored content'.length,
                resync: true,
                ts: timestamp,
                origin: { kind: 'history-resync' },
              },
            },
          ])
          expect(this.extendLock).to.have.been.called
        })
      })
    })
  })
})
