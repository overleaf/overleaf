import { vi, expect } from 'vitest'
import sinon from 'sinon'
import Errors from '../../../../app/src/Features/Errors/Errors.js'
import mongodb from 'mongodb-legacy'

vi.mock('../../../../app/src/Features/Errors/Errors.js', () =>
  vi.importActual('../../../../app/src/Features/Errors/Errors.js')
)

const { ObjectId } = mongodb

const MODULE_PATH =
  '../../../../app/src/Features/Project/ProjectEntityUpdateHandler'

describe('ProjectEntityUpdateHandler', function () {
  const projectId = '4eecb1c1bffa66588e0000a1'
  const projectHistoryId = '123456'
  const docId = '4eecb1c1bffa66588e0000a2'
  const fileId = '4eecaffcbffa66588e000009'
  const folderId = '4eecaffcbffa66588e000008'
  const newFileId = '4eecaffcbffa66588e000099'
  const userId = 1234

  beforeEach(async function (ctx) {
    ctx.project = {
      _id: projectId,
      name: 'project name',
      overleaf: {
        history: {
          id: projectHistoryId,
        },
      },
    }
    ctx.user = { _id: new ObjectId() }

    ctx.DocModel = class Doc {
      constructor(options) {
        this.name = options.name
        this.lines = options.lines
        this._id = docId
        this.rev = options.rev ?? 0
      }
    }
    ctx.FileModel = class File {
      constructor(options) {
        this.name = options.name
        // use a new id for replacement files
        if (this.name === 'dummy-upload-filename') {
          this._id = newFileId
        } else {
          this._id = fileId
        }
        this.rev = 0
        if (options.linkedFileData != null) {
          this.linkedFileData = options.linkedFileData
        }
        if (options.hash != null) {
          this.hash = options.hash
        }
      }
    }
    ctx.docName = 'doc-name'
    ctx.docLines = ['1234', 'abc']
    ctx.doc = { _id: new ObjectId(), name: ctx.docName }

    ctx.fileName = 'something.jpg'
    ctx.fileSystemPath = 'somehintg'
    ctx.file = { _id: new ObjectId(), name: ctx.fileName, rev: 2 }

    ctx.linkedFileData = { provider: 'url' }

    ctx.source = 'editor'
    ctx.callback = sinon.stub()

    ctx.DocstoreManager = {
      promises: {
        getDoc: sinon.stub(),
        isDocDeleted: sinon.stub(),
        updateDoc: sinon.stub(),
        deleteDoc: sinon.stub(),
      },
    }
    ctx.DocumentUpdaterHandler = {
      promises: {
        flushDocToMongo: sinon.stub().resolves(),
        flushProjectToMongo: sinon.stub().resolves(),
        updateProjectStructure: sinon.stub().resolves(),
        setDocument: sinon.stub(),
        resyncProjectHistory: sinon.stub().resolves(),
        deleteDoc: sinon.stub().resolves(),
      },
    }
    ctx.fs = {
      promises: {
        unlink: sinon.stub().resolves(),
      },
    }
    ctx.LockManager = {
      promises: {
        runWithLock: sinon.spy((namespace, id, runner, callback) =>
          runner(callback)
        ),
      },
      withTimeout: sinon.stub().returns(ctx.LockManager),
    }
    ctx.ProjectModel = {
      updateOne: sinon.stub().returns({ exec: sinon.stub().resolves() }),
    }
    ctx.ProjectGetter = {
      promises: {
        getProject: sinon.stub(),
        getProjectWithoutDocLines: sinon.stub(),
      },
    }
    ctx.ProjectLocator = {
      promises: {
        findElement: sinon.stub(),
        findElementByPath: sinon.stub(),
      },
    }
    ctx.ProjectUpdater = {
      promises: {
        markAsUpdated: sinon.stub().resolves(),
      },
    }
    ctx.ProjectEntityHandler = {
      getAllEntitiesFromProject: sinon.stub(),
      promises: {
        getDoc: sinon.stub(),
        getDocPathByProjectIdAndDocId: sinon.stub(),
      },
    }
    ctx.ProjectEntityMongoUpdateHandler = {
      promises: {
        addDoc: sinon.stub(),
        addFile: sinon.stub(),
        addFolder: sinon.stub(),
        _confirmFolder: sinon.stub(),
        _putElement: sinon.stub(),
        replaceFileWithNew: sinon.stub(),
        mkdirp: sinon.stub(),
        moveEntity: sinon.stub(),
        renameEntity: sinon.stub().resolves({}),
        deleteEntity: sinon.stub(),
        replaceDocWithFile: sinon.stub(),
        replaceFileWithDoc: sinon.stub(),
      },
    }
    ctx.TpdsUpdateSender = {
      promises: {
        addFile: sinon.stub().resolves(),
        addDoc: sinon.stub(),
        deleteEntity: sinon.stub().resolves(),
        moveEntity: sinon.stub().resolves(),
      },
    }
    ctx.FileStoreHandler = {
      promises: {
        uploadFileFromDisk: sinon.stub(),
      },
    }
    ctx.FileWriter = {
      promises: {
        writeLinesToDisk: sinon.stub(),
      },
    }
    ctx.EditorRealTimeController = {
      emitToRoom: sinon.stub(),
    }
    ctx.ProjectOptionsHandler = {
      setHistoryRangesSupport: sinon.stub().resolves(),
    }

    vi.doMock('@overleaf/settings', () => ({
      default: { validRootDocExtensions: ['tex'] },
    }))

    vi.doMock('fs', () => ({
      default: ctx.fs,
    }))

    vi.doMock('../../../../app/src/models/Doc', () => ({
      Doc: ctx.DocModel,
    }))

    vi.doMock('../../../../app/src/Features/Docstore/DocstoreManager', () => ({
      default: ctx.DocstoreManager,
    }))

    vi.doMock(
      '../../../../app/src/Features/DocumentUpdater/DocumentUpdaterHandler',
      () => ({
        default: ctx.DocumentUpdaterHandler,
      })
    )

    vi.doMock('../../../../app/src/models/File', () => ({
      File: ctx.FileModel,
    }))

    vi.doMock(
      '../../../../app/src/Features/FileStore/FileStoreHandler',
      () => ({
        default: ctx.FileStoreHandler,
      })
    )

    vi.doMock('../../../../app/src/infrastructure/LockManager', () => ({
      default: ctx.LockManager,
    }))

    vi.doMock('../../../../app/src/models/Project', () => ({
      Project: ctx.ProjectModel,
    }))

    vi.doMock('../../../../app/src/Features/Project/ProjectGetter', () => ({
      default: ctx.ProjectGetter,
    }))

    vi.doMock('../../../../app/src/Features/Project/ProjectLocator', () => ({
      default: ctx.ProjectLocator,
    }))

    vi.doMock(
      '../../../../app/src/Features/Project/ProjectUpdateHandler',
      () => ({
        default: ctx.ProjectUpdater,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Project/ProjectEntityHandler',
      () => ({
        default: ctx.ProjectEntityHandler,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Project/ProjectEntityMongoUpdateHandler',
      () => ({
        default: ctx.ProjectEntityMongoUpdateHandler,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Project/ProjectOptionsHandler',
      () => ({
        default: ctx.ProjectOptionsHandler,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/ThirdPartyDataStore/TpdsUpdateSender',
      () => ({
        default: ctx.TpdsUpdateSender,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Editor/EditorRealTimeController',
      () => ({
        default: ctx.EditorRealTimeController,
      })
    )

    vi.doMock('../../../../app/src/infrastructure/FileWriter', () => ({
      default: ctx.FileWriter,
    }))

    ctx.ProjectEntityUpdateHandler = (await import(MODULE_PATH)).default
  })

  describe('updateDocLines', function () {
    beforeEach(function (ctx) {
      ctx.path = '/somewhere/something.tex'
      ctx.doc = {
        _id: docId,
      }
      ctx.version = 42
      ctx.ranges = { mock: 'ranges' }
      ctx.lastUpdatedAt = new Date().getTime()
      ctx.lastUpdatedBy = 'fake-last-updater-id'
      ctx.parentFolder = { _id: new ObjectId() }
      ctx.DocstoreManager.promises.isDocDeleted.resolves(false)
      ctx.ProjectGetter.promises.getProject.resolves(ctx.project)
      ctx.ProjectLocator.promises.findElement.resolves({
        element: ctx.doc,
        path: {
          fileSystem: ctx.path,
        },
        folder: ctx.parentFolder,
      })
      ctx.TpdsUpdateSender.promises.addDoc.resolves()
    })

    describe('when the doc has been modified', function () {
      beforeEach(async function (ctx) {
        ctx.DocstoreManager.promises.updateDoc.resolves({
          modified: true,
          rev: (ctx.rev = 5),
        })

        await ctx.ProjectEntityUpdateHandler.promises.updateDocLines(
          projectId,
          docId,
          ctx.docLines,
          ctx.version,
          ctx.ranges,
          ctx.lastUpdatedAt,
          ctx.lastUpdatedBy
        )
      })

      it('should get the project with very few fields', function (ctx) {
        ctx.ProjectGetter.promises.getProject
          .calledWith(projectId, {
            name: true,
            rootFolder: true,
          })
          .should.equal(true)
      })

      it('should find the doc', function (ctx) {
        ctx.ProjectLocator.promises.findElement
          .calledWith({
            project: ctx.project,
            type: 'docs',
            element_id: docId,
          })
          .should.equal(true)
      })

      it('should update the doc in the docstore', function (ctx) {
        ctx.DocstoreManager.promises.updateDoc
          .calledWith(projectId, docId, ctx.docLines, ctx.version, ctx.ranges)
          .should.equal(true)
      })

      it('should mark the project as updated', function (ctx) {
        sinon.assert.calledWith(
          ctx.ProjectUpdater.promises.markAsUpdated,
          projectId,
          ctx.lastUpdatedAt,
          ctx.lastUpdatedBy
        )
      })

      it('should send the doc to the TPDS', function (ctx) {
        ctx.TpdsUpdateSender.promises.addDoc.should.have.been.calledWith({
          projectId,
          projectName: ctx.project.name,
          docId,
          rev: ctx.rev,
          path: ctx.path,
          folderId: ctx.parentFolder._id,
        })
      })
    })

    describe('when the doc has not been modified', function () {
      beforeEach(async function (ctx) {
        ctx.DocstoreManager.promises.updateDoc.resolves({
          modified: false,
          rev: (ctx.rev = 5),
        })

        await ctx.ProjectEntityUpdateHandler.promises.updateDocLines(
          projectId,
          docId,
          ctx.docLines,
          ctx.version,
          ctx.ranges,
          ctx.lastUpdatedAt,
          ctx.lastUpdatedBy
        )
      })

      it('should not mark the project as updated', function (ctx) {
        ctx.ProjectUpdater.promises.markAsUpdated.called.should.equal(false)
      })

      it('should not send the doc the to the TPDS', function (ctx) {
        ctx.TpdsUpdateSender.promises.addDoc.called.should.equal(false)
      })
    })

    describe('when the doc has been deleted', function () {
      beforeEach(async function (ctx) {
        ctx.ProjectGetter.promises.getProject.resolves(ctx.project)
        ctx.ProjectLocator.promises.findElement.rejects(
          new Errors.NotFoundError()
        )
        ctx.DocstoreManager.promises.isDocDeleted.resolves(true)
        ctx.DocstoreManager.promises.updateDoc.resolves({})

        await ctx.ProjectEntityUpdateHandler.promises.updateDocLines(
          projectId,
          docId,
          ctx.docLines,
          ctx.version,
          ctx.ranges,
          ctx.lastUpdatedAt,
          ctx.lastUpdatedBy
        )
      })

      it('should update the doc in the docstore', function (ctx) {
        ctx.DocstoreManager.promises.updateDoc
          .calledWith(projectId, docId, ctx.docLines, ctx.version, ctx.ranges)
          .should.equal(true)
      })

      it('should not mark the project as updated', function (ctx) {
        ctx.ProjectUpdater.promises.markAsUpdated.called.should.equal(false)
      })

      it('should not send the doc the to the TPDS', function (ctx) {
        ctx.TpdsUpdateSender.promises.addDoc.called.should.equal(false)
      })
    })

    describe('when projects and docs collection are de-synced', function () {
      beforeEach(async function (ctx) {
        ctx.ProjectGetter.promises.getProject.resolves(ctx.project)

        // The doc is not in the file-tree, but also not marked as deleted.
        // This should not happen, but web should handle it.
        ctx.ProjectLocator.promises.findElement.rejects(
          new Errors.NotFoundError()
        )
        ctx.DocstoreManager.promises.isDocDeleted.resolves(false)

        ctx.DocstoreManager.promises.updateDoc.resolves({})

        await ctx.ProjectEntityUpdateHandler.promises.updateDocLines(
          projectId,
          docId,
          ctx.docLines,
          ctx.version,
          ctx.ranges,
          ctx.lastUpdatedAt,
          ctx.lastUpdatedBy
        )
      })

      it('should update the doc in the docstore', function (ctx) {
        ctx.DocstoreManager.promises.updateDoc
          .calledWith(projectId, docId, ctx.docLines, ctx.version, ctx.ranges)
          .should.equal(true)
      })

      it('should not mark the project as updated', function (ctx) {
        ctx.ProjectUpdater.promises.markAsUpdated.called.should.equal(false)
      })

      it('should not send the doc the to the TPDS', function (ctx) {
        ctx.TpdsUpdateSender.promises.addDoc.called.should.equal(false)
      })
    })

    describe('when the doc is not related to the project', function () {
      let updateDocLinesPromise
      beforeEach(function (ctx) {
        ctx.ProjectGetter.promises.getProject.resolves(ctx.project)
        ctx.ProjectLocator.promises.findElement.rejects(
          new Errors.NotFoundError()
        )
        ctx.DocstoreManager.promises.isDocDeleted.rejects(
          new Errors.NotFoundError()
        )

        updateDocLinesPromise =
          ctx.ProjectEntityUpdateHandler.promises.updateDocLines(
            projectId,
            docId,
            ctx.docLines,
            ctx.version,
            ctx.ranges,
            ctx.lastUpdatedAt,
            ctx.lastUpdatedBy
          )
      })

      it('should return a not found error', async function () {
        let error

        try {
          await updateDocLinesPromise
        } catch (err) {
          error = err
        }

        expect(error).to.be.instanceOf(Errors.NotFoundError)
      })

      it('should not update the doc', async function (ctx) {
        let error

        try {
          await updateDocLinesPromise
        } catch (err) {
          error = err
        }

        expect(error).to.exist
        ctx.DocstoreManager.promises.updateDoc.called.should.equal(false)
      })

      it('should not send the doc the to the TPDS', async function (ctx) {
        let error

        try {
          await updateDocLinesPromise
        } catch (err) {
          error = err
        }

        expect(error).to.exist
        ctx.TpdsUpdateSender.promises.addDoc.called.should.equal(false)
      })
    })

    describe('when the project is not found', function () {
      let error
      beforeEach(async function (ctx) {
        ctx.ProjectGetter.promises.getProject.rejects(
          new Errors.NotFoundError()
        )
        try {
          await ctx.ProjectEntityUpdateHandler.promises.updateDocLines(
            projectId,
            docId,
            ctx.docLines,
            ctx.version,
            ctx.ranges,
            ctx.lastUpdatedAt,
            ctx.lastUpdatedBy
          )
        } catch (err) {
          error = err
        }
      })

      it('should return a not found error', async function () {
        expect(error).to.be.instanceOf(Errors.NotFoundError)
      })

      it('should not update the doc', async function (ctx) {
        ctx.DocstoreManager.promises.updateDoc.called.should.equal(false)
      })

      it('should not send the doc the to the TPDS', function (ctx) {
        ctx.TpdsUpdateSender.promises.addDoc.called.should.equal(false)
      })
    })
  })

  describe('setRootDoc', function () {
    beforeEach(function (ctx) {
      ctx.rootDocId = 'root-doc-id-123123'
    })

    it('should call Project.updateOne when the doc exists and has a valid extension', async function (ctx) {
      ctx.ProjectEntityHandler.promises.getDocPathByProjectIdAndDocId.resolves(
        `/main.tex`
      )

      await ctx.ProjectEntityUpdateHandler.promises.setRootDoc(
        projectId,
        ctx.rootDocId
      )

      ctx.ProjectModel.updateOne
        .calledWith({ _id: projectId }, { rootDoc_id: ctx.rootDocId })
        .should.equal(true)
    })

    it("should not call Project.updateOne when the doc doesn't exist", async function (ctx) {
      ctx.ProjectEntityHandler.promises.getDocPathByProjectIdAndDocId.rejects(
        Errors.NotFoundError
      )

      let error

      try {
        await ctx.ProjectEntityUpdateHandler.promises.setRootDoc(
          projectId,
          ctx.rootDocId
        )
      } catch (err) {
        error = err
      }

      expect(error).to.exist

      ctx.ProjectModel.updateOne
        .calledWith({ _id: projectId }, { rootDoc_id: ctx.rootDocId })
        .should.equal(false)
    })

    it('should call the callback with an UnsupportedFileTypeError when the doc has an unaccepted file extension', function (ctx) {
      ctx.ProjectEntityHandler.promises.getDocPathByProjectIdAndDocId.resolves(
        `/foo/bar.baz`
      )

      ctx.ProjectEntityUpdateHandler.setRootDoc(
        projectId,
        ctx.rootDocId,
        error => {
          expect(error).to.be.an.instanceof(Errors.UnsupportedFileTypeError)
        }
      )
    })
  })

  describe('unsetRootDoc', function () {
    it('should call Project.updateOne', async function (ctx) {
      await ctx.ProjectEntityUpdateHandler.promises.unsetRootDoc(projectId)
      ctx.ProjectModel.updateOne
        .calledWith({ _id: projectId }, { $unset: { rootDoc_id: true } })
        .should.equal(true)
    })
  })

  describe('addDoc', function () {
    describe('adding a doc', function () {
      beforeEach(async function (ctx) {
        ctx.path = '/path/to/doc'
        ctx.rev = 5

        ctx.newDoc = new ctx.DocModel({
          name: ctx.docName,
          lines: undefined,
          _id: docId,
          rev: ctx.rev,
        })
        ctx.DocstoreManager.promises.updateDoc.resolves({
          lines: false,
          rev: ctx.rev,
        })
        ctx.TpdsUpdateSender.promises.addDoc.resolves()
        ctx.ProjectEntityMongoUpdateHandler.promises.addDoc.resolves({
          result: { path: { fileSystem: ctx.path } },
          project: ctx.project,
        })
        await ctx.ProjectEntityUpdateHandler.promises.addDoc(
          projectId,
          docId,
          ctx.docName,
          ctx.docLines,
          userId,
          ctx.source
        )
      })

      it('creates the doc without history', function (ctx) {
        ctx.DocstoreManager.promises.updateDoc
          .calledWith(projectId, docId, ctx.docLines, 0, {})
          .should.equal(true)
      })

      it('sends the change in project structure to the doc updater', function (ctx) {
        const newDocs = [
          {
            doc: ctx.newDoc,
            path: ctx.path,
            docLines: ctx.docLines.join('\n'),
            ranges: {},
          },
        ]
        ctx.DocumentUpdaterHandler.promises.updateProjectStructure.should.have.been.calledWith(
          projectId,
          projectHistoryId,
          userId,
          {
            newDocs,
            newProject: ctx.project,
          },
          ctx.source
        )
      })
    })

    describe('adding a doc with an invalid name', function () {
      beforeEach(function (ctx) {
        ctx.path = '/path/to/doc'

        ctx.newDoc = { _id: docId }
      })

      it('returns an error', async function (ctx) {
        let error

        try {
          await ctx.ProjectEntityUpdateHandler.promises.addDoc(
            projectId,
            folderId,
            `*${ctx.docName}`,
            ctx.docLines,
            userId,
            ctx.source
          )
        } catch (err) {
          error = err
        }

        expect(error).to.be.instanceOf(Errors.InvalidNameError)
      })
    })
  })

  describe('addFile', function () {
    describe('adding a file', function () {
      beforeEach(async function (ctx) {
        ctx.path = '/path/to/file'

        ctx.newFile = {
          _id: fileId,
          hash: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
          rev: 0,
          name: ctx.fileName,
          linkedFileData: ctx.linkedFileData,
        }
        ctx.FileStoreHandler.promises.uploadFileFromDisk.resolves({
          fileRef: ctx.newFile,
          createdBlob: true,
        })
        ctx.TpdsUpdateSender.promises.addFile.resolves()
        ctx.ProjectEntityMongoUpdateHandler.promises.addFile.resolves({
          result: { path: { fileSystem: ctx.path } },
          project: ctx.project,
        })
        await ctx.ProjectEntityUpdateHandler.promises.addFile(
          projectId,
          folderId,
          ctx.fileName,
          ctx.fileSystemPath,
          ctx.linkedFileData,
          userId,
          ctx.source
        )
      })

      it('updates the file in the filestore', function (ctx) {
        ctx.FileStoreHandler.promises.uploadFileFromDisk
          .calledWith(
            projectId,
            { name: ctx.fileName, linkedFileData: ctx.linkedFileData },
            ctx.fileSystemPath
          )
          .should.equal(true)
      })

      it('updates the file in mongo', function (ctx) {
        const fileMatcher = sinon.match(file => {
          return file.name === ctx.fileName
        })

        ctx.ProjectEntityMongoUpdateHandler.promises.addFile
          .calledWithMatch(projectId, folderId, fileMatcher)
          .should.equal(true)
      })

      it('notifies the tpds', function (ctx) {
        ctx.TpdsUpdateSender.promises.addFile
          .calledWith({
            projectId,
            historyId: ctx.project.overleaf.history.id,
            projectName: ctx.project.name,
            fileId,
            hash: ctx.newFile.hash,
            rev: 0,
            path: ctx.path,
            folderId,
          })
          .should.equal(true)
      })

      it('sends the change in project structure to the doc updater', function (ctx) {
        const newFiles = [
          {
            file: ctx.newFile,
            path: ctx.path,
            createdBlob: true,
          },
        ]
        ctx.DocumentUpdaterHandler.promises.updateProjectStructure.should.have.been.calledWith(
          projectId,
          projectHistoryId,
          userId,
          {
            newFiles,
            newProject: ctx.project,
          },
          ctx.source
        )
      })
    })

    describe('adding a file with an invalid name', function () {
      beforeEach(function (ctx) {
        ctx.path = '/path/to/file'

        ctx.newFile = {
          _id: fileId,
          hash: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          rev: 0,
          name: ctx.fileName,
          linkedFileData: ctx.linkedFileData,
        }
        ctx.TpdsUpdateSender.promises.addFile.resolves()
        ctx.ProjectEntityMongoUpdateHandler.promises.addFile.resolves({
          result: { path: { fileSystem: ctx.path } },
          project: ctx.project,
        })
      })

      it('returns an error', async function (ctx) {
        let error

        try {
          await ctx.ProjectEntityUpdateHandler.promises.addFile(
            projectId,
            folderId,
            `*${ctx.fileName}`,
            ctx.fileSystemPath,
            ctx.linkedFileData,
            userId,
            ctx.source
          )
        } catch (err) {
          error = err
        }

        expect(error).to.be.instanceOf(Errors.InvalidNameError)
      })
    })
  })

  describe('upsertDoc', function () {
    describe('upserting into an invalid folder', function () {
      beforeEach(function (ctx) {
        ctx.ProjectLocator.promises.findElement.resolves({ element: null })
      })

      it('returns an error', async function (ctx) {
        let error

        try {
          await ctx.ProjectEntityUpdateHandler.promises.upsertDoc(
            projectId,
            folderId,
            ctx.docName,
            ctx.docLines,
            ctx.source,
            userId
          )
        } catch (err) {
          error = err
        }

        expect(error).to.be.instanceOf(Error)
      })
    })

    describe('updating an existing doc', function () {
      let upsertDocResponse
      beforeEach(async function (ctx) {
        ctx.existingDoc = { _id: docId, name: ctx.docName }
        ctx.existingFile = {
          _id: fileId,
          name: ctx.fileName,
          hash: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        }
        ctx.folder = {
          _id: folderId,
          docs: [ctx.existingDoc],
          fileRefs: [ctx.existingFile],
        }
        ctx.ProjectLocator.promises.findElement.resolves({
          element: ctx.folder,
        })
        ctx.DocumentUpdaterHandler.promises.setDocument.resolves()

        upsertDocResponse =
          await ctx.ProjectEntityUpdateHandler.promises.upsertDoc(
            projectId,
            folderId,
            ctx.docName,
            ctx.docLines,
            ctx.source,
            userId
          )
      })

      it('tries to find the folder', function (ctx) {
        ctx.ProjectLocator.promises.findElement
          .calledWith({
            project_id: projectId,
            element_id: folderId,
            type: 'folder',
          })
          .should.equal(true)
      })

      it('updates the doc contents', function (ctx) {
        ctx.DocumentUpdaterHandler.promises.setDocument
          .calledWith(
            projectId,
            ctx.existingDoc._id,
            userId,
            ctx.docLines,
            ctx.source
          )
          .should.equal(true)
      })

      it('returns the doc', function (ctx) {
        expect(upsertDocResponse.isNew).to.equal(false)
        expect(upsertDocResponse.doc).to.eql(ctx.existingDoc)
      })
    })

    describe('creating a new doc', function () {
      let upsertDocResponse

      beforeEach(async function (ctx) {
        ctx.folder = { _id: folderId, docs: [], fileRefs: [] }
        ctx.newDoc = { _id: docId }
        ctx.ProjectLocator.promises.findElement.resolves({
          element: ctx.folder,
        })
        ctx.ProjectEntityUpdateHandler.promises.addDocWithRanges = {
          withoutLock: sinon.stub().resolves({ doc: ctx.newDoc }),
        }

        upsertDocResponse =
          await ctx.ProjectEntityUpdateHandler.promises.upsertDoc(
            projectId,
            folderId,
            ctx.docName,
            ctx.docLines,
            ctx.source,
            userId
          )
      })

      it('tries to find the folder', function (ctx) {
        ctx.ProjectLocator.promises.findElement
          .calledWith({
            project_id: projectId,
            element_id: folderId,
            type: 'folder',
          })
          .should.equal(true)
      })

      it('adds the doc', function (ctx) {
        ctx.ProjectEntityUpdateHandler.promises.addDocWithRanges.withoutLock.should.have.been.calledWith(
          projectId,
          folderId,
          ctx.docName,
          ctx.docLines,
          {},
          userId,
          ctx.source
        )
      })

      it('returns the doc', function (ctx) {
        expect(upsertDocResponse.isNew).to.equal(true)
        expect(upsertDocResponse.doc).to.equal(ctx.newDoc)
      })
    })

    describe('upserting a new doc with an invalid name', function () {
      beforeEach(function (ctx) {
        ctx.folder = { _id: folderId, docs: [], fileRefs: [] }
        ctx.newDoc = { _id: docId }
        ctx.ProjectLocator.promises.findElement.resolves({
          element: ctx.folder,
        })
        ctx.ProjectEntityUpdateHandler.promises.addDocWithRanges = {
          withoutLock: sinon.stub().resolves({ doc: ctx.newDoc }),
        }
      })

      it('returns an error', async function (ctx) {
        let error

        try {
          await ctx.ProjectEntityUpdateHandler.promises.upsertDoc(
            projectId,
            folderId,
            `*${ctx.docName}`,
            ctx.docLines,
            ctx.source,
            userId
          )
        } catch (err) {
          error = err
        }

        expect(error).to.be.instanceOf(Errors.InvalidNameError)
      })
    })

    describe('upserting a doc on top of a file', function () {
      beforeEach(async function (ctx) {
        ctx.newProject = {
          name: 'new project',
          overleaf: { history: { id: projectHistoryId } },
        }
        ctx.existingFile = { _id: fileId, name: 'foo.tex', rev: 12 }
        ctx.folder = { _id: folderId, docs: [], fileRefs: [ctx.existingFile] }
        ctx.newDoc = { _id: docId }
        ctx.docLines = ['line one', 'line two']
        ctx.folderPath = '/path/to/folder'
        ctx.filePath = '/path/to/folder/foo.tex'
        ctx.ProjectLocator.promises.findElement
          .withArgs({
            project_id: projectId,
            element_id: ctx.folder._id,
            type: 'folder',
          })
          .resolves({
            element: ctx.folder,
            path: {
              fileSystem: ctx.folderPath,
            },
          })
        ctx.DocstoreManager.promises.updateDoc.resolves({ rev: null })
        ctx.ProjectEntityMongoUpdateHandler.promises.replaceFileWithDoc.resolves(
          ctx.newProject
        )
        ctx.TpdsUpdateSender.promises.addDoc.resolves()

        await ctx.ProjectEntityUpdateHandler.promises.upsertDoc(
          projectId,
          folderId,
          'foo.tex',
          ctx.docLines,
          ctx.source,
          userId
        )
      })

      it('notifies docstore of the new doc', function (ctx) {
        expect(ctx.DocstoreManager.promises.updateDoc).to.have.been.calledWith(
          projectId,
          ctx.newDoc._id,
          ctx.docLines
        )
      })

      it('adds the new doc and removes the file in one go', function (ctx) {
        expect(
          ctx.ProjectEntityMongoUpdateHandler.promises.replaceFileWithDoc
        ).to.have.been.calledWithMatch(
          projectId,
          ctx.existingFile._id,
          ctx.newDoc
        )
      })

      it('sends the doc to TPDS', function (ctx) {
        expect(ctx.TpdsUpdateSender.promises.addDoc).to.have.been.calledWith({
          projectId,
          docId: ctx.newDoc._id,
          path: ctx.filePath,
          projectName: ctx.newProject.name,
          rev: ctx.existingFile.rev + 1,
          folderId,
        })
      })

      it('sends the updates to the doc updater', function (ctx) {
        const oldFiles = [
          {
            file: ctx.existingFile,
            path: ctx.filePath,
          },
        ]
        const newDocs = [
          {
            doc: sinon.match(ctx.newDoc),
            path: ctx.filePath,
            docLines: ctx.docLines.join('\n'),
          },
        ]
        expect(
          ctx.DocumentUpdaterHandler.promises.updateProjectStructure
        ).to.have.been.calledWith(
          projectId,
          projectHistoryId,
          userId,
          {
            oldFiles,
            newDocs,
            newProject: ctx.newProject,
          },
          ctx.source
        )
      })

      it('should notify everyone of the file deletion', function (ctx) {
        expect(ctx.EditorRealTimeController.emitToRoom).to.have.been.calledWith(
          projectId,
          'removeEntity',
          ctx.existingFile._id,
          'convertFileToDoc'
        )
      })
    })
  })

  describe('upsertFile', function () {
    beforeEach(function (ctx) {
      ctx.FileStoreHandler.promises.uploadFileFromDisk.resolves({
        fileRef: ctx.file,
        createdBlob: true,
      })
    })

    describe('upserting into an invalid folder', function () {
      beforeEach(function (ctx) {
        ctx.ProjectLocator.promises.findElement.resolves({ element: null })
      })

      it('returns an error', async function (ctx) {
        let error

        try {
          await ctx.ProjectEntityUpdateHandler.promises.upsertFile(
            projectId,
            folderId,
            ctx.fileName,
            ctx.fileSystemPath,
            ctx.linkedFileData,
            userId,
            ctx.source
          )
        } catch (err) {
          error = err
        }

        expect(error).to.be.instanceOf(Error)
      })
    })

    describe('updating an existing file', function () {
      let upsertFileResult
      beforeEach(async function (ctx) {
        ctx.existingFile = { _id: fileId, name: ctx.fileName, rev: 1 }
        ctx.newFile = {
          _id: new ObjectId(),
          name: ctx.fileName,
          rev: 3,
          hash: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        }
        ctx.folder = { _id: folderId, fileRefs: [ctx.existingFile], docs: [] }
        ctx.ProjectLocator.promises.findElement.resolves({
          element: ctx.folder,
        })
        ctx.newProject = 'new-project-stub'
        ctx.ProjectEntityMongoUpdateHandler.promises.replaceFileWithNew.resolves(
          {
            oldFileRef: ctx.existingFile,
            project: ctx.project,
            path: { fileSystem: ctx.fileSystemPath },
            newProject: ctx.newProject,
            newFileRef: ctx.newFile,
          }
        )
        upsertFileResult =
          await ctx.ProjectEntityUpdateHandler.promises.upsertFile(
            projectId,
            folderId,
            ctx.fileName,
            ctx.fileSystemPath,
            ctx.linkedFileData,
            userId,
            ctx.source
          )
      })

      it('uploads a new version of the file', function (ctx) {
        ctx.FileStoreHandler.promises.uploadFileFromDisk.should.have.been.calledWith(
          projectId,
          {
            name: ctx.fileName,
            linkedFileData: ctx.linkedFileData,
          },
          ctx.fileSystemPath
        )
      })

      it('replaces the file in mongo', function (ctx) {
        ctx.ProjectEntityMongoUpdateHandler.promises.replaceFileWithNew.should.have.been.calledWith(
          projectId,
          ctx.existingFile._id,
          ctx.file,
          userId
        )
      })

      it('notifies the tpds', function (ctx) {
        ctx.TpdsUpdateSender.promises.addFile.should.have.been.calledWith({
          projectId,
          historyId: ctx.project.overleaf.history.id,
          projectName: ctx.project.name,
          fileId: ctx.newFile._id,
          hash: ctx.newFile.hash,
          rev: ctx.newFile.rev,
          path: ctx.fileSystemPath,
          folderId,
        })
      })

      it('updates the project structure in the doc updater', function (ctx) {
        const oldFiles = [
          {
            file: ctx.existingFile,
            path: ctx.fileSystemPath,
          },
        ]
        const newFiles = [
          {
            file: ctx.newFile,
            path: ctx.fileSystemPath,
            createdBlob: true,
          },
        ]
        ctx.DocumentUpdaterHandler.promises.updateProjectStructure.should.have.been.calledWith(
          projectId,
          projectHistoryId,
          userId,
          {
            oldFiles,
            newFiles,
            newProject: ctx.newProject,
          },
          ctx.source
        )
      })

      it('returns the file', function (ctx) {
        expect(upsertFileResult.isNew).to.be.false
        expect(upsertFileResult.fileRef.toString()).to.eql(
          ctx.existingFile.toString()
        )
      })
    })

    describe('creating a new file', function () {
      let upsertFileResult
      beforeEach(async function (ctx) {
        ctx.folder = { _id: folderId, fileRefs: [], docs: [] }
        ctx.newFile = {
          _id: fileId,
          hash: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        }
        ctx.ProjectLocator.promises.findElement.resolves({
          element: ctx.folder,
        })
        ctx.FileStoreHandler.promises.uploadFileFromDisk.resolves({
          fileRef: ctx.newFile,
          createdBlob: true,
        })
        ctx.ProjectEntityUpdateHandler.promises.addFile = {
          mainTask: sinon.stub().resolves(ctx.newFile),
        }

        upsertFileResult =
          await ctx.ProjectEntityUpdateHandler.promises.upsertFile(
            projectId,
            folderId,
            ctx.fileName,
            ctx.fileSystemPath,
            ctx.linkedFileData,
            userId,
            ctx.source
          )
      })

      it('tries to find the folder', function (ctx) {
        ctx.ProjectLocator.promises.findElement.should.have.been.calledWith({
          project_id: projectId,
          element_id: folderId,
          type: 'folder',
        })
      })

      it('adds the file', function (ctx) {
        expect(
          ctx.ProjectEntityUpdateHandler.promises.addFile.mainTask
        ).to.have.been.calledWith({
          projectId,
          folderId,
          userId,
          fileRef: ctx.newFile,
          source: ctx.source,
          createdBlob: true,
        })
      })

      it('returns the file', function (ctx) {
        expect(upsertFileResult.fileRef).to.eql(ctx.newFile)
        expect(upsertFileResult.isNew).to.be.true
      })
    })

    describe('upserting a new file with an invalid name', function () {
      beforeEach(function (ctx) {
        ctx.folder = { _id: folderId, fileRefs: [] }
        ctx.newFile = { _id: fileId }
        ctx.ProjectLocator.promises.findElement.resolves({
          element: ctx.folder,
        })
        ctx.ProjectEntityUpdateHandler.promises.addFile = {
          mainTask: sinon.stub().resolves(ctx.newFile),
        }
      })

      it('returns an error', async function (ctx) {
        let error

        try {
          await ctx.ProjectEntityUpdateHandler.promises.upsertFile(
            projectId,
            folderId,
            `*${ctx.fileName}`,
            ctx.fileSystemPath,
            ctx.linkedFileData,
            userId,
            ctx.source
          )
        } catch (err) {
          error = err
        }

        expect(error).to.be.instanceOf(Errors.InvalidNameError)
      })
    })

    describe('upserting file on top of a doc', function () {
      beforeEach(async function (ctx) {
        ctx.path = '/path/to/doc'
        ctx.existingDoc = { _id: new ObjectId(), name: ctx.fileName }
        ctx.folder = {
          _id: folderId,
          fileRefs: [],
          docs: [ctx.existingDoc],
        }
        ctx.ProjectLocator.promises.findElement
          .withArgs({
            project_id: ctx.project._id.toString(),
            element_id: folderId,
            type: 'folder',
          })
          .resolves({ element: ctx.folder })
        ctx.ProjectLocator.promises.findElement
          .withArgs({
            project_id: ctx.project._id.toString(),
            element_id: ctx.existingDoc._id,
            type: 'doc',
          })
          .resolves({
            element: ctx.existingDoc,
            path: { fileSystem: ctx.path },
            folder: ctx.folder,
          })

        ctx.newFile = {
          _id: newFileId,
          name: 'dummy-upload-filename',
          rev: 0,
          linkedFileData: ctx.linkedFileData,
        }
        ctx.newProject = {
          name: 'new project',
          overleaf: { history: { id: projectHistoryId } },
        }
        ctx.FileStoreHandler.promises.uploadFileFromDisk.resolves({
          fileRef: ctx.newFile,
          createdBlob: true,
        })
        ctx.ProjectEntityMongoUpdateHandler.promises.replaceDocWithFile.resolves(
          ctx.newProject
        )

        await ctx.ProjectEntityUpdateHandler.promises.upsertFile(
          projectId,
          folderId,
          ctx.fileName,
          ctx.fileSystemPath,
          ctx.linkedFileData,
          userId,
          ctx.source
        )
      })

      it('replaces the existing doc with a file', function (ctx) {
        expect(
          ctx.ProjectEntityMongoUpdateHandler.promises.replaceDocWithFile
        ).to.have.been.calledWith(
          projectId,
          ctx.existingDoc._id,
          ctx.newFile,
          userId
        )
      })

      it('updates the doc structure', function (ctx) {
        const oldDocs = [
          {
            doc: ctx.existingDoc,
            path: ctx.path,
          },
        ]
        const newFiles = [
          {
            file: ctx.newFile,
            path: ctx.path,
            createdBlob: true,
          },
        ]
        const updates = {
          oldDocs,
          newFiles,
          newProject: ctx.newProject,
        }
        expect(
          ctx.DocumentUpdaterHandler.promises.updateProjectStructure
        ).to.have.been.calledWith(
          projectId,
          projectHistoryId,
          userId,
          updates,
          ctx.source
        )
      })

      it('tells everyone in the room the doc is removed', function (ctx) {
        expect(ctx.EditorRealTimeController.emitToRoom).to.have.been.calledWith(
          projectId,
          'removeEntity',
          ctx.existingDoc._id,
          'convertDocToFile'
        )
      })
    })
  })

  describe('upsertDocWithPath', function () {
    describe('upserting a doc', function () {
      let upsertDocWithPathResult
      beforeEach(async function (ctx) {
        ctx.path = '/folder/doc.tex'
        ctx.newFolders = ['mock-a', 'mock-b']
        ctx.folder = { _id: folderId }
        ctx.doc = { _id: docId }
        ctx.isNewDoc = true
        ctx.ProjectEntityUpdateHandler.promises.mkdirp = {
          withoutLock: sinon
            .stub()
            .resolves({ newFolders: ctx.newFolders, folder: ctx.folder }),
        }
        ctx.ProjectEntityUpdateHandler.promises.upsertDoc = {
          withoutLock: sinon
            .stub()
            .resolves({ doc: ctx.doc, isNew: ctx.isNewDoc }),
        }

        upsertDocWithPathResult =
          await ctx.ProjectEntityUpdateHandler.promises.upsertDocWithPath(
            projectId,
            ctx.path,
            ctx.docLines,
            ctx.source,
            userId
          )
      })

      it('creates any necessary folders', function (ctx) {
        ctx.ProjectEntityUpdateHandler.promises.mkdirp.withoutLock
          .calledWith(projectId, '/folder', userId)
          .should.equal(true)
      })

      it('upserts the doc', function (ctx) {
        ctx.ProjectEntityUpdateHandler.promises.upsertDoc.withoutLock
          .calledWith(
            projectId,
            ctx.folder._id,
            'doc.tex',
            ctx.docLines,
            ctx.source,
            userId
          )
          .should.equal(true)
      })

      it('returns a doc, the isNewDoc flag, newFolders and a folder', function (ctx) {
        expect(upsertDocWithPathResult).to.eql({
          doc: ctx.doc,
          isNew: ctx.isNewDoc,
          newFolders: ctx.newFolders,
          folder: ctx.folder,
        })
      })
    })

    describe('upserting a doc with an invalid path', function () {
      beforeEach(function (ctx) {
        ctx.path = '/*folder/doc.tex'
        ctx.newFolders = ['mock-a', 'mock-b']
        ctx.folder = { _id: folderId }
        ctx.doc = { _id: docId }
        ctx.isNewDoc = true
        ctx.ProjectEntityUpdateHandler.promises.mkdirp = {
          withoutLock: sinon
            .stub()
            .resolves({ newFolders: ctx.newFolders, folder: ctx.folder }),
        }
        ctx.ProjectEntityUpdateHandler.promises.upsertDoc = {
          withoutLock: sinon
            .stub()
            .resolves({ doc: ctx.doc, isNew: ctx.isNewDoc }),
        }
      })

      it('returns an error', async function (ctx) {
        let error

        try {
          await ctx.ProjectEntityUpdateHandler.promises.upsertDocWithPath(
            projectId,
            ctx.path,
            ctx.docLines,
            ctx.source,
            userId
          )
        } catch (err) {
          error = err
        }

        expect(error).to.be.instanceOf(Errors.InvalidNameError)
      })
    })

    describe('upserting a doc with an invalid name', function () {
      beforeEach(function (ctx) {
        ctx.path = '/folder/*doc.tex'
        ctx.newFolders = ['mock-a', 'mock-b']
        ctx.folder = { _id: folderId }
        ctx.doc = { _id: docId }
        ctx.isNewDoc = true
        ctx.ProjectEntityUpdateHandler.promises.mkdirp = {
          withoutLock: sinon
            .stub()
            .resolves({ newFolders: ctx.newFolders, folder: ctx.folder }),
        }
        ctx.ProjectEntityUpdateHandler.promises.upsertDoc = {
          withoutLock: sinon
            .stub()
            .resolves({ doc: ctx.doc, isNew: ctx.isNewDoc }),
        }
      })

      it('returns an error', async function (ctx) {
        let error

        try {
          await ctx.ProjectEntityUpdateHandler.promises.upsertDocWithPath(
            projectId,
            ctx.path,
            ctx.docLines,
            ctx.source,
            userId
          )
        } catch (err) {
          error = err
        }

        expect(error).to.be.instanceOf(Errors.InvalidNameError)
      })
    })
  })

  describe('upsertFileWithPath', function () {
    describe('upserting a file', function () {
      let upsertFileWithPathResult
      beforeEach(async function (ctx) {
        ctx.path = '/folder/file.png'
        ctx.newFolders = ['mock-a', 'mock-b']
        ctx.folder = { _id: folderId }
        ctx.file = { _id: fileId }
        ctx.isNewFile = true
        ctx.FileStoreHandler.promises.uploadFileFromDisk.resolves({
          fileRef: ctx.newFile,
          createdBlob: true,
        })
        ctx.ProjectEntityUpdateHandler.promises.mkdirp = {
          withoutLock: sinon
            .stub()
            .resolves({ newFolders: ctx.newFolders, folder: ctx.folder }),
        }
        ctx.ProjectEntityUpdateHandler.promises.upsertFile = {
          mainTask: sinon
            .stub()
            .resolves({ fileRef: ctx.file, isNew: ctx.isNewFile }),
        }

        upsertFileWithPathResult =
          await ctx.ProjectEntityUpdateHandler.promises.upsertFileWithPath(
            projectId,
            ctx.path,
            ctx.fileSystemPath,
            ctx.linkedFileData,
            userId,
            ctx.source
          )
      })

      it('creates any necessary folders', function (ctx) {
        ctx.ProjectEntityUpdateHandler.promises.mkdirp.withoutLock
          .calledWith(projectId, '/folder', userId)
          .should.equal(true)
      })

      it('upserts the file', function (ctx) {
        ctx.ProjectEntityUpdateHandler.promises.upsertFile.mainTask.should.have.been.calledWith(
          {
            projectId,
            folderId: ctx.folder._id,
            fileName: 'file.png',
            fsPath: ctx.fileSystemPath,
            linkedFileData: ctx.linkedFileData,
            userId,
            fileRef: ctx.newFile,
            source: ctx.source,
            createdBlob: true,
          }
        )
      })

      it('returns an object with the fileRef, isNew flag, undefined oldFileRef, newFolders, and folder', function (ctx) {
        expect(upsertFileWithPathResult).to.eql({
          fileRef: ctx.file,
          isNew: ctx.isNewFile,
          newFolders: ctx.newFolders,
          folder: ctx.folder,
          oldFileRef: undefined,
        })
      })
    })

    describe('upserting a file with an invalid path', function () {
      beforeEach(function (ctx) {
        ctx.path = '/*folder/file.png'
        ctx.newFolders = ['mock-a', 'mock-b']
        ctx.folder = { _id: folderId }
        ctx.file = { _id: fileId }
        ctx.isNewFile = true
        ctx.ProjectEntityUpdateHandler.promises.mkdirp = {
          withoutLock: sinon
            .stub()
            .resolves({ newFolders: ctx.newFolders, folder: ctx.folder }),
        }
        ctx.ProjectEntityUpdateHandler.promises.upsertFile = {
          mainTask: sinon
            .stub()
            .resolves({ doc: ctx.file, isNew: ctx.isNewFile }),
        }
      })

      it('returns an error', async function (ctx) {
        let error

        try {
          await ctx.ProjectEntityUpdateHandler.promises.upsertFileWithPath(
            projectId,
            ctx.path,
            ctx.fileSystemPath,
            ctx.linkedFileData,
            userId,
            ctx.source
          )
        } catch (err) {
          error = err
        }

        expect(error).to.be.instanceOf(Errors.InvalidNameError)
      })
    })

    describe('upserting a file with an invalid name', function () {
      beforeEach(function (ctx) {
        ctx.path = '/folder/*file.png'
        ctx.newFolders = ['mock-a', 'mock-b']
        ctx.folder = { _id: folderId }
        ctx.file = { _id: fileId }
        ctx.isNewFile = true
        ctx.ProjectEntityUpdateHandler.promises.mkdirp = {
          withoutLock: sinon
            .stub()
            .resolves({ newFolders: ctx.newFolders, folder: ctx.folder }),
        }
        ctx.ProjectEntityUpdateHandler.promises.upsertFile = {
          mainTask: sinon
            .stub()
            .resolves({ doc: ctx.file, isNew: ctx.isNewFile }),
        }
      })

      it('returns an error', async function (ctx) {
        let error

        try {
          await ctx.ProjectEntityUpdateHandler.promises.upsertFileWithPath(
            projectId,
            ctx.path,
            ctx.fileSystemPath,
            ctx.linkedFileData,
            userId,
            ctx.source
          )
        } catch (err) {
          error = err
        }

        expect(error).to.be.instanceOf(Errors.InvalidNameError)
      })
    })
  })

  describe('deleteEntity', function () {
    let deleteEntityResult
    beforeEach(async function (ctx) {
      ctx.path = '/path/to/doc.tex'
      ctx.doc = { _id: docId }
      ctx.projectBeforeDeletion = { _id: projectId, name: 'project' }
      ctx.newProject = 'new-project'
      ctx.ProjectEntityMongoUpdateHandler.promises.deleteEntity.resolves({
        entity: ctx.doc,
        path: { fileSystem: ctx.path },
        projectBeforeDeletion: ctx.projectBeforeDeletion,
        newProject: ctx.newProject,
      })
      ctx.ProjectEntityUpdateHandler._cleanUpEntity = sinon
        .stub()
        .resolves([{ type: 'doc', entity: ctx.doc, path: ctx.path }])

      deleteEntityResult =
        await ctx.ProjectEntityUpdateHandler.promises.deleteEntity(
          projectId,
          docId,
          'doc',
          userId,
          ctx.source
        )
    })

    it('flushes the project to mongo', function (ctx) {
      ctx.DocumentUpdaterHandler.promises.flushProjectToMongo.should.have.been.calledWith(
        projectId
      )
    })

    it('deletes the entity in mongo', function (ctx) {
      ctx.ProjectEntityMongoUpdateHandler.promises.deleteEntity
        .calledWith(projectId, docId, 'doc', userId)
        .should.equal(true)
    })

    it('cleans up the doc in the docstore', function (ctx) {
      ctx.ProjectEntityUpdateHandler._cleanUpEntity
        .calledWith(
          ctx.projectBeforeDeletion,
          ctx.newProject,
          ctx.doc,
          'doc',
          ctx.path,
          userId,
          ctx.source
        )
        .should.equal(true)
    })

    it('it notifies the tpds', function (ctx) {
      ctx.TpdsUpdateSender.promises.deleteEntity.should.have.been.calledWith({
        projectId,
        path: ctx.path,
        projectName: ctx.projectBeforeDeletion.name,
        entityId: docId,
        entityType: 'doc',
        subtreeEntityIds: [ctx.doc._id],
      })
    })

    it('retuns the entity_id', function () {
      expect(deleteEntityResult).to.equal(docId)
    })
  })

  describe('deleteEntityWithPath', function () {
    describe('when the entity exists', function () {
      beforeEach(async function (ctx) {
        ctx.doc = { _id: docId }
        ctx.ProjectLocator.promises.findElementByPath.resolves({
          element: ctx.doc,
          type: 'doc',
        })
        ctx.ProjectEntityUpdateHandler.promises.deleteEntity = {
          withoutLock: sinon.stub().resolves(),
        }
        ctx.path = '/path/to/doc.tex'
        await ctx.ProjectEntityUpdateHandler.promises.deleteEntityWithPath(
          projectId,
          ctx.path,
          userId,
          ctx.source
        )
      })

      it('finds the entity', function (ctx) {
        ctx.ProjectLocator.promises.findElementByPath
          .calledWith({
            project_id: projectId,
            path: ctx.path,
            exactCaseMatch: true,
          })
          .should.equal(true)
      })

      it('deletes the entity', function (ctx) {
        ctx.ProjectEntityUpdateHandler.promises.deleteEntity.withoutLock.should.have.been.calledWith(
          projectId,
          ctx.doc._id,
          'doc',
          userId,
          ctx.source
        )
      })
    })

    describe('when the entity does not exist', function () {
      beforeEach(function (ctx) {
        ctx.ProjectLocator.promises.findElementByPath.resolves({
          element: null,
        })
        ctx.path = '/doc.tex'
      })

      it('returns an error', async function (ctx) {
        let error

        try {
          await ctx.ProjectEntityUpdateHandler.promises.deleteEntityWithPath(
            projectId,
            ctx.path,
            userId,
            ctx.source
          )
        } catch (err) {
          error = err
        }

        expect(error).to.be.instanceOf(Errors.NotFoundError)
      })
    })
  })

  describe('mkdirp', function () {
    beforeEach(async function (ctx) {
      ctx.docPath = '/folder/doc.tex'
      ctx.ProjectEntityMongoUpdateHandler.promises.mkdirp.resolves({})
      await ctx.ProjectEntityUpdateHandler.promises.mkdirp(
        projectId,
        ctx.docPath,
        userId
      )
    })

    it('calls ProjectEntityMongoUpdateHandler', function (ctx) {
      ctx.ProjectEntityMongoUpdateHandler.promises.mkdirp
        .calledWith(projectId, ctx.docPath, userId)
        .should.equal(true)
    })
  })

  describe('mkdirpWithExactCase', function () {
    beforeEach(async function (ctx) {
      ctx.docPath = '/folder/doc.tex'
      ctx.ProjectEntityMongoUpdateHandler.promises.mkdirp.resolves({})
      await ctx.ProjectEntityUpdateHandler.promises.mkdirpWithExactCase(
        projectId,
        ctx.docPath,
        userId
      )
    })

    it('calls ProjectEntityMongoUpdateHandler', function (ctx) {
      ctx.ProjectEntityMongoUpdateHandler.promises.mkdirp
        .calledWith(projectId, ctx.docPath, userId, { exactCaseMatch: true })
        .should.equal(true)
    })
  })

  describe('addFolder', function () {
    describe('adding a folder', function () {
      beforeEach(async function (ctx) {
        ctx.parentFolderId = '123asdf'
        ctx.folderName = 'new-folder'
        ctx.ProjectEntityMongoUpdateHandler.promises.addFolder.resolves({})
        await ctx.ProjectEntityUpdateHandler.promises.addFolder(
          projectId,
          ctx.parentFolderId,
          ctx.folderName,
          userId
        )
      })

      it('calls ProjectEntityMongoUpdateHandler', function (ctx) {
        ctx.ProjectEntityMongoUpdateHandler.promises.addFolder
          .calledWith(projectId, ctx.parentFolderId, ctx.folderName, userId)
          .should.equal(true)
      })
    })

    describe('adding a folder with an invalid name', function () {
      beforeEach(function (ctx) {
        ctx.parentFolderId = '123asdf'
        ctx.folderName = '*new-folder'
        ctx.ProjectEntityMongoUpdateHandler.promises.addFolder.resolves({})
      })

      it('returns an error', async function (ctx) {
        let error

        try {
          await ctx.ProjectEntityUpdateHandler.promises.addFolder(
            projectId,
            ctx.parentFolderId,
            ctx.folderName
          )
        } catch (err) {
          error = err
        }

        expect(error).to.be.instanceOf(Errors.InvalidNameError)
      })
    })
  })

  describe('moveEntity', function () {
    beforeEach(async function (ctx) {
      ctx.project_name = 'project name'
      ctx.startPath = '/a.tex'
      ctx.endPath = '/folder/b.tex'
      ctx.rev = 2
      ctx.changes = { newDocs: ['old-doc'], newFiles: ['old-file'] }
      ctx.ProjectEntityMongoUpdateHandler.promises.moveEntity.resolves({
        project: ctx.project,
        startPath: ctx.startPath,
        endPath: ctx.endPath,
        rev: ctx.rev,
        changes: ctx.changes,
      })

      await ctx.ProjectEntityUpdateHandler.promises.moveEntity(
        projectId,
        docId,
        folderId,
        'doc',
        userId,
        ctx.source
      )
    })

    it('moves the entity in mongo', function (ctx) {
      ctx.ProjectEntityMongoUpdateHandler.promises.moveEntity
        .calledWith(projectId, docId, folderId, 'doc', userId)
        .should.equal(true)
    })

    it('notifies tpds', function (ctx) {
      ctx.TpdsUpdateSender.promises.moveEntity
        .calledWith({
          projectId,
          projectName: ctx.project_name,
          startPath: ctx.startPath,
          endPath: ctx.endPath,
          rev: ctx.rev,
          entityId: docId,
          entityType: 'doc',
          folderId,
        })
        .should.equal(true)
    })

    it('sends the changes in project structure to the doc updater', function (ctx) {
      ctx.DocumentUpdaterHandler.promises.updateProjectStructure
        .calledWith(
          projectId,
          projectHistoryId,
          userId,
          ctx.changes,
          ctx.source
        )
        .should.equal(true)
    })
  })

  describe('renameEntity', function () {
    describe('renaming an entity', function () {
      beforeEach(async function (ctx) {
        ctx.project_name = 'project name'
        ctx.startPath = '/folder/a.tex'
        ctx.endPath = '/folder/b.tex'
        ctx.rev = 2
        ctx.changes = { newDocs: ['old-doc'], newFiles: ['old-file'] }
        ctx.newDocName = 'b.tex'
        ctx.ProjectEntityMongoUpdateHandler.promises.renameEntity.resolves({
          project: ctx.project,
          startPath: ctx.startPath,
          endPath: ctx.endPath,
          rev: ctx.rev,
          changes: ctx.changes,
        })

        await ctx.ProjectEntityUpdateHandler.promises.renameEntity(
          projectId,
          docId,
          'doc',
          ctx.newDocName,
          userId,
          ctx.source
        )
      })

      it('moves the entity in mongo', function (ctx) {
        ctx.ProjectEntityMongoUpdateHandler.promises.renameEntity
          .calledWith(projectId, docId, 'doc', ctx.newDocName, userId)
          .should.equal(true)
      })

      it('notifies tpds', function (ctx) {
        ctx.TpdsUpdateSender.promises.moveEntity
          .calledWith({
            projectId,
            projectName: ctx.project_name,
            startPath: ctx.startPath,
            endPath: ctx.endPath,
            rev: ctx.rev,
            entityId: docId,
            entityType: 'doc',
            folderId: null,
          })
          .should.equal(true)
      })

      it('flushes the project in doc updater', function (ctx) {
        ctx.DocumentUpdaterHandler.promises.flushProjectToMongo.should.have.been.calledWith(
          projectId
        )
      })

      it('sends the changes in project structure to the doc updater', function (ctx) {
        ctx.DocumentUpdaterHandler.promises.updateProjectStructure
          .calledWith(
            projectId,
            projectHistoryId,
            userId,
            ctx.changes,
            ctx.source
          )
          .should.equal(true)
      })
    })

    describe('renaming an entity to an invalid name', function () {
      beforeEach(function (ctx) {
        ctx.project_name = 'project name'
        ctx.startPath = '/folder/a.tex'
        ctx.endPath = '/folder/b.tex'
        ctx.rev = 2
        ctx.changes = { newDocs: ['old-doc'], newFiles: ['old-file'] }
        ctx.newDocName = '*b.tex'
        ctx.ProjectEntityMongoUpdateHandler.promises.renameEntity.resolves({
          project: ctx.project,
          startPath: ctx.startPath,
          endPath: ctx.endPath,
          rev: ctx.rev,
          changes: ctx.changes,
        })
      })

      it('returns an error', async function (ctx) {
        let error

        try {
          await ctx.ProjectEntityUpdateHandler.promises.renameEntity(
            projectId,
            docId,
            'doc',
            ctx.newDocName,
            userId,
            ctx.source
          )
        } catch (err) {
          error = err
        }

        expect(error).to.be.instanceOf(Errors.InvalidNameError)
      })
    })

    describe('renaming an entity with a non-string value', function () {
      beforeEach(function (ctx) {
        ctx.project_name = 'project name'
        ctx.startPath = '/folder/a.tex'
        ctx.endPath = '/folder/b.tex'
        ctx.rev = 2
        ctx.changes = { newDocs: ['old-doc'], newFiles: ['old-file'] }
        ctx.newDocName = ['hello']
        ctx.ProjectEntityMongoUpdateHandler.promises.renameEntity.resolves({
          project: ctx.project,
          startPath: ctx.startPath,
          endPath: ctx.endPath,
          rev: ctx.rev,
          changes: ctx.changes,
        })
      })

      it('returns an error', async function (ctx) {
        let error

        try {
          await ctx.ProjectEntityUpdateHandler.promises.renameEntity(
            projectId,
            docId,
            'doc',
            ctx.newDocName,
            userId,
            ctx.source
          )
        } catch (err) {
          error = err
        }

        expect(error).to.be.instanceOf(Error)
        expect(
          ctx.ProjectEntityMongoUpdateHandler.promises.renameEntity.called
        ).to.equal(false)
      })
    })
  })

  describe('resyncProjectHistory', function () {
    describe('a deleted project', function () {
      beforeEach(function (ctx) {
        ctx.ProjectGetter.promises.getProject.resolves({})
      })

      it('should return an error', async function (ctx) {
        let error

        try {
          await ctx.ProjectEntityUpdateHandler.promises.resyncProjectHistory(
            projectId,
            {}
          )
        } catch (err) {
          error = err
        }

        expect(error).to.be.instanceOf(Errors.ProjectHistoryDisabledError)
        expect(error).to.have.property(
          'message',
          `project history not enabled for ${projectId}`
        )
      })
    })

    describe('a project without project-history enabled', function () {
      beforeEach(function (ctx) {
        ctx.project.overleaf = {}
        ctx.ProjectGetter.promises.getProject.resolves(ctx.project)
      })

      it('should return an error', async function (ctx) {
        let error

        try {
          await ctx.ProjectEntityUpdateHandler.promises.resyncProjectHistory(
            projectId,
            {}
          )
        } catch (err) {
          error = err
        }

        expect(error).to.be.instanceOf(Errors.ProjectHistoryDisabledError)
        expect(error).to.have.property(
          'message',
          `project history not enabled for ${projectId}`
        )
      })
    })

    describe('a project with project-history enabled', function () {
      const docs = [{ doc: { _id: docId, name: 'main.tex' }, path: 'main.tex' }]
      const files = [
        {
          file: { _id: fileId, name: 'universe.png', hash: '123456' },
          path: 'universe.png',
        },
      ]
      beforeEach(async function (ctx) {
        ctx.ProjectGetter.promises.getProject.resolves(ctx.project)
        const folders = []
        ctx.ProjectEntityHandler.getAllEntitiesFromProject.returns({
          docs,
          files,
          folders,
        })

        await ctx.ProjectEntityUpdateHandler.promises.resyncProjectHistory(
          projectId,
          {}
        )
      })

      it('gets the project', function (ctx) {
        ctx.ProjectGetter.promises.getProject.should.have.been.calledWith(
          projectId
        )
      })

      it('gets the entities for the project', function (ctx) {
        ctx.ProjectEntityHandler.getAllEntitiesFromProject.should.have.been.calledWith(
          ctx.project
        )
      })

      it('uses an extended timeout', function (ctx) {
        ctx.LockManager.withTimeout.should.have.been.calledWith(6 * 60)
      })

      it('tells the doc updater to sync the project', function (ctx) {
        ctx.DocumentUpdaterHandler.promises.resyncProjectHistory
          .calledWith(projectId, projectHistoryId, docs, files)
          .should.equal(true)
      })
    })

    describe('a project with duplicate filenames', function () {
      beforeEach(async function (ctx) {
        ctx.ProjectGetter.promises.getProject.resolves(ctx.project)
        ctx.docs = [
          { doc: { _id: 'doc1', name: 'main.tex' }, path: 'main.tex' },
          {
            doc: { _id: 'doc2', name: 'duplicate.tex' },
            path: 'a/b/c/duplicate.tex',
          },
          {
            doc: { _id: 'doc3', name: 'duplicate.tex' },
            path: 'a/b/c/duplicate.tex',
          },
          {
            doc: { _id: 'doc4', name: 'another dupe (22)' },
            path: 'another dupe (22)',
          },
          {
            doc: { _id: 'doc5', name: 'duplicate.tex' },
            path: 'a/b/c/duplicate.tex',
          },
        ]
        ctx.files = [
          {
            file: { _id: 'file1', name: 'image.jpg', hash: 'hash1' },
            path: 'image.jpg',
          },
          {
            file: { _id: 'file2', name: 'duplicate.jpg', hash: 'hash2' },
            path: 'duplicate.jpg',
          },
          {
            file: { _id: 'file3', name: 'duplicate.jpg', hash: 'hash3' },
            path: 'duplicate.jpg',
          },
          {
            file: { _id: 'file4', name: 'another dupe (22)', hash: 'hash4' },
            path: 'another dupe (22)',
          },
        ]
        ctx.ProjectEntityHandler.getAllEntitiesFromProject.returns({
          docs: ctx.docs,
          files: ctx.files,
          folders: [],
        })
        await ctx.ProjectEntityUpdateHandler.promises.resyncProjectHistory(
          projectId,
          {}
        )
      })

      it('renames the duplicate files', function (ctx) {
        const renameEntity =
          ctx.ProjectEntityMongoUpdateHandler.promises.renameEntity
        expect(renameEntity).to.have.callCount(4)
        expect(renameEntity).to.have.been.calledWith(
          projectId,
          'doc3',
          'doc',
          'duplicate.tex (1)',
          null
        )
        expect(renameEntity).to.have.been.calledWith(
          projectId,
          'doc5',
          'doc',
          'duplicate.tex (2)',
          null
        )
        expect(renameEntity).to.have.been.calledWith(
          projectId,
          'file3',
          'file',
          'duplicate.jpg (1)',
          null
        )
        expect(renameEntity).to.have.been.calledWith(
          projectId,
          'file4',
          'file',
          'another dupe (23)',
          null
        )
      })

      it('tells the doc updater to resync the project', function (ctx) {
        const docs = ctx.docs.map(d => {
          if (d.doc._id === 'doc3') {
            return Object.assign({}, d, { path: 'a/b/c/duplicate.tex (1)' })
          }
          if (d.doc._id === 'doc5') {
            return Object.assign({}, d, { path: 'a/b/c/duplicate.tex (2)' })
          }
          return d
        })
        const files = ctx.files.map(f => {
          if (f.file._id === 'file3') {
            return Object.assign({}, f, { path: 'duplicate.jpg (1)' })
          }
          if (f.file._id === 'file4') {
            return Object.assign({}, f, { path: 'another dupe (23)' })
          }
          return f
        })
        expect(
          ctx.DocumentUpdaterHandler.promises.resyncProjectHistory
        ).to.have.been.calledWith(projectId, projectHistoryId, docs, files)
      })
    })

    describe('a project with bad filenames', function () {
      beforeEach(async function (ctx) {
        ctx.ProjectGetter.promises.getProject.resolves(ctx.project)
        ctx.docs = [
          {
            doc: { _id: 'doc1', name: '/d/e/f/test.tex' },
            path: 'a/b/c/d/e/f/test.tex',
          },
          {
            doc: { _id: 'doc2', name: '' },
            path: 'a',
          },
        ]
        ctx.files = [
          {
            file: { _id: 'file1', name: 'A*.png', hash: 'hash1' },
            path: 'A*.png',
          },
          {
            file: { _id: 'file2', name: 'A_.png', hash: 'hash2' },
            path: 'A_.png',
          },
        ]
        ctx.ProjectEntityHandler.getAllEntitiesFromProject.returns({
          docs: ctx.docs,
          files: ctx.files,
          folders: [],
        })
        await ctx.ProjectEntityUpdateHandler.promises.resyncProjectHistory(
          projectId,
          {}
        )
      })

      it('renames the files', function (ctx) {
        const renameEntity =
          ctx.ProjectEntityMongoUpdateHandler.promises.renameEntity
        expect(renameEntity).to.have.callCount(4)
        expect(renameEntity).to.have.been.calledWith(
          projectId,
          'doc1',
          'doc',
          '_d_e_f_test.tex',
          null
        )
        expect(renameEntity).to.have.been.calledWith(
          projectId,
          'doc2',
          'doc',
          'untitled',
          null
        )
        expect(renameEntity).to.have.been.calledWith(
          projectId,
          'file1',
          'file',
          'A_.png',
          null
        )
        expect(renameEntity).to.have.been.calledWith(
          projectId,
          'file2',
          'file',
          'A_.png (1)',
          null
        )
      })

      it('tells the doc updater to resync the project', function (ctx) {
        const docs = ctx.docs.map(d => {
          if (d.doc._id === 'doc1') {
            return Object.assign({}, d, { path: 'a/b/c/_d_e_f_test.tex' })
          }
          if (d.doc._id === 'doc2') {
            return Object.assign({}, d, { path: 'a/untitled' })
          }
          return d
        })
        const files = ctx.files.map(f => {
          if (f.file._id === 'file1') {
            return Object.assign({}, f, { path: 'A_.png' })
          }
          if (f.file._id === 'file2') {
            return Object.assign({}, f, { path: 'A_.png (1)' })
          }
          return f
        })
        expect(
          ctx.DocumentUpdaterHandler.promises.resyncProjectHistory
        ).to.have.been.calledWith(projectId, projectHistoryId, docs, files)
      })
    })

    describe('a project with a bad folder name', function () {
      const folders = [
        {
          folder: { _id: 'folder1', name: 'good' },
          path: 'good',
        },
        {
          folder: { _id: 'folder2', name: 'bad*' },
          path: 'bad*',
        },
      ]
      const docs = [
        {
          doc: { _id: 'doc1', name: 'doc1.tex' },
          path: 'good/doc1.tex',
        },
        {
          doc: { _id: 'doc2', name: 'duplicate.tex' },
          path: 'bad*/doc2.tex',
        },
      ]
      const files = []
      beforeEach(async function (ctx) {
        ctx.ProjectGetter.promises.getProject.resolves(ctx.project)
        ctx.ProjectEntityHandler.getAllEntitiesFromProject.returns({
          docs,
          files,
          folders,
        })
        await ctx.ProjectEntityUpdateHandler.promises.resyncProjectHistory(
          projectId,
          {}
        )
      })

      it('renames the folder', function (ctx) {
        const renameEntity =
          ctx.ProjectEntityMongoUpdateHandler.promises.renameEntity
        expect(renameEntity).to.have.callCount(1)
        expect(renameEntity).to.have.been.calledWith(
          projectId,
          'folder2',
          'folder',
          'bad_',
          null
        )
      })

      it('tells the doc updater to resync the project', function (ctx) {
        const fixedDocs = docs.map(d => {
          if (d.doc._id === 'doc2') {
            return Object.assign({}, d, { path: 'bad_/doc2.tex' })
          }
          return d
        })
        expect(
          ctx.DocumentUpdaterHandler.promises.resyncProjectHistory
        ).to.have.been.calledWith(projectId, projectHistoryId, fixedDocs, files)
      })
    })

    describe('a project with duplicate names between a folder and a doc', function () {
      const folders = [
        {
          folder: { _id: 'folder1', name: 'chapters' },
          path: 'chapters',
        },
      ]
      const docs = [
        {
          doc: { _id: 'doc1', name: 'chapters' },
          path: 'chapters',
        },
        {
          doc: { _id: 'doc2', name: 'chapter1.tex' },
          path: 'chapters/chapter1.tex',
        },
      ]
      const files = []
      beforeEach(async function (ctx) {
        ctx.ProjectGetter.promises.getProject.resolves(ctx.project)
        ctx.ProjectEntityHandler.getAllEntitiesFromProject.returns({
          docs,
          files,
          folders,
        })
        await ctx.ProjectEntityUpdateHandler.promises.resyncProjectHistory(
          projectId,
          {}
        )
      })

      it('renames the doc', function (ctx) {
        const renameEntity =
          ctx.ProjectEntityMongoUpdateHandler.promises.renameEntity
        expect(renameEntity).to.have.callCount(1)
        expect(renameEntity).to.have.been.calledWith(
          projectId,
          'doc1',
          'doc',
          'chapters (1)',
          null
        )
      })

      it('tells the doc updater to resync the project', function (ctx) {
        const fixedDocs = docs.map(d => {
          if (d.doc._id === 'doc1') {
            return Object.assign({}, d, { path: 'chapters (1)' })
          }
          return d
        })
        expect(
          ctx.DocumentUpdaterHandler.promises.resyncProjectHistory
        ).to.have.been.calledWith(projectId, projectHistoryId, fixedDocs, files)
      })
    })

    describe('a project with an invalid file tree', function () {
      beforeEach(function (ctx) {
        ctx.callback = sinon.stub()
        ctx.ProjectGetter.promises.getProject.resolves(ctx.project)
        ctx.ProjectEntityHandler.getAllEntitiesFromProject.throws()
      })

      it('calls the callback with an error', async function (ctx) {
        let error

        try {
          await ctx.ProjectEntityUpdateHandler.promises.resyncProjectHistory(
            projectId,
            {}
          )
        } catch (err) {
          error = err
        }

        expect(error).to.be.instanceOf(Error)
      })
    })
  })

  describe('_cleanUpEntity', function () {
    beforeEach(function (ctx) {
      ctx.entityId = '4eecaffcbffa66588e000009'
      ctx.ProjectEntityUpdateHandler.promises.unsetRootDoc = sinon
        .stub()
        .resolves()
    })

    describe('a file', function () {
      beforeEach(async function (ctx) {
        ctx.path = '/file/system/path.png'
        ctx.entity = { _id: ctx.entityId }
        ctx.newProject = 'new-project'
        ctx.subtreeListing =
          await ctx.ProjectEntityUpdateHandler._cleanUpEntity(
            ctx.project,
            ctx.newProject,
            ctx.entity,
            'file',
            ctx.path,
            userId,
            ctx.source
          )
      })

      it('should not attempt to delete from the document updater', function (ctx) {
        ctx.DocumentUpdaterHandler.promises.deleteDoc.called.should.equal(false)
      })

      it('should send the update to the doc updater', function (ctx) {
        const oldFiles = [{ file: ctx.entity, path: ctx.path }]
        ctx.DocumentUpdaterHandler.promises.updateProjectStructure.should.have.been.calledWith(
          projectId,
          projectHistoryId,
          userId,
          {
            oldFiles,
            oldDocs: [],
            newProject: ctx.newProject,
          },
          ctx.source
        )
      })

      it('should return a subtree listing containing only the file', function (ctx) {
        expect(ctx.subtreeListing).to.deep.equal([
          { type: 'file', entity: ctx.entity, path: ctx.path },
        ])
      })
    })

    describe('a doc', function () {
      beforeEach(async function (ctx) {
        ctx.path = '/file/system/path.tex'
        ctx.ProjectEntityUpdateHandler._cleanUpDoc = sinon.stub().resolves()
        ctx.entity = { _id: ctx.entityId }
        ctx.newProject = 'new-project'
        ctx.subtreeListing =
          await ctx.ProjectEntityUpdateHandler._cleanUpEntity(
            ctx.project,
            ctx.newProject,
            ctx.entity,
            'doc',
            ctx.path,
            userId,
            ctx.source
          )
      })

      it('should clean up the doc', function (ctx) {
        ctx.ProjectEntityUpdateHandler._cleanUpDoc
          .calledWith(ctx.project, ctx.entity, ctx.path, userId)
          .should.equal(true)
      })

      it('should send the update to the doc updater', function (ctx) {
        const oldDocs = [{ doc: ctx.entity, path: ctx.path }]
        ctx.DocumentUpdaterHandler.promises.updateProjectStructure.should.have.been.calledWith(
          projectId,
          projectHistoryId,
          userId,
          {
            oldDocs,
            oldFiles: [],
            newProject: ctx.newProject,
          },
          ctx.source
        )
      })

      it('should return a subtree listing containing only the doc', function (ctx) {
        expect(ctx.subtreeListing).to.deep.equal([
          { type: 'doc', entity: ctx.entity, path: ctx.path },
        ])
      })
    })

    describe('a folder', function () {
      beforeEach(async function (ctx) {
        ctx.folder = {
          folders: [
            {
              name: 'subfolder',
              fileRefs: [
                (ctx.file1 = { _id: 'file-id-1', name: 'file-name-1' }),
              ],
              docs: [(ctx.doc1 = { _id: 'doc-id-1', name: 'doc-name-1' })],
              folders: [],
            },
          ],
          fileRefs: [(ctx.file2 = { _id: 'file-id-2', name: 'file-name-2' })],
          docs: [(ctx.doc2 = { _id: 'doc-id-2', name: 'doc-name-2' })],
        }

        ctx.ProjectEntityUpdateHandler._cleanUpDoc = sinon.stub().resolves()
        const path = '/folder'
        ctx.newProject = 'new-project'
        ctx.subtreeListing =
          await ctx.ProjectEntityUpdateHandler._cleanUpEntity(
            ctx.project,
            ctx.newProject,
            ctx.folder,
            'folder',
            path,
            userId,
            ctx.source
          )
      })

      it('should clean up all sub docs', function (ctx) {
        ctx.ProjectEntityUpdateHandler._cleanUpDoc
          .calledWith(
            ctx.project,
            ctx.doc1,
            '/folder/subfolder/doc-name-1',
            userId
          )
          .should.equal(true)
        ctx.ProjectEntityUpdateHandler._cleanUpDoc
          .calledWith(ctx.project, ctx.doc2, '/folder/doc-name-2', userId)
          .should.equal(true)
      })

      it('should should send one update to the doc updater for all docs and files', function (ctx) {
        const oldFiles = [
          { file: ctx.file2, path: '/folder/file-name-2' },
          { file: ctx.file1, path: '/folder/subfolder/file-name-1' },
        ]
        const oldDocs = [
          { doc: ctx.doc2, path: '/folder/doc-name-2' },
          { doc: ctx.doc1, path: '/folder/subfolder/doc-name-1' },
        ]
        ctx.DocumentUpdaterHandler.promises.updateProjectStructure
          .calledWith(
            projectId,
            projectHistoryId,
            userId,
            {
              oldFiles,
              oldDocs,
              newProject: ctx.newProject,
            },
            ctx.source
          )
          .should.equal(true)
      })

      it('should return a subtree listing containing all sub-entities', function (ctx) {
        expect(ctx.subtreeListing).to.have.deep.members([
          { type: 'folder', entity: ctx.folder, path: '/folder' },
          {
            type: 'folder',
            entity: ctx.folder.folders[0],
            path: '/folder/subfolder',
          },
          {
            type: 'file',
            entity: ctx.file1,
            path: '/folder/subfolder/file-name-1',
          },
          {
            type: 'doc',
            entity: ctx.doc1,
            path: '/folder/subfolder/doc-name-1',
          },
          { type: 'file', entity: ctx.file2, path: '/folder/file-name-2' },
          { type: 'doc', entity: ctx.doc2, path: '/folder/doc-name-2' },
        ])
      })
    })
  })

  describe('_cleanUpDoc', function () {
    beforeEach(function (ctx) {
      ctx.doc = {
        _id: new ObjectId(),
        name: 'test.tex',
      }
      ctx.path = '/path/to/doc'
      ctx.ProjectEntityUpdateHandler.promises.unsetRootDoc = sinon
        .stub()
        .resolves()
      ctx.DocstoreManager.promises.deleteDoc.resolves()
    })

    describe('when the doc is the root doc', function () {
      beforeEach(async function (ctx) {
        ctx.project.rootDoc_id = ctx.doc._id
        await ctx.ProjectEntityUpdateHandler._cleanUpDoc(
          ctx.project,
          ctx.doc,
          ctx.path,
          userId
        )
      })

      it('should unset the root doc', function (ctx) {
        ctx.ProjectEntityUpdateHandler.promises.unsetRootDoc.should.have.been.calledWith(
          projectId
        )
      })

      it('should delete the doc in the doc updater', function (ctx) {
        ctx.DocumentUpdaterHandler.promises.deleteDoc
          .calledWith(projectId, ctx.doc._id.toString())
          .should.equal(true)
      })

      it('should delete the doc in the doc store', function (ctx) {
        ctx.DocstoreManager.promises.deleteDoc
          .calledWith(projectId, ctx.doc._id.toString(), 'test.tex')
          .should.equal(true)
      })
    })

    describe('when the doc is not the root doc', function () {
      beforeEach(async function (ctx) {
        ctx.project.rootDoc_id = new ObjectId()
        await ctx.ProjectEntityUpdateHandler._cleanUpDoc(
          ctx.project,
          ctx.doc,
          ctx.path,
          userId
        )
      })

      it('should not unset the root doc', function (ctx) {
        ctx.ProjectEntityUpdateHandler.promises.unsetRootDoc.called.should.equal(
          false
        )
      })
    })
  })

  describe('convertDocToFile', function () {
    beforeEach(function (ctx) {
      ctx.docPath = '/folder/doc.tex'
      ctx.docLines = ['line one', 'line two']
      ctx.tmpFilePath = '/tmp/file'
      ctx.fileStoreUrl = 'http://filestore/file'
      ctx.folder = { _id: new ObjectId() }
      ctx.rev = 3
      ctx.ProjectLocator.promises.findElement
        .withArgs({
          project_id: ctx.project._id,
          element_id: ctx.doc._id,
          type: 'doc',
        })
        .resolves({
          element: ctx.doc,
          path: { fileSystem: ctx.path },
          folder: ctx.folder,
        })
      ctx.ProjectLocator.promises.findElement
        .withArgs({
          project_id: ctx.project._id.toString(),
          element_id: ctx.file._id,
          type: 'file',
        })
        .resolves({
          element: ctx.file,
          path: ctx.docPath,
          folder: ctx.folder,
        })
      ctx.DocstoreManager.promises.getDoc
        .withArgs(ctx.project._id, ctx.doc._id)
        .resolves({ lines: ctx.docLines, rev: ctx.rev })
      ctx.FileWriter.promises.writeLinesToDisk.resolves(ctx.tmpFilePath)
      ctx.FileStoreHandler.promises.uploadFileFromDisk.resolves({
        fileRef: ctx.file,
        createdBlob: true,
      })
      ctx.ProjectEntityMongoUpdateHandler.promises.replaceDocWithFile.resolves(
        ctx.project
      )
    })

    describe('successfully', function () {
      beforeEach(async function (ctx) {
        await ctx.ProjectEntityUpdateHandler.promises.convertDocToFile(
          ctx.project._id,
          ctx.doc._id,
          userId,
          ctx.source
        )
      })

      it('deletes the document in doc updater', function (ctx) {
        expect(
          ctx.DocumentUpdaterHandler.promises.deleteDoc
        ).to.have.been.calledWith(ctx.project._id, ctx.doc._id)
      })

      it('uploads the file to filestore', function (ctx) {
        expect(
          ctx.FileStoreHandler.promises.uploadFileFromDisk
        ).to.have.been.calledWith(
          ctx.project._id,
          { name: ctx.doc.name, rev: ctx.rev + 1 },
          ctx.tmpFilePath
        )
      })

      it('cleans up the temporary file', function (ctx) {
        expect(ctx.fs.promises.unlink).to.have.been.calledWith(ctx.tmpFilePath)
      })

      it('replaces the doc with the file', function (ctx) {
        expect(
          ctx.ProjectEntityMongoUpdateHandler.promises.replaceDocWithFile
        ).to.have.been.calledWith(
          ctx.project._id,
          ctx.doc._id,
          ctx.file,
          userId
        )
      })

      it('notifies document updater of changes', function (ctx) {
        expect(
          ctx.DocumentUpdaterHandler.promises.updateProjectStructure
        ).to.have.been.calledWith(
          ctx.project._id,
          ctx.project.overleaf.history.id,
          userId,
          {
            oldDocs: [{ doc: ctx.doc, path: ctx.path }],
            newFiles: [
              {
                file: ctx.file,
                path: ctx.path,
                createdBlob: true,
              },
            ],
            newProject: ctx.project,
          },
          ctx.source
        )
      })

      it('should notify real-time of the doc deletion', function (ctx) {
        expect(ctx.EditorRealTimeController.emitToRoom).to.have.been.calledWith(
          ctx.project._id,
          'removeEntity',
          ctx.doc._id,
          'convertDocToFile'
        )
      })

      it('should notify real-time of the file creation', function (ctx) {
        expect(ctx.EditorRealTimeController.emitToRoom).to.have.been.calledWith(
          ctx.project._id,
          'reciveNewFile',
          ctx.folder._id,
          ctx.file,
          'convertDocToFile',
          null
        )
      })
    })

    describe('when the doc has ranges', function () {
      it('should throw a DocHasRangesError', async function (ctx) {
        ctx.ranges = { comments: [{ id: 123 }] }
        ctx.DocstoreManager.promises.getDoc
          .withArgs(ctx.project._id, ctx.doc._id)
          .resolves({
            lines: ctx.docLines,
            rev: 'rev',
            version: 'version',
            ranges: ctx.ranges,
          })
        let error

        try {
          await ctx.ProjectEntityUpdateHandler.promises.convertDocToFile(
            ctx.project._id,
            ctx.doc._id,
            ctx.user._id,
            ctx.source
          )
        } catch (err) {
          error = err
        }

        expect(error).to.be.instanceOf(Errors.DocHasRangesError)
      })
    })
  })

  describe('isPathValidForMainBibliographyDoc', function () {
    it('should not allow other endings than .bib', function (ctx) {
      const endings = ['.tex', '.png', '.jpg', '.pdf', '.docx', '.doc']
      endings.forEach(ending => {
        expect(
          ctx.ProjectEntityUpdateHandler.isPathValidForMainBibliographyDoc(
            `/foo/bar/baz${ending}`
          )
        ).to.be.false
      })
    })

    it('should allow a mix of lower and uppercase letters', function (ctx) {
      const endings = ['.bib', '.BiB', '.BIB', '.bIB']
      endings.forEach(ending => {
        expect(
          ctx.ProjectEntityUpdateHandler.isPathValidForMainBibliographyDoc(
            `/foo/bar/baz.${ending}`
          )
        ).to.be.true
      })
    })

    it('should not allow a path without an extension', function (ctx) {
      expect(
        ctx.ProjectEntityUpdateHandler.isPathValidForMainBibliographyDoc(
          '/foo/bar/baz'
        )
      ).to.be.false
    })

    it('should not allow the empty path', function (ctx) {
      expect(
        ctx.ProjectEntityUpdateHandler.isPathValidForMainBibliographyDoc('')
      ).to.be.false
    })
  })

  describe('setMainBibliographyDoc', function () {
    describe('on success', function () {
      beforeEach(async function (ctx) {
        ctx.doc = {
          _id: new ObjectId(),
          name: 'test.bib',
        }
        ctx.path = '/path/to/test.bib'
        ctx.ProjectEntityHandler.promises.getDocPathByProjectIdAndDocId
          .withArgs(ctx.project._id, ctx.doc._id)
          .resolves(ctx.path)

        await ctx.ProjectEntityUpdateHandler.promises.setMainBibliographyDoc(
          ctx.project._id,
          ctx.doc._id
        )
      })

      it('should update the project with the new main bibliography doc', function (ctx) {
        expect(ctx.ProjectModel.updateOne).to.have.been.calledWith(
          { _id: ctx.project._id },
          { mainBibliographyDoc_id: ctx.doc._id }
        )
      })
    })

    describe('on failure', function () {
      describe("when document can't be found", function () {
        let setMainBibliographyDocPromise
        beforeEach(function (ctx) {
          ctx.doc = {
            _id: new ObjectId(),
            name: 'test.bib',
          }
          ctx.ProjectEntityHandler.promises.getDocPathByProjectIdAndDocId
            .withArgs(ctx.project._id, ctx.doc._id)
            .rejects(new Error('error'))
          setMainBibliographyDocPromise =
            ctx.ProjectEntityUpdateHandler.promises.setMainBibliographyDoc(
              ctx.project._id,
              ctx.doc._id
            )
        })

        it('should call the callback with an error', async function () {
          let error

          try {
            await setMainBibliographyDocPromise
          } catch (err) {
            error = err
          }

          expect(error).to.be.instanceOf(Error)
        })

        it('should not update the project with the new main bibliography doc', async function (ctx) {
          let error

          try {
            await setMainBibliographyDocPromise
          } catch (err) {
            error = err
          }

          expect(error).to.exist
          expect(ctx.ProjectModel.updateOne).to.not.have.been.called
        })
      })

      describe("when path is not a bib file can't be found", function () {
        let setMainBibliographyDocPromise
        beforeEach(function (ctx) {
          ctx.doc = {
            _id: new ObjectId(),
            name: 'test.bib',
          }

          ctx.path = '/path/to/test.tex'
          ctx.ProjectEntityHandler.promises.getDocPathByProjectIdAndDocId
            .withArgs(ctx.project._id, ctx.doc._id)
            .resolves(ctx.path)
          setMainBibliographyDocPromise =
            ctx.ProjectEntityUpdateHandler.promises.setMainBibliographyDoc(
              ctx.project._id,
              ctx.doc._id
            )
        })

        it('should reject with an error', async function () {
          let error

          try {
            await setMainBibliographyDocPromise
          } catch (err) {
            error = err
          }

          expect(error).to.be.instanceOf(Error)
        })

        it('should not update the project with the new main bibliography doc', async function (ctx) {
          let error

          try {
            await setMainBibliographyDocPromise
          } catch (err) {
            error = err
          }

          expect(error).to.exist
          expect(ctx.ProjectModel.updateOne).to.not.have.been.called
        })
      })
    })
  })

  describe('appendToDoc', function () {
    describe('when document cannot be found', function () {
      let appendToDocPromise
      beforeEach(function (ctx) {
        ctx.appendedLines = ['5678', 'def']
        ctx.DocumentUpdaterHandler.promises.appendToDocument = sinon.stub()
        ctx.ProjectLocator.promises.findElement = sinon.stub()
        ctx.ProjectLocator.promises.findElement
          .withArgs({ project_id: projectId, element_id: docId, type: 'doc' })
          .rejects(new Errors.NotFoundError())
        appendToDocPromise =
          ctx.ProjectEntityUpdateHandler.promises.appendToDocWithPath(
            projectId,
            docId,
            ctx.appendedLines,
            ctx.source,
            userId
          )
      })

      it('should not talk to DocumentUpdaterHandler', async function (ctx) {
        let error

        try {
          await appendToDocPromise
        } catch (err) {
          error = err
        }

        expect(error).to.exist
        ctx.DocumentUpdaterHandler.promises.appendToDocument.should.not.have
          .been.called
      })

      it('should throw the error', async function () {
        let error

        try {
          await appendToDocPromise
        } catch (err) {
          error = err
        }

        expect(error).to.be.instanceOf(Errors.NotFoundError)
      })
    })

    describe('when document is found', function () {
      let appendToDocResult
      beforeEach(async function (ctx) {
        ctx.appendedLines = ['5678', 'def']
        ctx.DocumentUpdaterHandler.promises.appendToDocument = sinon.stub()
        ctx.DocumentUpdaterHandler.promises.appendToDocument
          .withArgs(projectId, docId, userId, ctx.appendedLines, ctx.source)
          .resolves({ rev: 1 })
        ctx.ProjectLocator.promises.findElement = sinon.stub()
        ctx.ProjectLocator.promises.findElement
          .withArgs({ project_id: projectId, element_id: docId, type: 'doc' })
          .resolves({ element: { _id: docId } })
        appendToDocResult =
          await ctx.ProjectEntityUpdateHandler.promises.appendToDocWithPath(
            projectId,
            docId,
            ctx.appendedLines,
            ctx.source,
            userId
          )
      })

      it('should forward call to DocumentUpdaterHandler.appendToDocument', function (ctx) {
        ctx.DocumentUpdaterHandler.promises.appendToDocument.should.have.been.calledWith(
          projectId,
          docId,
          userId,
          ctx.appendedLines,
          ctx.source
        )
      })

      it('should return the response from DocumentUpdaterHandler', function () {
        expect(appendToDocResult).to.eql({ rev: 1 })
      })
    })

    describe('when DocumentUpdater throws an error', function () {
      beforeEach(function (ctx) {
        ctx.appendedLines = ['5678', 'def']
        ctx.DocumentUpdaterHandler.promises.appendToDocument = sinon.stub()
        ctx.DocumentUpdaterHandler.promises.appendToDocument.rejects(
          new Error()
        )
        ctx.ProjectLocator.promises.findElement = sinon.stub()
        ctx.ProjectLocator.promises.findElement
          .withArgs({ project_id: projectId, element_id: docId, type: 'doc' })
          .resolves({ element: { _id: docId } })
      })

      it('should return the response from DocumentUpdaterHandler', async function (ctx) {
        let error

        try {
          await ctx.ProjectEntityUpdateHandler.promises.appendToDocWithPath(
            projectId,
            docId,
            ctx.appendedLines,
            ctx.source,
            userId
          )
        } catch (err) {
          error = err
        }

        expect(error).to.be.instanceOf(Error)
      })
    })
  })
})
