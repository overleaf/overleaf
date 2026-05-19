import { vi, expect } from 'vitest'
import sinon from 'sinon'
import timekeeper from 'timekeeper'
import mongodb from 'mongodb-legacy'

const { ObjectId } = mongodb

const MODULE_PATH =
  '../../../../app/src/Features/Uploads/ProjectUploadManager.mjs'

describe('ProjectUploadManager', function () {
  beforeEach(async function (ctx) {
    ctx.now = Date.now()
    timekeeper.freeze(ctx.now)
    ctx.rootFolderId = new ObjectId()
    ctx.ownerId = new ObjectId()
    ctx.zipPath = '/path/to/zip/file-name.zip'
    ctx.extractedZipPath = `/path/to/zip/file-name-${ctx.now}`
    ctx.mainContent = 'Contents of main.tex'
    ctx.projectName = 'My project*'
    ctx.fixedProjectName = 'My project'
    ctx.uniqueProjectName = 'My project (1)'
    ctx.project = {
      _id: new ObjectId(),
      rootFolder: [{ _id: ctx.rootFolderId }],
      overleaf: { history: { id: 12345 } },
    }
    ctx.doc = {
      _id: new ObjectId(),
      name: 'main.tex',
    }
    ctx.docFsPath = '/path/to/doc'
    ctx.docLines = ['My thesis', 'by A. U. Thor']
    ctx.file = {
      _id: new ObjectId(),
      name: 'image.png',
    }
    ctx.fileFsPath = '/path/to/file'

    ctx.topLevelDestination = '/path/to/zip/file-extracted/nested'
    ctx.newProjectVersion = 123
    ctx.importEntries = [
      {
        type: 'doc',
        projectPath: '/main.tex',
        lines: ctx.docLines,
      },
      {
        type: 'file',
        projectPath: `/${ctx.file.name}`,
        fsPath: ctx.fileFsPath,
      },
    ]
    ctx.docEntries = [
      {
        doc: ctx.doc,
        path: `/${ctx.doc.name}`,
        docLines: ctx.docLines.join('\n'),
      },
    ]
    ctx.fileEntries = [
      {
        file: ctx.file,
        path: `/${ctx.file.name}`,
        createdBlob: true,
      },
    ]

    ctx.fs = {
      promises: {
        rm: sinon.stub().resolves(),
      },
    }
    ctx.ArchiveManager = {
      promises: {
        extractZipArchive: sinon.stub().resolves(),
        findTopLevelDirectory: sinon
          .stub()
          .withArgs(ctx.extractedZipPath)
          .resolves(ctx.topLevelDestination),
      },
    }
    ctx.Doc = sinon.stub().returns(ctx.doc)
    ctx.DocstoreManager = {
      promises: {
        updateDoc: sinon.stub().resolves(),
      },
    }
    ctx.DocumentHelper = {
      getTitleFromTexContent: sinon
        .stub()
        .withArgs(ctx.mainContent)
        .returns(ctx.projectName),
    }
    ctx.DocumentUpdaterHandler = {
      promises: {
        updateProjectStructure: sinon.stub().resolves(),
      },
    }
    ctx.FileStoreHandler = {
      promises: {
        uploadFileFromDiskWithHistoryId: sinon.stub().resolves({
          fileRef: ctx.file,
          createdBlob: true,
        }),
      },
    }
    ctx.FileSystemImportManager = {
      promises: {
        importDir: sinon
          .stub()
          .withArgs(ctx.topLevelDestination)
          .resolves(ctx.importEntries),
      },
    }
    ctx.ProjectCreationHandler = {
      promises: {
        createBlankProject: sinon.stub().resolves(ctx.project),
      },
    }
    ctx.ProjectEntityMongoUpdateHandler = {
      promises: {
        createNewFolderStructure: sinon.stub().resolves(ctx.newProjectVersion),
      },
    }
    ctx.ProjectRootDocManager = {
      promises: {
        setRootDocAutomatically: sinon.stub().resolves(),
        findRootDocFileFromDirectory: sinon
          .stub()
          .resolves({ path: 'main.tex', content: ctx.mainContent }),
        setRootDocFromName: sinon.stub().resolves(),
      },
    }
    ctx.ProjectDetailsHandler = {
      fixProjectName: sinon
        .stub()
        .withArgs(ctx.projectName)
        .returns(ctx.fixedProjectName),
      promises: {
        generateUniqueName: sinon.stub().resolves(ctx.uniqueProjectName),
      },
    }
    ctx.ProjectDeleter = {
      promises: {
        deleteProject: sinon.stub().resolves(),
      },
    }
    ctx.TpdsProjectFlusher = {
      promises: {
        flushProjectToTpds: sinon.stub().resolves(),
      },
    }

    vi.doMock('fs', () => ({
      default: ctx.fs,
    }))

    vi.doMock('../../../../app/src/Features/Uploads/ArchiveManager', () => ({
      default: ctx.ArchiveManager,
    }))

    vi.doMock('../../../../app/src/models/Doc', () => ({
      Doc: ctx.Doc,
    }))

    vi.doMock('../../../../app/src/Features/Docstore/DocstoreManager', () => ({
      default: ctx.DocstoreManager,
    }))

    vi.doMock('../../../../app/src/Features/Documents/DocumentHelper', () => ({
      default: ctx.DocumentHelper,
    }))

    vi.doMock(
      '../../../../app/src/Features/DocumentUpdater/DocumentUpdaterHandler',
      () => ({
        default: ctx.DocumentUpdaterHandler,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/FileStore/FileStoreHandler',
      () => ({
        default: ctx.FileStoreHandler,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Uploads/FileSystemImportManager',
      () => ({
        default: ctx.FileSystemImportManager,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Project/ProjectCreationHandler',
      () => ({
        default: ctx.ProjectCreationHandler,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Project/ProjectEntityMongoUpdateHandler',
      () => ({
        default: ctx.ProjectEntityMongoUpdateHandler,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Project/ProjectRootDocManager',
      () => ({
        default: ctx.ProjectRootDocManager,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Project/ProjectDetailsHandler',
      () => ({
        default: ctx.ProjectDetailsHandler,
      })
    )

    vi.doMock('../../../../app/src/Features/Project/ProjectDeleter', () => ({
      default: ctx.ProjectDeleter,
    }))

    vi.doMock(
      '../../../../app/src/Features/ThirdPartyDataStore/TpdsProjectFlusher',
      () => ({
        default: ctx.TpdsProjectFlusher,
      })
    )

    ctx.ProjectUploadManager = (await import(MODULE_PATH)).default
  })

  afterEach(function () {
    timekeeper.reset()
  })

  describe('createProjectFromZipArchive', function () {
    describe('when the title can be read from the root document', function () {
      beforeEach(async function (ctx) {
        await ctx.ProjectUploadManager.promises.createProjectFromZipArchive(
          ctx.ownerId,
          ctx.projectName,
          ctx.zipPath
        )
      })

      it('should extract the archive', function (ctx) {
        ctx.ArchiveManager.promises.extractZipArchive.should.have.been.calledWith(
          ctx.zipPath,
          ctx.extractedZipPath
        )
      })

      it('should create a project', function (ctx) {
        ctx.ProjectCreationHandler.promises.createBlankProject.should.have.been.calledWith(
          ctx.ownerId,
          ctx.uniqueProjectName
        )
      })

      it('should initialize the file tree', function (ctx) {
        ctx.ProjectEntityMongoUpdateHandler.promises.createNewFolderStructure.should.have.been.calledWith(
          ctx.project._id,
          ctx.docEntries,
          ctx.fileEntries
        )
      })

      it('should notify document updater', function (ctx) {
        ctx.DocumentUpdaterHandler.promises.updateProjectStructure.should.have.been.calledWith(
          ctx.project._id,
          ctx.project.overleaf.history.id,
          ctx.ownerId,
          {
            newDocs: ctx.docEntries,
            newFiles: ctx.fileEntries,
            newProject: { version: ctx.newProjectVersion },
          },
          null
        )
      })

      it('should flush the project to TPDS', function (ctx) {
        ctx.TpdsProjectFlusher.promises.flushProjectToTpds.should.have.been.calledWith(
          ctx.project._id
        )
      })

      it('should set the root document', function (ctx) {
        ctx.ProjectRootDocManager.promises.setRootDocFromName.should.have.been.calledWith(
          ctx.project._id,
          'main.tex'
        )
      })

      it('should remove the destination directory afterwards', function (ctx) {
        ctx.fs.promises.rm.should.have.been.calledWith(ctx.extractedZipPath, {
          recursive: true,
          force: true,
        })
      })
    })

    describe("when the root document can't be determined", function () {
      beforeEach(async function (ctx) {
        ctx.ProjectRootDocManager.promises.findRootDocFileFromDirectory.resolves(
          {}
        )
        await ctx.ProjectUploadManager.promises.createProjectFromZipArchive(
          ctx.ownerId,
          ctx.projectName,
          ctx.zipPath
        )
      })

      it('should not try to set the root doc', function (ctx) {
        ctx.ProjectRootDocManager.promises.setRootDocFromName.should.not.have
          .been.called
      })
    })

    describe('when extraction fails', function () {
      beforeEach(async function (ctx) {
        ctx.ArchiveManager.promises.extractZipArchive.rejects(new Error('oops'))
        await expect(
          ctx.ProjectUploadManager.promises.createProjectFromZipArchive(
            ctx.ownerId,
            ctx.projectName,
            ctx.zipPath
          )
        ).to.be.rejectedWith('oops')
      })

      it('should remove the destination directory', function (ctx) {
        ctx.fs.promises.rm.should.have.been.calledWith(ctx.extractedZipPath, {
          recursive: true,
          force: true,
        })
      })
    })

    describe('when project creation fails', function () {
      beforeEach(async function (ctx) {
        ctx.ProjectCreationHandler.promises.createBlankProject.rejects(
          new Error('oops')
        )
        await expect(
          ctx.ProjectUploadManager.promises.createProjectFromZipArchive(
            ctx.ownerId,
            ctx.projectName,
            ctx.zipPath
          )
        ).to.be.rejectedWith('oops')
      })

      it('should remove the destination directory', function (ctx) {
        ctx.fs.promises.rm.should.have.been.calledWith(ctx.extractedZipPath, {
          recursive: true,
          force: true,
        })
      })
    })
  })

  describe('createProjectFromZipArchiveWithName', function () {
    beforeEach(async function (ctx) {
      await ctx.ProjectUploadManager.promises.createProjectFromZipArchiveWithName(
        ctx.ownerId,
        ctx.projectName,
        ctx.zipPath
      )
    })

    it('should extract the archive', function (ctx) {
      ctx.ArchiveManager.promises.extractZipArchive.should.have.been.calledWith(
        ctx.zipPath,
        ctx.extractedZipPath
      )
    })

    it('should create a project owned by the owner_id', function (ctx) {
      ctx.ProjectCreationHandler.promises.createBlankProject.should.have.been.calledWith(
        ctx.ownerId,
        ctx.uniqueProjectName
      )
    })

    it('should automatically set the root doc', function (ctx) {
      ctx.ProjectRootDocManager.promises.setRootDocAutomatically.should.have.been.calledWith(
        ctx.project._id
      )
    })

    it('should initialize the file tree', function (ctx) {
      ctx.ProjectEntityMongoUpdateHandler.promises.createNewFolderStructure.should.have.been.calledWith(
        ctx.project._id,
        ctx.docEntries,
        ctx.fileEntries
      )
    })

    it('should notify document updater', function (ctx) {
      ctx.DocumentUpdaterHandler.promises.updateProjectStructure.should.have.been.calledWith(
        ctx.project._id,
        ctx.project.overleaf.history.id,
        ctx.ownerId,
        {
          newDocs: ctx.docEntries,
          newFiles: ctx.fileEntries,
          newProject: { version: ctx.newProjectVersion },
        },
        null
      )
    })

    it('should flush the project to TPDS', function (ctx) {
      ctx.TpdsProjectFlusher.promises.flushProjectToTpds.should.have.been.calledWith(
        ctx.project._id
      )
    })

    it('should remove the destination directory afterwards', function (ctx) {
      ctx.fs.promises.rm.should.have.been.calledWith(ctx.extractedZipPath, {
        recursive: true,
        force: true,
      })
    })

    describe('when initializing the folder structure fails', function () {
      beforeEach(async function (ctx) {
        ctx.ProjectEntityMongoUpdateHandler.promises.createNewFolderStructure.rejects()
        await expect(
          ctx.ProjectUploadManager.promises.createProjectFromZipArchiveWithName(
            ctx.ownerId,
            ctx.projectName,
            ctx.zipPath
          )
        ).to.be.rejected
      })

      it('should cleanup the blank project created', async function (ctx) {
        ctx.ProjectDeleter.promises.deleteProject.should.have.been.calledWith(
          ctx.project._id,
          { deletedReason: 'zip-import-failure' }
        )
      })

      it('should remove the destination directory', function (ctx) {
        ctx.fs.promises.rm.should.have.been.calledWith(ctx.extractedZipPath, {
          recursive: true,
          force: true,
        })
      })
    })

    describe('when setting automatically the root doc fails', function () {
      beforeEach(async function (ctx) {
        ctx.ProjectRootDocManager.promises.setRootDocAutomatically.rejects()
        await expect(
          ctx.ProjectUploadManager.promises.createProjectFromZipArchiveWithName(
            ctx.ownerId,
            ctx.projectName,
            ctx.zipPath
          )
        ).to.be.rejected
      })

      it('should cleanup the blank project created', function (ctx) {
        ctx.ProjectDeleter.promises.deleteProject.should.have.been.calledWith(
          ctx.project._id,
          { deletedReason: 'zip-import-failure' }
        )
      })

      it('should remove the destination directory', function (ctx) {
        ctx.fs.promises.rm.should.have.been.calledWith(ctx.extractedZipPath, {
          recursive: true,
          force: true,
        })
      })
    })

    describe('when extraction fails', function () {
      beforeEach(async function (ctx) {
        ctx.ArchiveManager.promises.extractZipArchive.rejects(new Error('oops'))
        await expect(
          ctx.ProjectUploadManager.promises.createProjectFromZipArchiveWithName(
            ctx.ownerId,
            ctx.projectName,
            ctx.zipPath
          )
        ).to.be.rejectedWith('oops')
      })

      it('should remove the destination directory', function (ctx) {
        ctx.fs.promises.rm.should.have.been.calledWith(ctx.extractedZipPath, {
          recursive: true,
          force: true,
        })
      })
    })
  })

  describe('createProjectFromZipArchiveWithName import concurrency', function () {
    it('should create import entries in parallel with a limit of five', async function (ctx) {
      ctx.importEntries = Array.from({ length: 6 }, (_, index) => ({
        type: 'file',
        projectPath: `/file-${index}.png`,
        fsPath: `/path/to/file-${index}.png`,
      }))
      ctx.FileSystemImportManager.promises.importDir.resetBehavior()
      ctx.FileSystemImportManager.promises.importDir
        .withArgs(ctx.topLevelDestination)
        .resolves(ctx.importEntries)

      let releaseUploads
      const uploadsReleased = new Promise(resolve => {
        releaseUploads = resolve
      })

      ctx.FileStoreHandler.promises.uploadFileFromDiskWithHistoryId.resetBehavior()
      ctx.FileStoreHandler.promises.uploadFileFromDiskWithHistoryId.callsFake(
        async (_projectId, _historyId, fileMeta) => {
          await uploadsReleased
          return {
            createdBlob: true,
            fileRef: {
              _id: new ObjectId(),
              name: fileMeta.name,
            },
          }
        }
      )

      const uploadPromise =
        ctx.ProjectUploadManager.promises.createProjectFromZipArchiveWithName(
          ctx.ownerId,
          ctx.projectName,
          ctx.zipPath
        )

      await vi.waitFor(() => {
        expect(
          ctx.FileStoreHandler.promises.uploadFileFromDiskWithHistoryId
            .callCount
        ).to.equal(5)
      })

      releaseUploads()

      const { fileEntries, docEntries } = await uploadPromise

      expect(
        ctx.FileStoreHandler.promises.uploadFileFromDiskWithHistoryId.callCount
      ).to.equal(6)
      expect(fileEntries).to.have.length(6)
      expect(docEntries).to.have.length(0)
    })

    it('should stop starting queued imports after the first failure', async function (ctx) {
      ctx.importEntries = Array.from({ length: 6 }, (_, index) => ({
        type: 'file',
        projectPath: `/file-${index}.png`,
        fsPath: `/path/to/file-${index}.png`,
      }))
      ctx.FileSystemImportManager.promises.importDir.resetBehavior()
      ctx.FileSystemImportManager.promises.importDir
        .withArgs(ctx.topLevelDestination)
        .resolves(ctx.importEntries)

      const uploadError = new Error('upload failed')
      const releaseUploadsByName = new Map()
      let failUpload

      ctx.FileStoreHandler.promises.uploadFileFromDiskWithHistoryId.resetBehavior()
      ctx.FileStoreHandler.promises.uploadFileFromDiskWithHistoryId.callsFake(
        async (_projectId, _historyId, fileMeta) => {
          if (fileMeta.name === 'file-0.png') {
            await new Promise((_resolve, reject) => {
              failUpload = () => reject(uploadError)
            })
          } else {
            await new Promise(resolve => {
              releaseUploadsByName.set(fileMeta.name, resolve)
            })
          }

          return {
            createdBlob: true,
            fileRef: {
              _id: new ObjectId(),
              name: fileMeta.name,
            },
          }
        }
      )

      const uploadPromise =
        ctx.ProjectUploadManager.promises.createProjectFromZipArchiveWithName(
          ctx.ownerId,
          ctx.projectName,
          ctx.zipPath
        )

      await vi.waitFor(() => {
        expect(
          ctx.FileStoreHandler.promises.uploadFileFromDiskWithHistoryId
            .callCount
        ).to.equal(5)
        expect(releaseUploadsByName.size).to.equal(4)
        expect(failUpload).to.be.a('function')
      })

      failUpload()

      for (const releaseUpload of releaseUploadsByName.values()) {
        releaseUpload()
      }

      await expect(uploadPromise).to.be.rejectedWith('upload failed')
      expect(
        ctx.FileStoreHandler.promises.uploadFileFromDiskWithHistoryId.callCount
      ).to.equal(5)
    })

    it('should preserve doc and file order from the import entries', async function (ctx) {
      ctx.importEntries = [
        {
          type: 'doc',
          projectPath: '/a.tex',
          lines: ['a'],
        },
        {
          type: 'file',
          projectPath: '/b.png',
          fsPath: '/path/to/b.png',
        },
        {
          type: 'doc',
          projectPath: '/c.tex',
          lines: ['c'],
        },
        {
          type: 'file',
          projectPath: '/d.png',
          fsPath: '/path/to/d.png',
        },
      ]
      ctx.FileSystemImportManager.promises.importDir.resetBehavior()
      ctx.FileSystemImportManager.promises.importDir
        .withArgs(ctx.topLevelDestination)
        .resolves(ctx.importEntries)

      const docNameById = new Map()
      const releaseByPath = new Map()

      ctx.Doc.resetBehavior()
      ctx.Doc.callsFake(({ name }) => {
        const doc = {
          _id: new ObjectId(),
          name,
        }
        docNameById.set(doc._id.toString(), name)
        return doc
      })

      ctx.DocstoreManager.promises.updateDoc.resetBehavior()
      ctx.DocstoreManager.promises.updateDoc.callsFake(
        async (_projectId, docId) => {
          const releasePromise = new Promise(resolve => {
            releaseByPath.set(docNameById.get(docId), resolve)
          })
          await releasePromise
          return { _id: docId }
        }
      )

      ctx.FileStoreHandler.promises.uploadFileFromDiskWithHistoryId.resetBehavior()
      ctx.FileStoreHandler.promises.uploadFileFromDiskWithHistoryId.callsFake(
        async (_projectId, _historyId, fileMeta) => {
          const releasePromise = new Promise(resolve => {
            releaseByPath.set(fileMeta.name, resolve)
          })
          await releasePromise
          return {
            createdBlob: true,
            fileRef: {
              _id: new ObjectId(),
              name: fileMeta.name,
            },
          }
        }
      )

      const uploadPromise =
        ctx.ProjectUploadManager.promises.createProjectFromZipArchiveWithName(
          ctx.ownerId,
          ctx.projectName,
          ctx.zipPath
        )

      await vi.waitFor(() => {
        expect(releaseByPath.size).to.equal(4)
      })

      releaseByPath.get('d.png')()
      releaseByPath.get('c.tex')()
      releaseByPath.get('b.png')()
      releaseByPath.get('a.tex')()

      const { fileEntries, docEntries } = await uploadPromise

      expect(docEntries.map(entry => entry.path)).to.deep.equal([
        '/a.tex',
        '/c.tex',
      ])
      expect(fileEntries.map(entry => entry.path)).to.deep.equal([
        '/b.png',
        '/d.png',
      ])
    })
  })
})
