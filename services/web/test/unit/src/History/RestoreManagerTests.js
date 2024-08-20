const SandboxedModule = require('sandboxed-module')
const sinon = require('sinon')
const modulePath = require('path').join(
  __dirname,
  '../../../../app/src/Features/History/RestoreManager'
)
const Errors = require('../../../../app/src/Features/Errors/Errors')
const tk = require('timekeeper')
const moment = require('moment')
const { expect } = require('chai')

describe('RestoreManager', function () {
  beforeEach(function () {
    tk.freeze(Date.now()) // freeze the time for these tests
    this.RestoreManager = SandboxedModule.require(modulePath, {
      requires: {
        '@overleaf/settings': {},
        '../../infrastructure/FileWriter': (this.FileWriter = { promises: {} }),
        '../Uploads/FileSystemImportManager': (this.FileSystemImportManager = {
          promises: {},
        }),
        '../Editor/EditorController': (this.EditorController = {
          promises: {},
        }),
        '../Project/ProjectLocator': (this.ProjectLocator = { promises: {} }),
        '../DocumentUpdater/DocumentUpdaterHandler':
          (this.DocumentUpdaterHandler = {
            promises: { flushProjectToMongo: sinon.stub().resolves() },
          }),
        '../Docstore/DocstoreManager': (this.DocstoreManager = {
          promises: {},
        }),
        '../Chat/ChatApiHandler': (this.ChatApiHandler = { promises: {} }),
        '../Chat/ChatManager': (this.ChatManager = { promises: {} }),
        '../Editor/EditorRealTimeController': (this.EditorRealTimeController =
          {}),
        '../Project/ProjectGetter': (this.ProjectGetter = { promises: {} }),
        '../Project/ProjectEntityHandler': (this.ProjectEntityHandler = {
          promises: {},
        }),
      },
    })
    this.user_id = 'mock-user-id'
    this.project_id = 'mock-project-id'
    this.version = 42
  })

  afterEach(function () {
    tk.reset()
  })

  describe('restoreFileFromV2', function () {
    beforeEach(function () {
      this.RestoreManager.promises._writeFileVersionToDisk = sinon
        .stub()
        .resolves((this.fsPath = '/tmp/path/on/disk'))
      this.RestoreManager.promises._findOrCreateFolder = sinon
        .stub()
        .resolves((this.folder_id = 'mock-folder-id'))
      this.FileSystemImportManager.promises.addEntity = sinon
        .stub()
        .resolves((this.entity = 'mock-entity'))
    })

    describe('with a file not in a folder', function () {
      beforeEach(async function () {
        this.pathname = 'foo.tex'
        this.result = await this.RestoreManager.promises.restoreFileFromV2(
          this.user_id,
          this.project_id,
          this.version,
          this.pathname
        )
      })

      it('should write the file version to disk', function () {
        this.RestoreManager.promises._writeFileVersionToDisk
          .calledWith(this.project_id, this.version, this.pathname)
          .should.equal(true)
      })

      it('should find the root folder', function () {
        this.RestoreManager.promises._findOrCreateFolder
          .calledWith(this.project_id, '')
          .should.equal(true)
      })

      it('should add the entity', function () {
        this.FileSystemImportManager.promises.addEntity
          .calledWith(
            this.user_id,
            this.project_id,
            this.folder_id,
            'foo.tex',
            this.fsPath,
            false
          )
          .should.equal(true)
      })

      it('should return the entity', function () {
        expect(this.result).to.equal(this.entity)
      })
    })

    describe('with a file in a folder', function () {
      beforeEach(async function () {
        this.pathname = 'foo/bar.tex'
        await this.RestoreManager.promises.restoreFileFromV2(
          this.user_id,
          this.project_id,
          this.version,
          this.pathname
        )
      })

      it('should find the folder', function () {
        this.RestoreManager.promises._findOrCreateFolder
          .calledWith(this.project_id, 'foo')
          .should.equal(true)
      })

      it('should add the entity by its basename', function () {
        this.FileSystemImportManager.promises.addEntity
          .calledWith(
            this.user_id,
            this.project_id,
            this.folder_id,
            'bar.tex',
            this.fsPath,
            false
          )
          .should.equal(true)
      })
    })
  })

  describe('_findOrCreateFolder', function () {
    beforeEach(async function () {
      this.EditorController.promises.mkdirp = sinon.stub().resolves({
        newFolders: [],
        lastFolder: { _id: (this.folder_id = 'mock-folder-id') },
      })
      this.result = await this.RestoreManager.promises._findOrCreateFolder(
        this.project_id,
        'folder/name'
      )
    })

    it('should look up or create the folder', function () {
      this.EditorController.promises.mkdirp
        .calledWith(this.project_id, 'folder/name')
        .should.equal(true)
    })

    it('should return the folder_id', function () {
      expect(this.result).to.equal(this.folder_id)
    })
  })

  describe('_addEntityWithUniqueName', function () {
    beforeEach(function () {
      this.addEntityWithName = sinon.stub()
      this.name = 'foo.tex'
    })

    describe('with a valid name', function () {
      beforeEach(async function () {
        this.addEntityWithName.resolves((this.entity = 'mock-entity'))
        this.result =
          await this.RestoreManager.promises._addEntityWithUniqueName(
            this.addEntityWithName,
            this.name
          )
      })

      it('should add the entity', function () {
        this.addEntityWithName.calledWith(this.name).should.equal(true)
      })

      it('should return the entity', function () {
        expect(this.result).to.equal(this.entity)
      })
    })

    describe('with a duplicate name', function () {
      beforeEach(async function () {
        this.addEntityWithName.rejects(new Errors.DuplicateNameError())
        this.addEntityWithName
          .onSecondCall()
          .resolves((this.entity = 'mock-entity'))
        this.result =
          await this.RestoreManager.promises._addEntityWithUniqueName(
            this.addEntityWithName,
            this.name
          )
      })

      it('should try to add the entity with its original name', function () {
        this.addEntityWithName.calledWith('foo.tex').should.equal(true)
      })

      it('should try to add the entity with a unique name', function () {
        const date = moment(new Date()).format('Do MMM YY H:mm:ss')
        this.addEntityWithName
          .calledWith(`foo (Restored on ${date}).tex`)
          .should.equal(true)
      })

      it('should return the entity', function () {
        expect(this.result).to.equal(this.entity)
      })
    })
  })

  describe('revertFile', function () {
    beforeEach(function () {
      this.ProjectGetter.promises.getProject = sinon.stub()
      this.ProjectGetter.promises.getProject
        .withArgs(this.project_id)
        .resolves({ overleaf: { history: { rangesSupportEnabled: true } } })
      this.RestoreManager.promises._writeFileVersionToDisk = sinon
        .stub()
        .resolves((this.fsPath = '/tmp/path/on/disk'))
      this.RestoreManager.promises._findOrCreateFolder = sinon
        .stub()
        .resolves((this.folder_id = 'mock-folder-id'))
      this.FileSystemImportManager.promises.addEntity = sinon
        .stub()
        .resolves((this.entity = 'mock-entity'))
      this.RestoreManager.promises._getRangesFromHistory = sinon
        .stub()
        .rejects()
    })

    describe('reverting a project without ranges support', function () {
      beforeEach(function () {
        this.ProjectGetter.promises.getProject = sinon.stub().resolves({
          overleaf: { history: { rangesSupportEnabled: false } },
        })
      })

      it('should throw an error', async function () {
        await expect(
          this.RestoreManager.promises.revertFile(
            this.user_id,
            this.project_id,
            this.version,
            this.pathname
          )
        ).to.eventually.be.rejectedWith('project does not have ranges support')
      })
    })

    describe('reverting a document', function () {
      beforeEach(function () {
        this.pathname = 'foo.tex'
        this.comments = [
          (this.comment = { op: { t: 'comment-1', p: 0, c: 'foo' } }),
        ]
        this.remappedComments = [{ op: { t: 'comment-2', p: 0, c: 'foo' } }]
        this.ProjectLocator.promises.findElementByPath = sinon.stub().rejects()
        this.DocstoreManager.promises.getAllRanges = sinon.stub().resolves([
          {
            ranges: {
              comments: [this.comment],
            },
          },
        ])
        this.ChatApiHandler.promises.duplicateCommentThreads = sinon
          .stub()
          .resolves({
            newThreads: {
              'comment-1': {
                duplicateId: 'comment-2',
              },
            },
          })
        this.ChatApiHandler.promises.generateThreadData = sinon.stub().resolves(
          (this.threadData = {
            'comment-2': {
              messages: [
                {
                  content: 'message-content',
                  timestamp: '2024-01-01T00:00:00.000Z',
                  user_id: 'user-1',
                },
              ],
            },
          })
        )
        this.ChatManager.promises.injectUserInfoIntoThreads = sinon
          .stub()
          .resolves(this.threadData)

        this.EditorRealTimeController.emitToRoom = sinon.stub()
        this.tracked_changes = [
          {
            op: { pos: 4, i: 'bar' },
            metadata: { ts: '2024-01-01T00:00:00.000Z', user_id: 'user-1' },
          },
          {
            op: { pos: 8, d: 'qux' },
            metadata: { ts: '2024-01-01T00:00:00.000Z', user_id: 'user-2' },
          },
        ]
        this.FileSystemImportManager.promises.importFile = sinon
          .stub()
          .resolves({ type: 'doc', lines: ['foo', 'bar', 'baz'] })
        this.RestoreManager.promises._getRangesFromHistory = sinon
          .stub()
          .resolves({
            changes: this.tracked_changes,
            comments: this.comments,
          })
        this.RestoreManager.promises._getUpdatesFromHistory = sinon
          .stub()
          .resolves([{ toV: this.version, meta: { end_ts: Date.now() } }])
        this.EditorController.promises.addDocWithRanges = sinon
          .stub()
          .resolves((this.addedFile = { _id: 'mock-doc', type: 'doc' }))
      })

      describe("when reverting a file that doesn't current exist", function () {
        beforeEach(async function () {
          this.data = await this.RestoreManager.promises.revertFile(
            this.user_id,
            this.project_id,
            this.version,
            this.pathname
          )
        })

        it('should flush the document before fetching ranges', function () {
          expect(
            this.DocumentUpdaterHandler.promises.flushProjectToMongo
          ).to.have.been.calledBefore(
            this.DocstoreManager.promises.getAllRanges
          )
        })

        it('should import the file', function () {
          expect(
            this.EditorController.promises.addDocWithRanges
          ).to.have.been.calledWith(
            this.project_id,
            this.folder_id,
            'foo.tex',
            ['foo', 'bar', 'baz'],
            { changes: this.tracked_changes, comments: this.remappedComments }
          )
        })

        it('should return the created entity', function () {
          expect(this.data).to.deep.equal(this.addedFile)
        })

        it('should look up ranges', function () {
          expect(
            this.RestoreManager.promises._getRangesFromHistory
          ).to.have.been.calledWith(
            this.project_id,
            this.version,
            this.pathname
          )
        })
      })

      describe('with an existing file in the current project', function () {
        beforeEach(async function () {
          this.ProjectLocator.promises.findElementByPath = sinon
            .stub()
            .resolves({ type: 'doc', element: { _id: 'mock-file-id' } })
          this.EditorController.promises.deleteEntity = sinon.stub().resolves()

          this.data = await this.RestoreManager.promises.revertFile(
            this.user_id,
            this.project_id,
            this.version,
            this.pathname
          )
        })

        it('should delete the existing document', async function () {
          expect(
            this.EditorController.promises.deleteEntity
          ).to.have.been.calledWith(
            this.project_id,
            'mock-file-id',
            'doc',
            {
              kind: 'file-restore',
              path: this.pathname,
              version: this.version,
              timestamp: new Date().toISOString(),
            },
            this.user_id
          )
        })

        it('should delete the document before flushing', function () {
          expect(
            this.EditorController.promises.deleteEntity
          ).to.have.been.calledBefore(
            this.DocumentUpdaterHandler.promises.flushProjectToMongo
          )
        })

        it('should flush the document before fetching ranges', function () {
          expect(
            this.DocumentUpdaterHandler.promises.flushProjectToMongo
          ).to.have.been.calledBefore(
            this.DocstoreManager.promises.getAllRanges
          )
        })

        it('should import the file', function () {
          expect(
            this.EditorController.promises.addDocWithRanges
          ).to.have.been.calledWith(
            this.project_id,
            this.folder_id,
            'foo.tex',
            ['foo', 'bar', 'baz'],
            { changes: this.tracked_changes, comments: this.remappedComments },
            {
              kind: 'file-restore',
              path: this.pathname,
              version: this.version,
              timestamp: new Date().toISOString(),
            }
          )
        })

        it('should return the created entity', function () {
          expect(this.data).to.deep.equal(this.addedFile)
        })

        it('should look up ranges', function () {
          expect(
            this.RestoreManager.promises._getRangesFromHistory
          ).to.have.been.calledWith(
            this.project_id,
            this.version,
            this.pathname
          )
        })
      })
    })

    describe('when reverting a binary file', function () {
      beforeEach(async function () {
        this.pathname = 'foo.png'
        this.FileSystemImportManager.promises.importFile = sinon
          .stub()
          .resolves({ type: 'file' })
        this.EditorController.promises.upsertFile = sinon
          .stub()
          .resolves({ _id: 'mock-file-id', type: 'file' })
        this.RestoreManager.promises._getUpdatesFromHistory = sinon
          .stub()
          .resolves([{ toV: this.version, meta: { end_ts: Date.now() } }])
      })

      it('should return the created entity if file exists', async function () {
        this.ProjectLocator.promises.findElementByPath = sinon
          .stub()
          .resolves({ type: 'file' })

        const revertRes = await this.RestoreManager.promises.revertFile(
          this.user_id,
          this.project_id,
          this.version,
          this.pathname
        )

        expect(revertRes).to.deep.equal({ _id: 'mock-file-id', type: 'file' })
      })

      it('should return the created entity if file does not exists', async function () {
        this.ProjectLocator.promises.findElementByPath = sinon.stub().rejects()

        const revertRes = await this.RestoreManager.promises.revertFile(
          this.user_id,
          this.project_id,
          this.version,
          this.pathname
        )

        expect(revertRes).to.deep.equal({ _id: 'mock-file-id', type: 'file' })
      })
    })
  })

  describe('revertProject', function () {
    beforeEach(function () {
      this.ProjectGetter.promises.getProject = sinon.stub()
      this.ProjectGetter.promises.getProject
        .withArgs(this.project_id)
        .resolves({ overleaf: { history: { rangesSupportEnabled: true } } })
      this.RestoreManager.promises.revertFile = sinon.stub().resolves()
      this.RestoreManager.promises._getProjectPathsAtVersion = sinon
        .stub()
        .resolves([])
      this.ProjectEntityHandler.promises.getAllEntities = sinon
        .stub()
        .resolves({ docs: [], files: [] })
      this.EditorController.promises.deleteEntityWithPath = sinon
        .stub()
        .resolves()
      this.RestoreManager.promises._getUpdatesFromHistory = sinon
        .stub()
        .resolves([
          { toV: this.version, meta: { end_ts: (this.end_ts = Date.now()) } },
        ])
    })

    describe('reverting a project without ranges support', function () {
      beforeEach(function () {
        this.ProjectGetter.promises.getProject = sinon.stub().resolves({
          overleaf: { history: { rangesSupportEnabled: false } },
        })
      })

      it('should throw an error', async function () {
        await expect(
          this.RestoreManager.promises.revertProject(
            this.user_id,
            this.project_id,
            this.version
          )
        ).to.eventually.be.rejectedWith('project does not have ranges support')
      })
    })

    describe('for a project with overlap in current files and old files', function () {
      beforeEach(async function () {
        this.ProjectEntityHandler.promises.getAllEntities = sinon
          .stub()
          .resolves({
            docs: [{ path: '/main.tex' }, { path: '/new-file.tex' }],
            files: [{ path: '/figures/image.png' }],
          })
        this.RestoreManager.promises._getProjectPathsAtVersion = sinon
          .stub()
          .resolves(['main.tex', 'figures/image.png', 'since-deleted.tex'])

        await this.RestoreManager.promises.revertProject(
          this.user_id,
          this.project_id,
          this.version
        )
        this.origin = {
          kind: 'project-restore',
          version: this.version,
          timestamp: new Date(this.end_ts).toISOString(),
        }
      })

      it('should delete the old files', function () {
        expect(
          this.EditorController.promises.deleteEntityWithPath
        ).to.have.been.calledWith(
          this.project_id,
          'new-file.tex',
          this.origin,
          this.user_id
        )
      })

      it('should not delete the current files', function () {
        expect(
          this.EditorController.promises.deleteEntityWithPath
        ).to.not.have.been.calledWith(
          this.project_id,
          'main.tex',
          this.origin,
          this.user_id
        )

        expect(
          this.EditorController.promises.deleteEntityWithPath
        ).to.not.have.been.calledWith(
          this.project_id,
          'figures/image.png',
          this.origin,
          this.user_id
        )
      })

      it('should revert the old files', function () {
        expect(this.RestoreManager.promises.revertFile).to.have.been.calledWith(
          this.user_id,
          this.project_id,
          this.version,
          'main.tex'
        )

        expect(this.RestoreManager.promises.revertFile).to.have.been.calledWith(
          this.user_id,
          this.project_id,
          this.version,
          'figures/image.png'
        )

        expect(this.RestoreManager.promises.revertFile).to.have.been.calledWith(
          this.user_id,
          this.project_id,
          this.version,
          'since-deleted.tex'
        )
      })

      it('should not revert the current files', function () {
        expect(
          this.RestoreManager.promises.revertFile
        ).to.not.have.been.calledWith(
          this.user_id,
          this.project_id,
          this.version,
          'new-file.tex'
        )
      })
    })
  })
})
