import sinon from 'sinon'
import { expect } from 'chai'
import mongodb from 'mongodb-legacy'
import tk from 'timekeeper'
import { Comment, Range } from 'overleaf-editor-core'
import { strict as esmock } from 'esmock'
const { ObjectId } = mongodb

const MODULE_PATH = '../../../../app/js/SyncManager.js'

const timestamp = new Date()

function resyncProjectStructureUpdate(docs, files) {
  return {
    resyncProjectStructure: { docs, files },

    meta: {
      ts: timestamp,
    },
  }
}

function docContentSyncUpdate(
  doc,
  content,
  ranges = {},
  resolvedComments = []
) {
  return {
    path: doc.path,
    doc: doc.doc,

    resyncDocContent: {
      content,
      ranges,
      resolvedComments,
    },

    meta: {
      ts: timestamp,
    },
  }
}

function makeComment(commentId, pos, text) {
  return {
    id: commentId,
    op: { p: pos, c: text, t: commentId },
    meta: {
      ts: timestamp,
    },
  }
}

describe('SyncManager', function () {
  beforeEach(async function () {
    this.now = new Date()
    tk.freeze(this.now)
    this.projectId = new ObjectId().toString()
    this.historyId = 'mock-overleaf-id'
    this.syncState = { origin: { kind: 'history-resync' } }
    this.db = {
      projectHistorySyncState: {
        findOne: sinon.stub().resolves(this.syncState),
        updateOne: sinon.stub().resolves(),
      },
    }
    this.extendLock = sinon.stub().resolves()

    this.LockManager = {
      promises: {
        runWithLock: sinon.stub().callsFake(async (key, runner) => {
          await runner(this.extendLock)
        }),
      },
    }

    this.UpdateCompressor = {
      diffAsShareJsOps: sinon.stub().returns([]),
    }

    this.UpdateTranslator = {
      isTextUpdate: sinon.stub(),
      _convertPathname: sinon.stub(),
    }

    this.WebApiManager = {
      promises: {
        getHistoryId: sinon.stub(),
        requestResync: sinon.stub().resolves(),
      },
    }
    this.WebApiManager.promises.getHistoryId
      .withArgs(this.projectId)
      .resolves(this.historyId)

    this.ErrorRecorder = {
      promises: {
        record: sinon.stub().resolves(),
        recordSyncStart: sinon.stub().resolves(),
      },
    }

    this.RedisManager = {}

    this.SnapshotManager = {
      promises: {
        getLatestSnapshot: sinon.stub(),
      },
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
      beforeEach(async function () {
        this.db.projectHistorySyncState.findOne.resolves({})
        await this.SyncManager.promises.startResync(this.projectId)
      })

      it('takes the project lock', function () {
        expect(this.LockManager.promises.runWithLock).to.have.been.calledWith(
          `ProjectHistoryLock:${this.projectId}`
        )
      })

      it('gets the sync state from mongo', function () {
        expect(this.db.projectHistorySyncState.findOne).to.have.been.calledWith(
          { project_id: new ObjectId(this.projectId) }
        )
      })

      it('requests a resync from web', function () {
        expect(
          this.WebApiManager.promises.requestResync
        ).to.have.been.calledWith(this.projectId)
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
    })

    describe('if project structure sync is in progress', function () {
      beforeEach(function () {
        const syncState = { resyncProjectStructure: true }
        this.db.projectHistorySyncState.findOne.resolves(syncState)
      })

      it('returns an error if already syncing', async function () {
        await expect(
          this.SyncManager.promises.startResync(this.projectId)
        ).to.be.rejectedWith('sync ongoing')
      })
    })

    describe('if doc content sync in is progress', function () {
      beforeEach(async function () {
        const syncState = { resyncDocContents: ['/foo.tex'] }
        this.db.projectHistorySyncState.findOne.resolves(syncState)
      })

      it('returns an error if already syncing', async function () {
        await expect(
          this.SyncManager.promises.startResync(this.projectId)
        ).to.be.rejectedWith('sync ongoing')
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

      it('sets the sync state in mongo and prevents it expiring', async function () {
        // SyncState is a private class of SyncManager
        // we know the interface however:
        await this.SyncManager.promises.setResyncState(
          this.projectId,
          this.syncState
        )

        expect(
          this.db.projectHistorySyncState.updateOne
        ).to.have.been.calledWith(
          { project_id: new ObjectId(this.projectId) },
          sinon.match({
            $set: this.syncState.toRaw(),
            $currentDate: { lastUpdated: true },
            $inc: { resyncCount: 1 },
            $unset: { expiresAt: true },
          }),
          { upsert: true }
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

      it('sets the sync state entry in mongo to expire', async function () {
        await this.SyncManager.promises.setResyncState(
          this.projectId,
          this.syncState
        )

        expect(
          this.db.projectHistorySyncState.updateOne
        ).to.have.been.calledWith(
          { project_id: new ObjectId(this.projectId) },
          sinon.match({
            $set: {
              resyncProjectStructure: false,
              resyncDocContents: [],
              origin: { kind: 'history-resync' },
              expiresAt: new Date(this.now.getTime() + 90 * 24 * 3600 * 1000),
            },
            $currentDate: { lastUpdated: true },
          }),
          { upsert: true }
        )
      })
    })

    describe('when the new sync state is null', function () {
      it('does not update the sync state in mongo', async function () {
        // SyncState is a private class of SyncManager
        // we know the interface however:
        await this.SyncManager.promises.setResyncState(this.projectId, null)
        expect(this.db.projectHistorySyncState.updateOne).to.not.have.been
          .called
      })
    })
  })

  describe('skipUpdatesDuringSync', function () {
    describe('if a sync is not in progress', function () {
      beforeEach(async function () {
        this.db.projectHistorySyncState.findOne.resolves({})
        this.updates = ['some', 'mock', 'updates']
        this.result = await this.SyncManager.promises.skipUpdatesDuringSync(
          this.projectId,
          this.updates
        )
      })

      it('returns all updates', function () {
        expect(this.result.updates).to.deep.equal(this.updates)
      })

      it('should not return any newSyncState', function () {
        expect(this.result.syncState).to.be.null
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
        this.db.projectHistorySyncState.findOne.resolves(syncState)
      })

      it('remove updates before a project structure sync update', async function () {
        const updates = [
          this.renameUpdate,
          this.textUpdate,
          this.projectStructureSyncUpdate,
        ]
        const { updates: filteredUpdates, syncState } =
          await this.SyncManager.promises.skipUpdatesDuringSync(
            this.projectId,
            updates
          )

        expect(filteredUpdates).to.deep.equal([this.projectStructureSyncUpdate])
        expect(syncState.toRaw()).to.deep.equal({
          resyncProjectStructure: false,
          resyncDocContents: ['new.tex'],
          origin: { kind: 'history-resync' },
        })
      })

      it('allow project structure updates after project structure sync update', async function () {
        const updates = [this.projectStructureSyncUpdate, this.renameUpdate]
        const { updates: filteredUpdates, syncState } =
          await this.SyncManager.promises.skipUpdatesDuringSync(
            this.projectId,
            updates
          )

        expect(filteredUpdates).to.deep.equal([
          this.projectStructureSyncUpdate,
          this.renameUpdate,
        ])
        expect(syncState.toRaw()).to.deep.equal({
          resyncProjectStructure: false,
          resyncDocContents: ['new.tex'],
          origin: { kind: 'history-resync' },
        })
      })

      it('remove text updates for a doc before doc sync update', async function () {
        const updates = [
          this.projectStructureSyncUpdate,
          this.textUpdate,
          this.docContentSyncUpdate,
        ]
        const { updates: filteredUpdates, syncState } =
          await this.SyncManager.promises.skipUpdatesDuringSync(
            this.projectId,
            updates
          )

        expect(filteredUpdates).to.deep.equal([
          this.projectStructureSyncUpdate,
          this.docContentSyncUpdate,
        ])
        expect(syncState.toRaw()).to.deep.equal({
          resyncProjectStructure: false,
          resyncDocContents: [],
          origin: { kind: 'history-resync' },
        })
      })

      it('allow text updates for a doc after doc sync update', async function () {
        const updates = [
          this.projectStructureSyncUpdate,
          this.docContentSyncUpdate,
          this.textUpdate,
        ]
        const { updates: filteredUpdates, syncState } =
          await this.SyncManager.promises.skipUpdatesDuringSync(
            this.projectId,
            updates
          )

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
      })
    })
  })

  describe('expandSyncUpdates', function () {
    beforeEach(function () {
      this.persistedDoc = {
        doc: 'doc-id',
        path: 'main.tex',
      }
      this.persistedDocContent = 'the quick brown fox jumps over the lazy fox'
      this.persistedFile = {
        file: 'file-id',
        path: '1.png',
        _hash: 'abcde',
      }
      this.loadedSnapshotDoc = {
        isEditable: sinon.stub().returns(true),
        getContent: sinon.stub().returns(this.persistedDocContent),
        getComments: sinon
          .stub()
          .returns({ toArray: sinon.stub().returns([]) }),
        getHash: sinon.stub().returns(null),
      }
      this.fileMap = {
        'main.tex': {
          isEditable: sinon.stub().returns(true),
          getContent: sinon.stub().returns(null),
          getHash: sinon.stub().returns(null),
          load: sinon.stub().resolves(this.loadedSnapshotDoc),
        },
        '1.png': {
          isEditable: sinon.stub().returns(false),
          data: { hash: this.persistedFile._hash },
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
      this.SnapshotManager.promises.getLatestSnapshot.resolves(this.fileMap)
    })

    it('returns updates if no sync updates are queued', async function () {
      const updates = ['some', 'mock', 'updates']
      const expandedUpdates = await this.SyncManager.promises.expandSyncUpdates(
        this.projectId,
        this.historyId,
        updates,
        this.extendLock
      )

      expect(expandedUpdates).to.equal(updates)
      expect(this.SnapshotManager.promises.getLatestSnapshot).to.not.have.been
        .called
      expect(this.extendLock).to.not.have.been.called
    })

    describe('expanding project structure sync updates', function () {
      it('queues nothing for expected docs and files', async function () {
        const updates = [
          resyncProjectStructureUpdate(
            [this.persistedDoc],
            [this.persistedFile]
          ),
        ]
        const expandedUpdates =
          await this.SyncManager.promises.expandSyncUpdates(
            this.projectId,
            this.historyId,
            updates,
            this.extendLock
          )
        expect(expandedUpdates).to.deep.equal([])
        expect(this.extendLock).to.have.been.called
      })

      it('queues file removes for unexpected files', async function () {
        const updates = [resyncProjectStructureUpdate([this.persistedDoc], [])]
        const expandedUpdates =
          await this.SyncManager.promises.expandSyncUpdates(
            this.projectId,
            this.historyId,
            updates,
            this.extendLock
          )

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
      })

      it('queues doc removes for unexpected docs', async function () {
        const updates = [resyncProjectStructureUpdate([], [this.persistedFile])]
        const expandedUpdates =
          await this.SyncManager.promises.expandSyncUpdates(
            this.projectId,
            this.historyId,
            updates,
            this.extendLock
          )

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
      })

      it('queues file additions for missing files', async function () {
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
        const expandedUpdates =
          await this.SyncManager.promises.expandSyncUpdates(
            this.projectId,
            this.historyId,
            updates,
            this.extendLock
          )

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
      })

      it('queues blank doc additions for missing docs', async function () {
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
        const expandedUpdates =
          await this.SyncManager.promises.expandSyncUpdates(
            this.projectId,
            this.historyId,
            updates,
            this.extendLock
          )

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
      })

      it('removes and re-adds files if whether they are binary differs', async function () {
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
        const expandedUpdates =
          await this.SyncManager.promises.expandSyncUpdates(
            this.projectId,
            this.historyId,
            updates,
            this.extendLock
          )

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
      })

      it("does not remove and re-add files if the expected file doesn't have a hash", async function () {
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
        const expandedUpdates =
          await this.SyncManager.promises.expandSyncUpdates(
            this.projectId,
            this.historyId,
            updates,
            this.extendLock
          )

        expect(expandedUpdates).to.deep.equal([])
        expect(this.extendLock).to.have.been.called
      })

      it('does not remove and re-add editable files if there is a binary file with same hash', async function () {
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
        const expandedUpdates =
          await this.SyncManager.promises.expandSyncUpdates(
            this.projectId,
            this.historyId,
            updates,
            this.extendLock
          )

        expect(expandedUpdates).to.deep.equal([])
        expect(this.extendLock).to.have.been.called
      })

      it('removes and re-adds binary files if they do not have same hash', async function () {
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
        const expandedUpdates =
          await this.SyncManager.promises.expandSyncUpdates(
            this.projectId,
            this.historyId,
            updates,
            this.extendLock
          )

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
      })

      it('preserves other updates', async function () {
        const update = { mock: 'update' }
        const updates = [
          update,
          resyncProjectStructureUpdate(
            [this.persistedDoc],
            [this.persistedFile]
          ),
        ]
        const expandedUpdates =
          await this.SyncManager.promises.expandSyncUpdates(
            this.projectId,
            this.historyId,
            updates,
            this.extendLock
          )

        expect(expandedUpdates).to.deep.equal([update])
        expect(this.extendLock).to.have.been.called
      })
    })

    describe('expanding doc contents sync updates', function () {
      it('returns errors from diffAsShareJsOps', async function () {
        const diffError = new Error('test')
        this.UpdateCompressor.diffAsShareJsOps.throws(diffError)
        const updates = [
          resyncProjectStructureUpdate(
            [this.persistedDoc],
            [this.persistedFile]
          ),
          docContentSyncUpdate(this.persistedDoc, this.persistedDocContent),
        ]
        await expect(
          this.SyncManager.promises.expandSyncUpdates(
            this.projectId,
            this.historyId,
            updates,
            this.extendLock
          )
        ).to.be.rejectedWith(diffError)
        expect(this.extendLock).to.have.been.called
      })

      it('handles an update for a file that is missing from the snapshot', async function () {
        const updates = [docContentSyncUpdate('not-in-snapshot.txt', 'test')]
        await expect(
          this.SyncManager.promises.expandSyncUpdates(
            this.projectId,
            this.historyId,
            updates,
            this.extendLock
          )
        ).to.be.rejectedWith('unrecognised file: not in snapshot')
      })

      it('queues nothing for in docs whose contents is in sync', async function () {
        const updates = [
          resyncProjectStructureUpdate(
            [this.persistedDoc],
            [this.persistedFile]
          ),
          docContentSyncUpdate(this.persistedDoc, this.persistedDocContent),
        ]
        this.UpdateCompressor.diffAsShareJsOps.returns([])
        const expandedUpdates =
          await this.SyncManager.promises.expandSyncUpdates(
            this.projectId,
            this.historyId,
            updates,
            this.extendLock
          )

        expect(expandedUpdates).to.deep.equal([])
        expect(this.extendLock).to.have.been.called
      })

      it('queues text updates for docs whose contents is out of sync', async function () {
        const updates = [
          resyncProjectStructureUpdate(
            [this.persistedDoc],
            [this.persistedFile]
          ),
          docContentSyncUpdate(
            this.persistedDoc,
            'the fox jumps over the lazy dog'
          ),
        ]
        this.UpdateCompressor.diffAsShareJsOps.returns([
          { d: 'quick brown ', p: 4 },
        ])
        const expandedUpdates =
          await this.SyncManager.promises.expandSyncUpdates(
            this.projectId,
            this.historyId,
            updates,
            this.extendLock
          )

        expect(expandedUpdates).to.deep.equal([
          {
            doc: this.persistedDoc.doc,
            op: [{ d: 'quick brown ', p: 4 }],
            meta: {
              pathname: this.persistedDoc.path,
              doc_length: this.persistedDocContent.length,
              resync: true,
              ts: timestamp,
              origin: { kind: 'history-resync' },
            },
          },
        ])
        expect(this.extendLock).to.have.been.called
      })

      it('queues text updates for docs created by project structure sync', async function () {
        this.UpdateCompressor.diffAsShareJsOps.returns([{ i: 'a', p: 0 }])
        const newDoc = {
          path: 'another.tex',
          doc: new ObjectId().toString(),
        }
        const newDocContent = 'a'
        const updates = [
          resyncProjectStructureUpdate(
            [this.persistedDoc, newDoc],
            [this.persistedFile]
          ),
          docContentSyncUpdate(newDoc, newDocContent),
        ]
        const expandedUpdates =
          await this.SyncManager.promises.expandSyncUpdates(
            this.projectId,
            this.historyId,
            updates,
            this.extendLock
          )

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
      })

      it('skips text updates for docs when hashes match', async function () {
        this.fileMap['main.tex'].getHash.returns('special-hash')
        this.HashManager._getBlobHashFromString.returns('special-hash')
        const updates = [
          resyncProjectStructureUpdate(
            [this.persistedDoc],
            [this.persistedFile]
          ),
          docContentSyncUpdate(this.persistedDoc, 'hello'),
        ]
        const expandedUpdates =
          await this.SyncManager.promises.expandSyncUpdates(
            this.projectId,
            this.historyId,
            updates,
            this.extendLock
          )

        expect(expandedUpdates).to.deep.equal([])
        expect(this.extendLock).to.have.been.called
      })

      it('computes text updates for docs when hashes differ', async function () {
        this.fileMap['main.tex'].getHash.returns('first-hash')
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
        const expandedUpdates =
          await this.SyncManager.promises.expandSyncUpdates(
            this.projectId,
            this.historyId,
            updates,
            this.extendLock
          )

        expect(expandedUpdates).to.deep.equal([
          {
            doc: this.persistedDoc.doc,
            op: [{ i: 'test diff', p: 0 }],
            meta: {
              pathname: this.persistedDoc.path,
              doc_length: this.persistedDocContent.length,
              resync: true,
              ts: timestamp,
              origin: { kind: 'history-resync' },
            },
          },
        ])
        expect(this.extendLock).to.have.been.called
      })

      describe('for docs whose contents is out of sync', function () {
        beforeEach(async function () {
          const updates = [
            resyncProjectStructureUpdate(
              [this.persistedDoc],
              [this.persistedFile]
            ),
            docContentSyncUpdate(this.persistedDoc, 'a'),
          ]
          this.loadedSnapshotDoc.getContent.returns('stored content')
          this.UpdateCompressor.diffAsShareJsOps.returns([{ d: 'sdf', p: 1 }])
          this.expandedUpdates =
            await this.SyncManager.promises.expandSyncUpdates(
              this.projectId,
              this.historyId,
              updates,
              this.extendLock
            )
        })

        it('loads content from the history service when needed', function () {
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

    describe('syncing comments', function () {
      beforeEach(function () {
        this.loadedSnapshotDoc.getComments.returns({
          toArray: sinon
            .stub()
            .returns([
              new Comment('comment1', [new Range(4, 5)]),
              new Comment('comment2', [new Range(10, 5)], true),
            ]),
        })
        this.comments = [
          makeComment('comment1', 4, 'quick'),
          makeComment('comment2', 10, 'brown'),
        ]
        this.resolvedComments = ['comment2']
      })

      it('does nothing if comments have not changed', async function () {
        const updates = [
          docContentSyncUpdate(
            this.persistedDoc,
            this.persistedDocContent,
            {
              comments: this.comments,
            },
            this.resolvedComments
          ),
        ]
        const expandedUpdates =
          await this.SyncManager.promises.expandSyncUpdates(
            this.projectId,
            this.historyId,
            updates,
            this.extendLock
          )
        expect(expandedUpdates).to.deep.equal([])
      })

      it('adds missing comments', async function () {
        this.comments.push(makeComment('comment3', 20, 'jumps'))
        const updates = [
          docContentSyncUpdate(
            this.persistedDoc,
            this.persistedDocContent,
            {
              comments: this.comments,
            },
            this.resolvedComments
          ),
        ]
        const expandedUpdates =
          await this.SyncManager.promises.expandSyncUpdates(
            this.projectId,
            this.historyId,
            updates,
            this.extendLock
          )
        expect(expandedUpdates).to.deep.equal([
          {
            doc: this.persistedDoc.doc,
            op: [
              {
                c: 'jumps',
                p: 20,
                t: 'comment3',
              },
            ],
            meta: {
              origin: {
                kind: 'history-resync',
              },
              pathname: this.persistedDoc.path,
              resync: true,
              ts: timestamp,
              doc_length: this.persistedDocContent.length,
            },
          },
        ])
      })

      it('deletes extra comments', async function () {
        this.comments.splice(0, 1)
        const updates = [
          docContentSyncUpdate(
            this.persistedDoc,
            this.persistedDocContent,
            {
              comments: this.comments,
            },
            this.resolvedComments
          ),
        ]
        const expandedUpdates =
          await this.SyncManager.promises.expandSyncUpdates(
            this.projectId,
            this.historyId,
            updates,
            this.extendLock
          )
        expect(expandedUpdates).to.deep.equal([
          {
            pathname: this.persistedDoc.path,
            deleteComment: 'comment1',
            meta: {
              origin: {
                kind: 'history-resync',
              },
              resync: true,
              ts: timestamp,
            },
          },
        ])
      })

      it('updates comments when ranges differ', async function () {
        this.comments[1] = makeComment('comment2', 16, 'fox')
        const updates = [
          docContentSyncUpdate(
            this.persistedDoc,
            this.persistedDocContent,
            {
              comments: this.comments,
            },
            this.resolvedComments
          ),
        ]
        const expandedUpdates =
          await this.SyncManager.promises.expandSyncUpdates(
            this.projectId,
            this.historyId,
            updates,
            this.extendLock
          )
        expect(expandedUpdates).to.deep.equal([
          {
            doc: 'doc-id',
            op: [
              {
                c: 'fox',
                p: 16,
                t: 'comment2',
              },
            ],
            meta: {
              origin: {
                kind: 'history-resync',
              },
              resync: true,
              ts: timestamp,
              pathname: this.persistedDoc.path,
              doc_length: this.persistedDocContent.length,
            },
          },
        ])
      })

      it('sets the resolved state when it differs', async function () {
        this.resolvedComments = ['comment1']
        const updates = [
          docContentSyncUpdate(
            this.persistedDoc,
            this.persistedDocContent,
            {
              comments: this.comments,
            },
            this.resolvedComments
          ),
        ]
        const expandedUpdates =
          await this.SyncManager.promises.expandSyncUpdates(
            this.projectId,
            this.historyId,
            updates,
            this.extendLock
          )
        expect(expandedUpdates).to.have.deep.members([
          {
            pathname: this.persistedDoc.path,
            commentId: 'comment1',
            resolved: true,
          },
          {
            pathname: this.persistedDoc.path,
            commentId: 'comment2',
            resolved: false,
          },
        ])
      })
    })
  })
})
