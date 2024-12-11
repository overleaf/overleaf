const { expect } = require('chai')
const sinon = require('sinon')
const Errors = require('../../../../app/src/Features/Errors/Errors')
const SandboxedModule = require('sandboxed-module')
const { ObjectId } = require('mongodb-legacy')

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

  beforeEach(function () {
    this.project = {
      _id: projectId,
      name: 'project name',
      overleaf: {
        history: {
          id: projectHistoryId,
        },
      },
    }
    this.fileUrl = 'filestore.example.com/file'
    this.user = { _id: new ObjectId() }

    this.DocModel = class Doc {
      constructor(options) {
        this.name = options.name
        this.lines = options.lines
        this._id = docId
        this.rev = options.rev ?? 0
      }
    }
    this.FileModel = class File {
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
    this.docName = 'doc-name'
    this.docLines = ['1234', 'abc']
    this.doc = { _id: new ObjectId(), name: this.docName }

    this.fileName = 'something.jpg'
    this.fileSystemPath = 'somehintg'
    this.file = { _id: new ObjectId(), name: this.fileName, rev: 2 }

    this.linkedFileData = { provider: 'url' }

    this.source = 'editor'
    this.callback = sinon.stub()

    this.DocstoreManager = {
      promises: {
        getDoc: sinon.stub(),
        isDocDeleted: sinon.stub(),
        updateDoc: sinon.stub(),
        deleteDoc: sinon.stub(),
      },
    }
    this.DocumentUpdaterHandler = {
      promises: {
        flushDocToMongo: sinon.stub().resolves(),
        flushProjectToMongo: sinon.stub().resolves(),
        updateProjectStructure: sinon.stub().resolves(),
        setDocument: sinon.stub(),
        resyncProjectHistory: sinon.stub().resolves(),
        deleteDoc: sinon.stub().resolves(),
      },
    }
    this.fs = {
      promises: {
        unlink: sinon.stub().resolves(),
      },
    }
    this.LockManager = {
      promises: {
        runWithLock: sinon.spy((namespace, id, runner, callback) =>
          runner(callback)
        ),
      },
      withTimeout: sinon.stub().returns(this.LockManager),
    }
    this.ProjectModel = {
      updateOne: sinon.stub(),
    }
    this.ProjectGetter = {
      promises: {
        getProject: sinon.stub(),
        getProjectWithoutDocLines: sinon.stub(),
      },
    }
    this.ProjectLocator = {
      promises: {
        findElement: sinon.stub(),
        findElementByPath: sinon.stub(),
      },
    }
    this.ProjectUpdater = {
      promises: {
        markAsUpdated: sinon.stub().resolves(),
      },
    }
    this.ProjectEntityHandler = {
      getAllEntitiesFromProject: sinon.stub(),
      promises: {
        getDoc: sinon.stub(),
        getDocPathByProjectIdAndDocId: sinon.stub(),
      },
    }
    this.ProjectEntityMongoUpdateHandler = {
      promises: {
        addDoc: sinon.stub(),
        addFile: sinon.stub(),
        addFolder: sinon.stub(),
        _confirmFolder: sinon.stub(),
        _putElement: sinon.stub(),
        _insertDeletedFileReference: sinon.stub(),
        replaceFileWithNew: sinon.stub(),
        mkdirp: sinon.stub(),
        moveEntity: sinon.stub(),
        renameEntity: sinon.stub().resolves({}),
        deleteEntity: sinon.stub(),
        replaceDocWithFile: sinon.stub(),
        replaceFileWithDoc: sinon.stub(),
      },
    }
    this.TpdsUpdateSender = {
      promises: {
        addFile: sinon.stub().resolves(),
        addDoc: sinon.stub(),
        deleteEntity: sinon.stub().resolves(),
        moveEntity: sinon.stub().resolves(),
      },
    }
    this.FileStoreHandler = {
      promises: {
        copyFile: sinon.stub(),
        uploadFileFromDisk: sinon.stub(),
        deleteFile: sinon.stub(),
      },

      _buildUrl: sinon
        .stub()
        .callsFake(
          (projectId, fileId) => `www.filestore.test/${projectId}/${fileId}`
        ),
    }
    this.FileWriter = {
      promises: {
        writeLinesToDisk: sinon.stub(),
      },
    }
    this.EditorRealTimeController = {
      emitToRoom: sinon.stub(),
    }
    this.ProjectOptionsHandler = {
      setHistoryRangesSupport: sinon.stub().resolves(),
    }
    this.ProjectEntityUpdateHandler = SandboxedModule.require(MODULE_PATH, {
      requires: {
        '@overleaf/settings': { validRootDocExtensions: ['tex'] },
        fs: this.fs,
        '../../models/Doc': { Doc: this.DocModel },
        '../Docstore/DocstoreManager': this.DocstoreManager,
        '../../Features/DocumentUpdater/DocumentUpdaterHandler':
          this.DocumentUpdaterHandler,
        '../../models/File': { File: this.FileModel },
        '../FileStore/FileStoreHandler': this.FileStoreHandler,
        '../../infrastructure/LockManager': this.LockManager,
        '../../models/Project': { Project: this.ProjectModel },
        './ProjectGetter': this.ProjectGetter,
        './ProjectLocator': this.ProjectLocator,
        './ProjectUpdateHandler': this.ProjectUpdater,
        './ProjectEntityHandler': this.ProjectEntityHandler,
        './ProjectEntityMongoUpdateHandler':
          this.ProjectEntityMongoUpdateHandler,
        './ProjectOptionsHandler': this.ProjectOptionsHandler,
        '../ThirdPartyDataStore/TpdsUpdateSender': this.TpdsUpdateSender,
        '../Editor/EditorRealTimeController': this.EditorRealTimeController,
        '../../infrastructure/FileWriter': this.FileWriter,
      },
    })
  })

  describe('updateDocLines', function () {
    beforeEach(function () {
      this.path = '/somewhere/something.tex'
      this.doc = {
        _id: docId,
      }
      this.version = 42
      this.ranges = { mock: 'ranges' }
      this.lastUpdatedAt = new Date().getTime()
      this.lastUpdatedBy = 'fake-last-updater-id'
      this.parentFolder = { _id: new ObjectId() }
      this.DocstoreManager.promises.isDocDeleted.resolves(false)
      this.ProjectGetter.promises.getProject.resolves(this.project)
      this.ProjectLocator.promises.findElement.resolves({
        element: this.doc,
        path: {
          fileSystem: this.path,
        },
        folder: this.parentFolder,
      })
      this.TpdsUpdateSender.promises.addDoc.resolves()
    })

    describe('when the doc has been modified', function () {
      beforeEach(function (done) {
        this.DocstoreManager.promises.updateDoc.resolves({
          modified: true,
          rev: (this.rev = 5),
        })

        const callback = (...args) => {
          this.callback(...args)
          done()
        }

        this.ProjectEntityUpdateHandler.updateDocLines(
          projectId,
          docId,
          this.docLines,
          this.version,
          this.ranges,
          this.lastUpdatedAt,
          this.lastUpdatedBy,
          callback
        )
      })

      it('should get the project with very few fields', function () {
        this.ProjectGetter.promises.getProject
          .calledWith(projectId, {
            name: true,
            rootFolder: true,
          })
          .should.equal(true)
      })

      it('should find the doc', function () {
        this.ProjectLocator.promises.findElement
          .calledWith({
            project: this.project,
            type: 'docs',
            element_id: docId,
          })
          .should.equal(true)
      })

      it('should update the doc in the docstore', function () {
        this.DocstoreManager.promises.updateDoc
          .calledWith(
            projectId,
            docId,
            this.docLines,
            this.version,
            this.ranges
          )
          .should.equal(true)
      })

      it('should mark the project as updated', function () {
        sinon.assert.calledWith(
          this.ProjectUpdater.promises.markAsUpdated,
          projectId,
          this.lastUpdatedAt,
          this.lastUpdatedBy
        )
      })

      it('should send the doc the to the TPDS', function () {
        this.TpdsUpdateSender.promises.addDoc.should.have.been.calledWith({
          projectId,
          projectName: this.project.name,
          docId,
          rev: this.rev,
          path: this.path,
          folderId: this.parentFolder._id,
        })
      })

      it('should call the callback', function () {
        this.callback.called.should.equal(true)
      })
    })

    describe('when the doc has not been modified', function () {
      beforeEach(function (done) {
        this.DocstoreManager.promises.updateDoc.resolves({
          modified: false,
          rev: (this.rev = 5),
        })

        const callback = () => {
          this.callback()
          done()
        }

        this.ProjectEntityUpdateHandler.updateDocLines(
          projectId,
          docId,
          this.docLines,
          this.version,
          this.ranges,
          this.lastUpdatedAt,
          this.lastUpdatedBy,
          callback
        )
      })

      it('should not mark the project as updated', function () {
        this.ProjectUpdater.promises.markAsUpdated.called.should.equal(false)
      })

      it('should not send the doc the to the TPDS', function () {
        this.TpdsUpdateSender.promises.addDoc.called.should.equal(false)
      })

      it('should call the callback', function () {
        this.callback.called.should.equal(true)
      })
    })

    describe('when the doc has been deleted', function () {
      beforeEach(function (done) {
        this.ProjectGetter.promises.getProject.resolves(this.project)
        this.ProjectLocator.promises.findElement.rejects(
          new Errors.NotFoundError()
        )
        this.DocstoreManager.promises.isDocDeleted.resolves(true)
        this.DocstoreManager.promises.updateDoc.resolves()

        this.ProjectEntityUpdateHandler.updateDocLines(
          projectId,
          docId,
          this.docLines,
          this.version,
          this.ranges,
          this.lastUpdatedAt,
          this.lastUpdatedBy,
          (...args) => {
            this.callback(...args)
            done()
          }
        )
      })

      it('should update the doc in the docstore', function () {
        this.DocstoreManager.promises.updateDoc
          .calledWith(
            projectId,
            docId,
            this.docLines,
            this.version,
            this.ranges
          )
          .should.equal(true)
      })

      it('should not mark the project as updated', function () {
        this.ProjectUpdater.promises.markAsUpdated.called.should.equal(false)
      })

      it('should not send the doc the to the TPDS', function () {
        this.TpdsUpdateSender.promises.addDoc.called.should.equal(false)
      })

      it('should call the callback', function () {
        this.callback.called.should.equal(true)
      })
    })

    describe('when projects and docs collection are de-synced', function () {
      beforeEach(function (done) {
        this.ProjectGetter.promises.getProject.resolves(this.project)

        // The doc is not in the file-tree, but also not marked as deleted.
        // This should not happen, but web should handle it.
        this.ProjectLocator.promises.findElement.rejects(
          new Errors.NotFoundError()
        )
        this.DocstoreManager.promises.isDocDeleted.resolves(false)

        this.DocstoreManager.promises.updateDoc.resolves()
        const callback = (...args) => {
          this.callback(...args)
          done()
        }

        this.ProjectEntityUpdateHandler.updateDocLines(
          projectId,
          docId,
          this.docLines,
          this.version,
          this.ranges,
          this.lastUpdatedAt,
          this.lastUpdatedBy,
          callback
        )
      })

      it('should update the doc in the docstore', function () {
        this.DocstoreManager.promises.updateDoc
          .calledWith(
            projectId,
            docId,
            this.docLines,
            this.version,
            this.ranges
          )
          .should.equal(true)
      })

      it('should not mark the project as updated', function () {
        this.ProjectUpdater.promises.markAsUpdated.called.should.equal(false)
      })

      it('should not send the doc the to the TPDS', function () {
        this.TpdsUpdateSender.promises.addDoc.called.should.equal(false)
      })

      it('should call the callback', function () {
        this.callback.called.should.equal(true)
      })
    })

    describe('when the doc is not related to the project', function () {
      beforeEach(function (done) {
        this.ProjectGetter.promises.getProject.resolves(this.project)
        this.ProjectLocator.promises.findElement.rejects(
          new Errors.NotFoundError()
        )
        this.DocstoreManager.promises.isDocDeleted.rejects(
          new Errors.NotFoundError()
        )
        const callback = (...args) => {
          this.callback(...args)
          done()
        }

        this.ProjectEntityUpdateHandler.updateDocLines(
          projectId,
          docId,
          this.docLines,
          this.version,
          this.ranges,
          this.lastUpdatedAt,
          this.lastUpdatedBy,
          callback
        )
      })

      it('should return a not found error', function () {
        this.callback
          .calledWith(sinon.match.instanceOf(Errors.NotFoundError))
          .should.equal(true)
      })

      it('should not update the doc', function () {
        this.DocstoreManager.promises.updateDoc.called.should.equal(false)
      })

      it('should not send the doc the to the TPDS', function () {
        this.TpdsUpdateSender.promises.addDoc.called.should.equal(false)
      })
    })

    describe('when the project is not found', function () {
      beforeEach(function (done) {
        this.ProjectGetter.promises.getProject.rejects(
          new Errors.NotFoundError()
        )
        this.ProjectEntityUpdateHandler.updateDocLines(
          projectId,
          docId,
          this.docLines,
          this.version,
          this.ranges,
          this.lastUpdatedAt,
          this.lastUpdatedBy,
          (...args) => {
            this.callback(...args)
            done()
          }
        )
      })

      it('should return a not found error', function () {
        this.callback
          .calledWith(sinon.match.instanceOf(Errors.NotFoundError))
          .should.equal(true)
      })

      it('should not update the doc', function () {
        this.DocstoreManager.promises.updateDoc.called.should.equal(false)
      })

      it('should not send the doc the to the TPDS', function () {
        this.TpdsUpdateSender.promises.addDoc.called.should.equal(false)
      })
    })
  })

  describe('setRootDoc', function () {
    beforeEach(function () {
      this.rootDocId = 'root-doc-id-123123'
    })

    it('should call Project.updateOne when the doc exists and has a valid extension', function (done) {
      this.ProjectEntityHandler.promises.getDocPathByProjectIdAndDocId.resolves(
        `/main.tex`
      )

      this.ProjectEntityUpdateHandler.setRootDoc(
        projectId,
        this.rootDocId,
        () => {
          this.ProjectModel.updateOne
            .calledWith({ _id: projectId }, { rootDoc_id: this.rootDocId })
            .should.equal(true)
          done()
        }
      )
    })

    it("should not call Project.updateOne when the doc doesn't exist", function (done) {
      this.ProjectEntityHandler.promises.getDocPathByProjectIdAndDocId.rejects(
        Errors.NotFoundError
      )

      this.ProjectEntityUpdateHandler.setRootDoc(
        projectId,
        this.rootDocId,
        () => {
          this.ProjectModel.updateOne
            .calledWith({ _id: projectId }, { rootDoc_id: this.rootDocId })
            .should.equal(false)
          done()
        }
      )
    })

    it('should call the callback with an UnsupportedFileTypeError when the doc has an unaccepted file extension', function () {
      this.ProjectEntityHandler.promises.getDocPathByProjectIdAndDocId.resolves(
        `/foo/bar.baz`
      )

      this.ProjectEntityUpdateHandler.setRootDoc(
        projectId,
        this.rootDocId,
        error => {
          expect(error).to.be.an.instanceof(Errors.UnsupportedFileTypeError)
        }
      )
    })
  })

  describe('unsetRootDoc', function () {
    it('should call Project.updateOne', function (done) {
      this.ProjectEntityUpdateHandler.unsetRootDoc(projectId, () => {
        this.ProjectModel.updateOne
          .calledWith({ _id: projectId }, { $unset: { rootDoc_id: true } })
          .should.equal(true)
        done()
      })
    })
  })

  describe('addDoc', function () {
    describe('adding a doc', function () {
      beforeEach(function (done) {
        this.path = '/path/to/doc'
        this.rev = 5

        this.newDoc = new this.DocModel({
          name: this.docName,
          lines: undefined,
          _id: docId,
          rev: this.rev,
        })
        this.DocstoreManager.promises.updateDoc.resolves({
          lines: false,
          rev: this.rev,
        })
        this.TpdsUpdateSender.promises.addDoc.resolves()
        this.ProjectEntityMongoUpdateHandler.promises.addDoc.resolves({
          result: { path: { fileSystem: this.path } },
          project: this.project,
        })
        this.ProjectEntityUpdateHandler.addDoc(
          projectId,
          docId,
          this.docName,
          this.docLines,
          userId,
          this.source,
          (...args) => {
            this.callback(...args)
            done()
          }
        )
      })

      it('creates the doc without history', function () {
        this.DocstoreManager.promises.updateDoc
          .calledWith(projectId, docId, this.docLines, 0, {})
          .should.equal(true)
      })

      it('sends the change in project structure to the doc updater', function () {
        const newDocs = [
          {
            doc: this.newDoc,
            path: this.path,
            docLines: this.docLines.join('\n'),
            ranges: {},
          },
        ]
        this.DocumentUpdaterHandler.promises.updateProjectStructure.should.have.been.calledWith(
          projectId,
          projectHistoryId,
          userId,
          {
            newDocs,
            newProject: this.project,
          },
          this.source
        )
      })
    })

    describe('adding a doc with an invalid name', function () {
      beforeEach(function (done) {
        this.path = '/path/to/doc'

        this.newDoc = { _id: docId }
        this.ProjectEntityUpdateHandler.addDoc(
          projectId,
          folderId,
          `*${this.docName}`,
          this.docLines,
          userId,
          this.source,
          (...args) => {
            this.callback(...args)
            done()
          }
        )
      })

      it('returns an error', function () {
        const errorMatcher = sinon.match.instanceOf(Errors.InvalidNameError)
        this.callback.calledWithMatch(errorMatcher).should.equal(true)
      })
    })
  })

  describe('addFile', function () {
    describe('adding a file', function () {
      beforeEach(function (done) {
        this.path = '/path/to/file'

        this.newFile = {
          _id: fileId,
          hash: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
          rev: 0,
          name: this.fileName,
          linkedFileData: this.linkedFileData,
        }
        this.FileStoreHandler.promises.uploadFileFromDisk.resolves({
          url: this.fileUrl,
          fileRef: this.newFile,
          createdBlob: true,
        })
        this.TpdsUpdateSender.promises.addFile.resolves()
        this.ProjectEntityMongoUpdateHandler.promises.addFile.resolves({
          result: { path: { fileSystem: this.path } },
          project: this.project,
        })
        this.ProjectEntityUpdateHandler.addFile(
          projectId,
          folderId,
          this.fileName,
          this.fileSystemPath,
          this.linkedFileData,
          userId,
          this.source,
          (...args) => {
            this.callback(...args)
            done()
          }
        )
      })

      it('updates the file in the filestore', function () {
        this.FileStoreHandler.promises.uploadFileFromDisk
          .calledWith(
            projectId,
            { name: this.fileName, linkedFileData: this.linkedFileData },
            this.fileSystemPath
          )
          .should.equal(true)
      })

      it('updates the file in mongo', function () {
        const fileMatcher = sinon.match(file => {
          return file.name === this.fileName
        })

        this.ProjectEntityMongoUpdateHandler.promises.addFile
          .calledWithMatch(projectId, folderId, fileMatcher)
          .should.equal(true)
      })

      it('notifies the tpds', function () {
        this.TpdsUpdateSender.promises.addFile
          .calledWith({
            projectId,
            historyId: this.project.overleaf.history.id,
            projectName: this.project.name,
            fileId,
            hash: this.newFile.hash,
            rev: 0,
            path: this.path,
            folderId,
          })
          .should.equal(true)
      })

      it('should mark the project as updated', function () {
        const args = this.ProjectUpdater.promises.markAsUpdated.args[0]
        args[0].should.equal(projectId)
        args[1].should.exist
        args[2].should.equal(userId)
      })

      it('sends the change in project structure to the doc updater', function () {
        const newFiles = [
          {
            file: this.newFile,
            path: this.path,
            url: this.fileUrl,
            createdBlob: true,
          },
        ]
        this.DocumentUpdaterHandler.promises.updateProjectStructure.should.have.been.calledWith(
          projectId,
          projectHistoryId,
          userId,
          {
            newFiles,
            newProject: this.project,
          },
          this.source
        )
      })
    })

    describe('adding a file with an invalid name', function () {
      beforeEach(function (done) {
        this.path = '/path/to/file'

        this.newFile = {
          _id: fileId,
          hash: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          rev: 0,
          name: this.fileName,
          linkedFileData: this.linkedFileData,
        }
        this.TpdsUpdateSender.promises.addFile.resolves()
        this.ProjectEntityMongoUpdateHandler.promises.addFile.resolves({
          result: { path: { fileSystem: this.path } },
          project: this.project,
        })
        this.ProjectEntityUpdateHandler.addFile(
          projectId,
          folderId,
          `*${this.fileName}`,
          this.fileSystemPath,
          this.linkedFileData,
          userId,
          this.source,
          (...args) => {
            this.callback(...args)
            done()
          }
        )
      })

      it('returns an error', function () {
        const errorMatcher = sinon.match.instanceOf(Errors.InvalidNameError)
        this.callback.calledWithMatch(errorMatcher).should.equal(true)
      })
    })
  })

  describe('upsertDoc', function () {
    describe('upserting into an invalid folder', function () {
      beforeEach(function (done) {
        this.ProjectLocator.promises.findElement.resolves({ element: null })
        this.ProjectEntityUpdateHandler.upsertDoc(
          projectId,
          folderId,
          this.docName,
          this.docLines,
          this.source,
          userId,
          (...args) => {
            this.callback(...args)
            done()
          }
        )
      })

      it('returns an error', function () {
        const errorMatcher = sinon.match.instanceOf(Error)
        this.callback.calledWithMatch(errorMatcher).should.equal(true)
      })
    })

    describe('updating an existing doc', function () {
      beforeEach(function (done) {
        this.existingDoc = { _id: docId, name: this.docName }
        this.existingFile = {
          _id: fileId,
          name: this.fileName,
          hash: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        }
        this.folder = {
          _id: folderId,
          docs: [this.existingDoc],
          fileRefs: [this.existingFile],
        }
        this.ProjectLocator.promises.findElement.resolves({
          element: this.folder,
        })
        this.DocumentUpdaterHandler.promises.setDocument.resolves()

        this.ProjectEntityUpdateHandler.upsertDoc(
          projectId,
          folderId,
          this.docName,
          this.docLines,
          this.source,
          userId,
          (...args) => {
            this.callback(...args)
            done()
          }
        )
      })

      it('tries to find the folder', function () {
        this.ProjectLocator.promises.findElement
          .calledWith({
            project_id: projectId,
            element_id: folderId,
            type: 'folder',
          })
          .should.equal(true)
      })

      it('updates the doc contents', function () {
        this.DocumentUpdaterHandler.promises.setDocument
          .calledWith(
            projectId,
            this.existingDoc._id,
            userId,
            this.docLines,
            this.source
          )
          .should.equal(true)
      })

      it('returns the doc', function () {
        this.callback.calledWith(null, this.existingDoc, false)
      })
    })

    describe('creating a new doc', function () {
      beforeEach(function (done) {
        this.folder = { _id: folderId, docs: [], fileRefs: [] }
        this.newDoc = { _id: docId }
        this.ProjectLocator.promises.findElement.resolves({
          element: this.folder,
        })
        this.ProjectEntityUpdateHandler.promises.addDocWithRanges = {
          withoutLock: sinon.stub().resolves({ doc: this.newDoc }),
        }

        this.ProjectEntityUpdateHandler.upsertDoc(
          projectId,
          folderId,
          this.docName,
          this.docLines,
          this.source,
          userId,
          (...args) => {
            this.callback(...args)
            done()
          }
        )
      })

      it('tries to find the folder', function () {
        this.ProjectLocator.promises.findElement
          .calledWith({
            project_id: projectId,
            element_id: folderId,
            type: 'folder',
          })
          .should.equal(true)
      })

      it('adds the doc', function () {
        this.ProjectEntityUpdateHandler.promises.addDocWithRanges.withoutLock.should.have.been.calledWith(
          projectId,
          folderId,
          this.docName,
          this.docLines,
          {},
          userId,
          this.source
        )
      })

      it('returns the doc', function () {
        this.callback.calledWith(null, this.newDoc, true)
      })
    })

    describe('upserting a new doc with an invalid name', function () {
      beforeEach(function (done) {
        this.folder = { _id: folderId, docs: [], fileRefs: [] }
        this.newDoc = { _id: docId }
        this.ProjectLocator.promises.findElement.resolves({
          element: this.folder,
        })
        this.ProjectEntityUpdateHandler.promises.addDocWithRanges = {
          withoutLock: sinon.stub().resolves({ doc: this.newDoc }),
        }

        this.ProjectEntityUpdateHandler.upsertDoc(
          projectId,
          folderId,
          `*${this.docName}`,
          this.docLines,
          this.source,
          userId,
          (...args) => {
            this.callback(...args)
            done()
          }
        )
      })

      it('returns an error', function () {
        const errorMatcher = sinon.match.instanceOf(Errors.InvalidNameError)
        this.callback.calledWithMatch(errorMatcher).should.equal(true)
      })
    })

    describe('upserting a doc on top of a file', function () {
      beforeEach(function (done) {
        this.newProject = {
          name: 'new project',
          overleaf: { history: { id: projectHistoryId } },
        }
        this.existingFile = { _id: fileId, name: 'foo.tex', rev: 12 }
        this.folder = { _id: folderId, docs: [], fileRefs: [this.existingFile] }
        this.newDoc = { _id: docId }
        this.docLines = ['line one', 'line two']
        this.folderPath = '/path/to/folder'
        this.filePath = '/path/to/folder/foo.tex'
        this.ProjectLocator.promises.findElement
          .withArgs({
            project_id: projectId,
            element_id: this.folder._id,
            type: 'folder',
          })
          .resolves({
            element: this.folder,
            path: {
              fileSystem: this.folderPath,
            },
          })
        this.DocstoreManager.promises.updateDoc.resolves({ rev: null })
        this.ProjectEntityMongoUpdateHandler.promises.replaceFileWithDoc.resolves(
          this.newProject
        )
        this.TpdsUpdateSender.promises.addDoc.resolves()

        this.ProjectEntityUpdateHandler.upsertDoc(
          projectId,
          folderId,
          'foo.tex',
          this.docLines,
          this.source,
          userId,
          (...args) => {
            this.callback(...args)
            done()
          }
        )
      })

      it('notifies docstore of the new doc', function () {
        expect(this.DocstoreManager.promises.updateDoc).to.have.been.calledWith(
          projectId,
          this.newDoc._id,
          this.docLines
        )
      })

      it('adds the new doc and removes the file in one go', function () {
        expect(
          this.ProjectEntityMongoUpdateHandler.promises.replaceFileWithDoc
        ).to.have.been.calledWithMatch(
          projectId,
          this.existingFile._id,
          this.newDoc
        )
      })

      it('sends the doc to TPDS', function () {
        expect(this.TpdsUpdateSender.promises.addDoc).to.have.been.calledWith({
          projectId,
          docId: this.newDoc._id,
          path: this.filePath,
          projectName: this.newProject.name,
          rev: this.existingFile.rev + 1,
          folderId,
        })
      })

      it('sends the updates to the doc updater', function () {
        const oldFiles = [
          {
            file: this.existingFile,
            path: this.filePath,
          },
        ]
        const newDocs = [
          {
            doc: sinon.match(this.newDoc),
            path: this.filePath,
            docLines: this.docLines.join('\n'),
          },
        ]
        expect(
          this.DocumentUpdaterHandler.promises.updateProjectStructure
        ).to.have.been.calledWith(
          projectId,
          projectHistoryId,
          userId,
          {
            oldFiles,
            newDocs,
            newProject: this.newProject,
          },
          this.source
        )
      })

      it('should notify everyone of the file deletion', function () {
        expect(
          this.EditorRealTimeController.emitToRoom
        ).to.have.been.calledWith(
          projectId,
          'removeEntity',
          this.existingFile._id,
          'convertFileToDoc'
        )
      })
    })
  })

  describe('upsertFile', function () {
    beforeEach(function () {
      this.FileStoreHandler.promises.uploadFileFromDisk.resolves({
        url: this.fileUrl,
        fileRef: this.file,
        createdBlob: true,
      })
    })

    describe('upserting into an invalid folder', function () {
      beforeEach(function (done) {
        this.ProjectLocator.promises.findElement.resolves({ element: null })
        this.ProjectEntityUpdateHandler.upsertFile(
          projectId,
          folderId,
          this.fileName,
          this.fileSystemPath,
          this.linkedFileData,
          userId,
          this.source,
          (...args) => {
            this.callback(...args)
            done()
          }
        )
      })

      it('returns an error', function () {
        const errorMatcher = sinon.match.instanceOf(Error)
        this.callback.calledWithMatch(errorMatcher).should.equal(true)
      })
    })

    describe('updating an existing file', function () {
      beforeEach(function (done) {
        this.existingFile = { _id: fileId, name: this.fileName, rev: 1 }
        this.newFile = {
          _id: new ObjectId(),
          name: this.fileName,
          rev: 3,
          hash: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        }
        this.folder = { _id: folderId, fileRefs: [this.existingFile], docs: [] }
        this.ProjectLocator.promises.findElement.resolves({
          element: this.folder,
        })
        this.newProject = 'new-project-stub'
        this.ProjectEntityMongoUpdateHandler.promises.replaceFileWithNew.resolves(
          {
            oldFileRef: this.existingFile,
            project: this.project,
            path: { fileSystem: this.fileSystemPath },
            newProject: this.newProject,
            newFileRef: this.newFile,
          }
        )
        this.ProjectEntityUpdateHandler.upsertFile(
          projectId,
          folderId,
          this.fileName,
          this.fileSystemPath,
          this.linkedFileData,
          userId,
          this.source,
          (...args) => {
            this.callback(...args)
            done()
          }
        )
      })

      it('uploads a new version of the file', function () {
        this.FileStoreHandler.promises.uploadFileFromDisk.should.have.been.calledWith(
          projectId,
          {
            name: this.fileName,
            linkedFileData: this.linkedFileData,
          },
          this.fileSystemPath
        )
      })

      it('replaces the file in mongo', function () {
        this.ProjectEntityMongoUpdateHandler.promises.replaceFileWithNew.should.have.been.calledWith(
          projectId,
          this.existingFile._id,
          this.file
        )
      })

      it('notifies the tpds', function () {
        this.TpdsUpdateSender.promises.addFile.should.have.been.calledWith({
          projectId,
          historyId: this.project.overleaf.history.id,
          projectName: this.project.name,
          fileId: this.newFile._id,
          hash: this.newFile.hash,
          rev: this.newFile.rev,
          path: this.fileSystemPath,
          folderId,
        })
      })

      it('should mark the project as updated', function () {
        const args = this.ProjectUpdater.promises.markAsUpdated.args[0]
        args[0].should.equal(projectId)
        args[1].should.exist
        args[2].should.equal(userId)
      })

      it('updates the project structure in the doc updater', function () {
        const oldFiles = [
          {
            file: this.existingFile,
            path: this.fileSystemPath,
          },
        ]
        const newFiles = [
          {
            file: this.newFile,
            path: this.fileSystemPath,
            url: this.fileUrl,
            createdBlob: true,
          },
        ]
        this.DocumentUpdaterHandler.promises.updateProjectStructure.should.have.been.calledWith(
          projectId,
          projectHistoryId,
          userId,
          {
            oldFiles,
            newFiles,
            newProject: this.newProject,
          },
          this.source
        )
      })

      it('returns the file', function () {
        this.callback.calledWith(null, this.existingFile, false)
      })
    })

    describe('creating a new file', function () {
      beforeEach(function (done) {
        this.folder = { _id: folderId, fileRefs: [], docs: [] }
        this.newFile = {
          _id: fileId,
          hash: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        }
        this.ProjectLocator.promises.findElement.resolves({
          element: this.folder,
        })
        this.FileStoreHandler.promises.uploadFileFromDisk.resolves({
          url: this.fileUrl,
          fileRef: this.newFile,
          createdBlob: true,
        })
        this.ProjectEntityUpdateHandler.promises.addFile = {
          mainTask: sinon.stub().resolves(this.newFile),
        }

        this.ProjectEntityUpdateHandler.upsertFile(
          projectId,
          folderId,
          this.fileName,
          this.fileSystemPath,
          this.linkedFileData,
          userId,
          this.source,
          (...args) => {
            this.callback(...args)
            done()
          }
        )
      })

      it('tries to find the folder', function () {
        this.ProjectLocator.promises.findElement.should.have.been.calledWith({
          project_id: projectId,
          element_id: folderId,
          type: 'folder',
        })
      })

      it('adds the file', function () {
        expect(
          this.ProjectEntityUpdateHandler.promises.addFile.mainTask
        ).to.have.been.calledWith({
          projectId,
          folderId,
          userId,
          fileRef: this.newFile,
          fileStoreUrl: this.fileUrl,
          source: this.source,
          createdBlob: true,
        })
      })

      it('returns the file', function () {
        this.callback.calledWith(null, this.newFile, true)
      })
    })

    describe('upserting a new file with an invalid name', function () {
      beforeEach(function (done) {
        this.folder = { _id: folderId, fileRefs: [] }
        this.newFile = { _id: fileId }
        this.ProjectLocator.promises.findElement.resolves({
          element: this.folder,
        })
        this.ProjectEntityUpdateHandler.promises.addFile = {
          mainTask: sinon.stub().resolves(this.newFile),
        }

        this.ProjectEntityUpdateHandler.upsertFile(
          projectId,
          folderId,
          `*${this.fileName}`,
          this.fileSystemPath,
          this.linkedFileData,
          userId,
          this.source,
          (...args) => {
            this.callback(...args)
            done()
          }
        )
      })

      it('returns an error', function () {
        const errorMatcher = sinon.match.instanceOf(Errors.InvalidNameError)
        this.callback.calledWithMatch(errorMatcher).should.equal(true)
      })
    })

    describe('upserting file on top of a doc', function () {
      beforeEach(function (done) {
        this.path = '/path/to/doc'
        this.existingDoc = { _id: new ObjectId(), name: this.fileName }
        this.folder = {
          _id: folderId,
          fileRefs: [],
          docs: [this.existingDoc],
        }
        this.ProjectLocator.promises.findElement
          .withArgs({
            project_id: this.project._id.toString(),
            element_id: folderId,
            type: 'folder',
          })
          .resolves({ element: this.folder })
        this.ProjectLocator.promises.findElement
          .withArgs({
            project_id: this.project._id.toString(),
            element_id: this.existingDoc._id,
            type: 'doc',
          })
          .resolves({
            element: this.existingDoc,
            path: { fileSystem: this.path },
            folder: this.folder,
          })

        this.newFileUrl = 'new-file-url'
        this.newFile = {
          _id: newFileId,
          name: 'dummy-upload-filename',
          rev: 0,
          linkedFileData: this.linkedFileData,
        }
        this.newProject = {
          name: 'new project',
          overleaf: { history: { id: projectHistoryId } },
        }
        this.FileStoreHandler.promises.uploadFileFromDisk.resolves({
          url: this.newFileUrl,
          fileRef: this.newFile,
          createdBlob: true,
        })
        this.ProjectEntityMongoUpdateHandler.promises.replaceDocWithFile.resolves(
          this.newProject
        )

        this.ProjectEntityUpdateHandler.upsertFile(
          projectId,
          folderId,
          this.fileName,
          this.fileSystemPath,
          this.linkedFileData,
          userId,
          this.source,
          done
        )
      })

      it('replaces the existing doc with a file', function () {
        expect(
          this.ProjectEntityMongoUpdateHandler.promises.replaceDocWithFile
        ).to.have.been.calledWith(projectId, this.existingDoc._id, this.newFile)
      })

      it('updates the doc structure', function () {
        const oldDocs = [
          {
            doc: this.existingDoc,
            path: this.path,
          },
        ]
        const newFiles = [
          {
            file: this.newFile,
            path: this.path,
            url: this.newFileUrl,
            createdBlob: true,
          },
        ]
        const updates = {
          oldDocs,
          newFiles,
          newProject: this.newProject,
        }
        expect(
          this.DocumentUpdaterHandler.promises.updateProjectStructure
        ).to.have.been.calledWith(
          projectId,
          projectHistoryId,
          userId,
          updates,
          this.source
        )
      })

      it('tells everyone in the room the doc is removed', function () {
        expect(
          this.EditorRealTimeController.emitToRoom
        ).to.have.been.calledWith(
          projectId,
          'removeEntity',
          this.existingDoc._id,
          'convertDocToFile'
        )
      })
    })
  })

  describe('upsertDocWithPath', function () {
    describe('upserting a doc', function () {
      beforeEach(function (done) {
        this.path = '/folder/doc.tex'
        this.newFolders = ['mock-a', 'mock-b']
        this.folder = { _id: folderId }
        this.doc = { _id: docId }
        this.isNewDoc = true
        this.ProjectEntityUpdateHandler.promises.mkdirp = {
          withoutLock: sinon
            .stub()
            .resolves({ newFolders: this.newFolders, folder: this.folder }),
        }
        this.ProjectEntityUpdateHandler.promises.upsertDoc = {
          withoutLock: sinon
            .stub()
            .resolves({ doc: this.doc, isNew: this.isNewDoc }),
        }

        this.ProjectEntityUpdateHandler.upsertDocWithPath(
          projectId,
          this.path,
          this.docLines,
          this.source,
          userId,
          (...args) => {
            this.callback(...args)
            done()
          }
        )
      })

      it('creates any necessary folders', function () {
        this.ProjectEntityUpdateHandler.promises.mkdirp.withoutLock
          .calledWith(projectId, '/folder')
          .should.equal(true)
      })

      it('upserts the doc', function () {
        this.ProjectEntityUpdateHandler.promises.upsertDoc.withoutLock
          .calledWith(
            projectId,
            this.folder._id,
            'doc.tex',
            this.docLines,
            this.source,
            userId
          )
          .should.equal(true)
      })

      it('calls the callback', function () {
        this.callback
          .calledWith(
            null,
            this.doc,
            this.isNewDoc,
            this.newFolders,
            this.folder
          )
          .should.equal(true)
      })
    })

    describe('upserting a doc with an invalid path', function () {
      beforeEach(function (done) {
        this.path = '/*folder/doc.tex'
        this.newFolders = ['mock-a', 'mock-b']
        this.folder = { _id: folderId }
        this.doc = { _id: docId }
        this.isNewDoc = true
        this.ProjectEntityUpdateHandler.promises.mkdirp = {
          withoutLock: sinon
            .stub()
            .resolves({ newFolders: this.newFolders, folder: this.folder }),
        }
        this.ProjectEntityUpdateHandler.promises.upsertDoc = {
          withoutLock: sinon
            .stub()
            .resolves({ doc: this.doc, isNew: this.isNewDoc }),
        }

        this.ProjectEntityUpdateHandler.upsertDocWithPath(
          projectId,
          this.path,
          this.docLines,
          this.source,
          userId,
          (...args) => {
            this.callback(...args)
            done()
          }
        )
      })

      it('returns an error', function () {
        const errorMatcher = sinon.match.instanceOf(Errors.InvalidNameError)
        this.callback.calledWithMatch(errorMatcher).should.equal(true)
      })
    })

    describe('upserting a doc with an invalid name', function () {
      beforeEach(function (done) {
        this.path = '/folder/*doc.tex'
        this.newFolders = ['mock-a', 'mock-b']
        this.folder = { _id: folderId }
        this.doc = { _id: docId }
        this.isNewDoc = true
        this.ProjectEntityUpdateHandler.promises.mkdirp = {
          withoutLock: sinon
            .stub()
            .resolves({ newFolders: this.newFolders, folder: this.folder }),
        }
        this.ProjectEntityUpdateHandler.promises.upsertDoc = {
          withoutLock: sinon
            .stub()
            .resolves({ doc: this.doc, isNew: this.isNewDoc }),
        }

        this.ProjectEntityUpdateHandler.upsertDocWithPath(
          projectId,
          this.path,
          this.docLines,
          this.source,
          userId,
          (...args) => {
            this.callback(...args)
            done()
          }
        )
      })

      it('returns an error', function () {
        const errorMatcher = sinon.match.instanceOf(Errors.InvalidNameError)
        this.callback.calledWithMatch(errorMatcher).should.equal(true)
      })
    })
  })

  describe('upsertFileWithPath', function () {
    describe('upserting a file', function () {
      beforeEach(function (done) {
        this.path = '/folder/file.png'
        this.newFolders = ['mock-a', 'mock-b']
        this.folder = { _id: folderId }
        this.file = { _id: fileId }
        this.isNewFile = true
        this.FileStoreHandler.promises.uploadFileFromDisk.resolves({
          url: this.fileUrl,
          fileRef: this.newFile,
          createdBlob: true,
        })
        this.ProjectEntityUpdateHandler.promises.mkdirp = {
          withoutLock: sinon
            .stub()
            .resolves({ newFolders: this.newFolders, folder: this.folder }),
        }
        this.ProjectEntityUpdateHandler.promises.upsertFile = {
          mainTask: sinon
            .stub()
            .resolves({ fileRef: this.file, isNew: this.isNewFile }),
        }

        this.ProjectEntityUpdateHandler.upsertFileWithPath(
          projectId,
          this.path,
          this.fileSystemPath,
          this.linkedFileData,
          userId,
          this.source,
          (...args) => {
            this.callback(...args)
            done()
          }
        )
      })

      it('creates any necessary folders', function () {
        this.ProjectEntityUpdateHandler.promises.mkdirp.withoutLock
          .calledWith(projectId, '/folder')
          .should.equal(true)
      })

      it('upserts the file', function () {
        this.ProjectEntityUpdateHandler.promises.upsertFile.mainTask.should.have.been.calledWith(
          {
            projectId,
            folderId: this.folder._id,
            fileName: 'file.png',
            fsPath: this.fileSystemPath,
            linkedFileData: this.linkedFileData,
            userId,
            fileRef: this.newFile,
            fileStoreUrl: this.fileUrl,
            source: this.source,
            createdBlob: true,
          }
        )
      })

      it('calls the callback', function () {
        this.callback.should.have.been.calledWith(
          null,
          this.file,
          this.isNewFile,
          undefined,
          this.newFolders,
          this.folder
        )
      })
    })

    describe('upserting a file with an invalid path', function () {
      beforeEach(function (done) {
        this.path = '/*folder/file.png'
        this.newFolders = ['mock-a', 'mock-b']
        this.folder = { _id: folderId }
        this.file = { _id: fileId }
        this.isNewFile = true
        this.ProjectEntityUpdateHandler.promises.mkdirp = {
          withoutLock: sinon
            .stub()
            .resolves({ newFolders: this.newFolders, folder: this.folder }),
        }
        this.ProjectEntityUpdateHandler.promises.upsertFile = {
          mainTask: sinon
            .stub()
            .resolves({ doc: this.file, isNew: this.isNewFile }),
        }

        this.ProjectEntityUpdateHandler.upsertFileWithPath(
          projectId,
          this.path,
          this.fileSystemPath,
          this.linkedFileData,
          userId,
          this.source,
          (...args) => {
            this.callback(...args)
            done()
          }
        )
      })

      it('returns an error', function () {
        const errorMatcher = sinon.match.instanceOf(Errors.InvalidNameError)
        this.callback.calledWithMatch(errorMatcher).should.equal(true)
      })
    })

    describe('upserting a file with an invalid name', function () {
      beforeEach(function (done) {
        this.path = '/folder/*file.png'
        this.newFolders = ['mock-a', 'mock-b']
        this.folder = { _id: folderId }
        this.file = { _id: fileId }
        this.isNewFile = true
        this.ProjectEntityUpdateHandler.promises.mkdirp = {
          withoutLock: sinon
            .stub()
            .resolves({ newFolders: this.newFolders, folder: this.folder }),
        }
        this.ProjectEntityUpdateHandler.promises.upsertFile = {
          mainTask: sinon
            .stub()
            .resolves({ doc: this.file, isNew: this.isNewFile }),
        }

        this.ProjectEntityUpdateHandler.upsertFileWithPath(
          projectId,
          this.path,
          this.fileSystemPath,
          this.linkedFileData,
          userId,
          this.source,
          (...args) => {
            this.callback(...args)
            done()
          }
        )
      })

      it('returns an error', function () {
        const errorMatcher = sinon.match.instanceOf(Errors.InvalidNameError)
        this.callback.calledWithMatch(errorMatcher).should.equal(true)
      })
    })
  })

  describe('deleteEntity', function () {
    beforeEach(function (done) {
      this.path = '/path/to/doc.tex'
      this.doc = { _id: docId }
      this.projectBeforeDeletion = { _id: projectId, name: 'project' }
      this.newProject = 'new-project'
      this.ProjectEntityMongoUpdateHandler.promises.deleteEntity.resolves({
        entity: this.doc,
        path: { fileSystem: this.path },
        projectBeforeDeletion: this.projectBeforeDeletion,
        newProject: this.newProject,
      })
      this.ProjectEntityUpdateHandler._cleanUpEntity = sinon
        .stub()
        .resolves([{ type: 'doc', entity: this.doc, path: this.path }])

      this.ProjectEntityUpdateHandler.deleteEntity(
        projectId,
        docId,
        'doc',
        userId,
        this.source,
        (...args) => {
          this.callback(...args)
          done()
        }
      )
    })

    it('flushes the project to mongo', function () {
      this.DocumentUpdaterHandler.promises.flushProjectToMongo.should.have.been.calledWith(
        projectId
      )
    })

    it('deletes the entity in mongo', function () {
      this.ProjectEntityMongoUpdateHandler.promises.deleteEntity
        .calledWith(projectId, docId, 'doc')
        .should.equal(true)
    })

    it('cleans up the doc in the docstore', function () {
      this.ProjectEntityUpdateHandler._cleanUpEntity
        .calledWith(
          this.projectBeforeDeletion,
          this.newProject,
          this.doc,
          'doc',
          this.path,
          userId,
          this.source
        )
        .should.equal(true)
    })

    it('it notifies the tpds', function () {
      this.TpdsUpdateSender.promises.deleteEntity.should.have.been.calledWith({
        projectId,
        path: this.path,
        projectName: this.projectBeforeDeletion.name,
        entityId: docId,
        entityType: 'doc',
        subtreeEntityIds: [this.doc._id],
      })
    })

    it('retuns the entity_id', function () {
      this.callback.calledWith(null, docId).should.equal(true)
    })
  })

  describe('deleteEntityWithPath', function () {
    describe('when the entity exists', function () {
      beforeEach(function (done) {
        this.doc = { _id: docId }
        this.ProjectLocator.promises.findElementByPath.resolves({
          element: this.doc,
          type: 'doc',
        })
        this.ProjectEntityUpdateHandler.promises.deleteEntity = {
          withoutLock: sinon.stub().resolves(),
        }
        this.path = '/path/to/doc.tex'
        this.ProjectEntityUpdateHandler.deleteEntityWithPath(
          projectId,
          this.path,
          userId,
          this.source,
          done
        )
      })

      it('finds the entity', function () {
        this.ProjectLocator.promises.findElementByPath
          .calledWith({
            project_id: projectId,
            path: this.path,
            exactCaseMatch: true,
          })
          .should.equal(true)
      })

      it('deletes the entity', function () {
        this.ProjectEntityUpdateHandler.promises.deleteEntity.withoutLock.should.have.been.calledWith(
          projectId,
          this.doc._id,
          'doc',
          userId,
          this.source
        )
      })
    })

    describe('when the entity does not exist', function () {
      beforeEach(function (done) {
        this.ProjectLocator.promises.findElementByPath.resolves({
          element: null,
        })
        this.path = '/doc.tex'
        this.ProjectEntityUpdateHandler.deleteEntityWithPath(
          projectId,
          this.path,
          userId,
          this.source,
          (...args) => {
            this.callback(...args)
            done()
          }
        )
      })

      it('returns an error', function () {
        this.callback.should.have.been.calledWith(
          sinon.match.instanceOf(Errors.NotFoundError)
        )
      })
    })
  })

  describe('mkdirp', function () {
    beforeEach(function (done) {
      this.docPath = '/folder/doc.tex'
      this.ProjectEntityMongoUpdateHandler.promises.mkdirp.resolves({})
      this.ProjectEntityUpdateHandler.mkdirp(projectId, this.docPath, done)
    })

    it('calls ProjectEntityMongoUpdateHandler', function () {
      this.ProjectEntityMongoUpdateHandler.promises.mkdirp
        .calledWith(projectId, this.docPath)
        .should.equal(true)
    })
  })

  describe('mkdirpWithExactCase', function () {
    beforeEach(function (done) {
      this.docPath = '/folder/doc.tex'
      this.ProjectEntityMongoUpdateHandler.promises.mkdirp.resolves({})
      this.ProjectEntityUpdateHandler.mkdirpWithExactCase(
        projectId,
        this.docPath,
        done
      )
    })

    it('calls ProjectEntityMongoUpdateHandler', function () {
      this.ProjectEntityMongoUpdateHandler.promises.mkdirp
        .calledWith(projectId, this.docPath, { exactCaseMatch: true })
        .should.equal(true)
    })
  })

  describe('addFolder', function () {
    describe('adding a folder', function () {
      beforeEach(function (done) {
        this.parentFolderId = '123asdf'
        this.folderName = 'new-folder'
        this.ProjectEntityMongoUpdateHandler.promises.addFolder.resolves({})
        this.ProjectEntityUpdateHandler.addFolder(
          projectId,
          this.parentFolderId,
          this.folderName,
          done
        )
      })

      it('calls ProjectEntityMongoUpdateHandler', function () {
        this.ProjectEntityMongoUpdateHandler.promises.addFolder
          .calledWith(projectId, this.parentFolderId, this.folderName)
          .should.equal(true)
      })
    })

    describe('adding a folder with an invalid name', function () {
      beforeEach(function (done) {
        this.parentFolderId = '123asdf'
        this.folderName = '*new-folder'
        this.ProjectEntityMongoUpdateHandler.promises.addFolder.resolves({})
        this.ProjectEntityUpdateHandler.addFolder(
          projectId,
          this.parentFolderId,
          this.folderName,
          (...args) => {
            this.callback(...args)
            done()
          }
        )
      })

      it('returns an error', function () {
        const errorMatcher = sinon.match.instanceOf(Errors.InvalidNameError)
        this.callback.calledWithMatch(errorMatcher).should.equal(true)
      })
    })
  })

  describe('moveEntity', function () {
    beforeEach(function (done) {
      this.project_name = 'project name'
      this.startPath = '/a.tex'
      this.endPath = '/folder/b.tex'
      this.rev = 2
      this.changes = { newDocs: ['old-doc'], newFiles: ['old-file'] }
      this.ProjectEntityMongoUpdateHandler.promises.moveEntity.resolves({
        project: this.project,
        startPath: this.startPath,
        endPath: this.endPath,
        rev: this.rev,
        changes: this.changes,
      })

      this.ProjectEntityUpdateHandler.moveEntity(
        projectId,
        docId,
        folderId,
        'doc',
        userId,
        this.source,
        done
      )
    })

    it('moves the entity in mongo', function () {
      this.ProjectEntityMongoUpdateHandler.promises.moveEntity
        .calledWith(projectId, docId, folderId, 'doc')
        .should.equal(true)
    })

    it('notifies tpds', function () {
      this.TpdsUpdateSender.promises.moveEntity
        .calledWith({
          projectId,
          projectName: this.project_name,
          startPath: this.startPath,
          endPath: this.endPath,
          rev: this.rev,
          entityId: docId,
          entityType: 'doc',
          folderId,
        })
        .should.equal(true)
    })

    it('sends the changes in project structure to the doc updater', function () {
      this.DocumentUpdaterHandler.promises.updateProjectStructure
        .calledWith(
          projectId,
          projectHistoryId,
          userId,
          this.changes,
          this.source
        )
        .should.equal(true)
    })
  })

  describe('renameEntity', function () {
    describe('renaming an entity', function () {
      beforeEach(function (done) {
        this.project_name = 'project name'
        this.startPath = '/folder/a.tex'
        this.endPath = '/folder/b.tex'
        this.rev = 2
        this.changes = { newDocs: ['old-doc'], newFiles: ['old-file'] }
        this.newDocName = 'b.tex'
        this.ProjectEntityMongoUpdateHandler.promises.renameEntity.resolves({
          project: this.project,
          startPath: this.startPath,
          endPath: this.endPath,
          rev: this.rev,
          changes: this.changes,
        })

        this.ProjectEntityUpdateHandler.renameEntity(
          projectId,
          docId,
          'doc',
          this.newDocName,
          userId,
          this.source,
          done
        )
      })

      it('moves the entity in mongo', function () {
        this.ProjectEntityMongoUpdateHandler.promises.renameEntity
          .calledWith(projectId, docId, 'doc', this.newDocName)
          .should.equal(true)
      })

      it('notifies tpds', function () {
        this.TpdsUpdateSender.promises.moveEntity
          .calledWith({
            projectId,
            projectName: this.project_name,
            startPath: this.startPath,
            endPath: this.endPath,
            rev: this.rev,
            entityId: docId,
            entityType: 'doc',
            folderId: null,
          })
          .should.equal(true)
      })

      it('flushes the project in doc updater', function () {
        this.DocumentUpdaterHandler.promises.flushProjectToMongo.should.have.been.calledWith(
          projectId
        )
      })

      it('sends the changes in project structure to the doc updater', function () {
        this.DocumentUpdaterHandler.promises.updateProjectStructure
          .calledWith(
            projectId,
            projectHistoryId,
            userId,
            this.changes,
            this.source
          )
          .should.equal(true)
      })
    })

    describe('renaming an entity to an invalid name', function () {
      beforeEach(function (done) {
        this.project_name = 'project name'
        this.startPath = '/folder/a.tex'
        this.endPath = '/folder/b.tex'
        this.rev = 2
        this.changes = { newDocs: ['old-doc'], newFiles: ['old-file'] }
        this.newDocName = '*b.tex'
        this.ProjectEntityMongoUpdateHandler.promises.renameEntity.resolves({
          project: this.project,
          startPath: this.startPath,
          endPath: this.endPath,
          rev: this.rev,
          changes: this.changes,
        })

        this.ProjectEntityUpdateHandler.renameEntity(
          projectId,
          docId,
          'doc',
          this.newDocName,
          userId,
          this.source,
          (...args) => {
            this.callback(...args)
            done()
          }
        )
      })

      it('returns an error', function () {
        const errorMatcher = sinon.match.instanceOf(Errors.InvalidNameError)
        this.callback.calledWithMatch(errorMatcher).should.equal(true)
      })
    })

    describe('renaming an entity with a non-string value', function () {
      beforeEach(function (done) {
        this.project_name = 'project name'
        this.startPath = '/folder/a.tex'
        this.endPath = '/folder/b.tex'
        this.rev = 2
        this.changes = { newDocs: ['old-doc'], newFiles: ['old-file'] }
        this.newDocName = ['hello']
        this.ProjectEntityMongoUpdateHandler.promises.renameEntity.resolves({
          project: this.project,
          startPath: this.startPath,
          endPath: this.endPath,
          rev: this.rev,
          changes: this.changes,
        })

        this.ProjectEntityUpdateHandler.renameEntity(
          projectId,
          docId,
          'doc',
          this.newDocName,
          userId,
          this.source,
          (...args) => {
            this.callback(...args)
            done()
          }
        )
      })

      it('returns an error', function () {
        const errorMatcher = sinon.match.instanceOf(Error)
        this.callback.calledWithMatch(errorMatcher).should.equal(true)
        expect(
          this.ProjectEntityMongoUpdateHandler.promises.renameEntity.called
        ).to.equal(false)
      })
    })
  })

  describe('resyncProjectHistory', function () {
    describe('a deleted project', function () {
      beforeEach(function (done) {
        this.ProjectGetter.promises.getProject.resolves({})

        this.ProjectEntityUpdateHandler.resyncProjectHistory(
          projectId,
          {},
          (...args) => {
            this.callback(...args)
            done()
          }
        )
      })

      it('should return an error', function () {
        expect(this.callback).to.have.been.calledWith(
          sinon.match
            .instanceOf(Errors.ProjectHistoryDisabledError)
            .and(
              sinon.match.has(
                'message',
                `project history not enabled for ${projectId}`
              )
            )
        )
      })
    })

    describe('a project without project-history enabled', function () {
      beforeEach(function (done) {
        this.project.overleaf = {}
        this.ProjectGetter.promises.getProject.resolves(this.project)

        this.ProjectEntityUpdateHandler.resyncProjectHistory(
          projectId,
          {},
          (...args) => {
            this.callback(...args)
            done()
          }
        )
      })

      it('should return an error', function () {
        expect(this.callback).to.have.been.calledWith(
          sinon.match
            .instanceOf(Errors.ProjectHistoryDisabledError)
            .and(
              sinon.match.has(
                'message',
                `project history not enabled for ${projectId}`
              )
            )
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
      beforeEach(function (done) {
        this.ProjectGetter.promises.getProject.resolves(this.project)
        const folders = []
        this.ProjectEntityHandler.getAllEntitiesFromProject.returns({
          docs,
          files,
          folders,
        })
        this.ProjectEntityUpdateHandler.resyncProjectHistory(
          projectId,
          {},
          (...args) => {
            this.callback(...args)
            done()
          }
        )
      })

      it('gets the project', function () {
        this.ProjectGetter.promises.getProject.should.have.been.calledWith(
          projectId
        )
      })

      it('gets the entities for the project', function () {
        this.ProjectEntityHandler.getAllEntitiesFromProject.should.have.been.calledWith(
          this.project
        )
      })

      it('uses an extended timeout', function () {
        this.LockManager.withTimeout.should.have.been.calledWith(6 * 60)
      })

      it('tells the doc updater to sync the project', function () {
        this.DocumentUpdaterHandler.promises.resyncProjectHistory
          .calledWith(projectId, projectHistoryId, docs, files)
          .should.equal(true)
      })

      it('calls the callback', function () {
        this.callback.called.should.equal(true)
      })
    })

    describe('a project with duplicate filenames', function () {
      beforeEach(function (done) {
        this.ProjectGetter.promises.getProject.resolves(this.project)
        this.docs = [
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
        this.files = [
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
        this.ProjectEntityHandler.getAllEntitiesFromProject.returns({
          docs: this.docs,
          files: this.files,
          folders: [],
        })
        this.ProjectEntityUpdateHandler.resyncProjectHistory(
          projectId,
          {},
          done
        )
      })

      it('renames the duplicate files', function () {
        const renameEntity =
          this.ProjectEntityMongoUpdateHandler.promises.renameEntity
        expect(renameEntity).to.have.callCount(4)
        expect(renameEntity).to.have.been.calledWith(
          projectId,
          'doc3',
          'doc',
          'duplicate.tex (1)'
        )
        expect(renameEntity).to.have.been.calledWith(
          projectId,
          'doc5',
          'doc',
          'duplicate.tex (2)'
        )
        expect(renameEntity).to.have.been.calledWith(
          projectId,
          'file3',
          'file',
          'duplicate.jpg (1)'
        )
        expect(renameEntity).to.have.been.calledWith(
          projectId,
          'file4',
          'file',
          'another dupe (23)'
        )
      })

      it('tells the doc updater to resync the project', function () {
        const docs = this.docs.map(d => {
          if (d.doc._id === 'doc3') {
            return Object.assign({}, d, { path: 'a/b/c/duplicate.tex (1)' })
          }
          if (d.doc._id === 'doc5') {
            return Object.assign({}, d, { path: 'a/b/c/duplicate.tex (2)' })
          }
          return d
        })
        const files = this.files.map(f => {
          if (f.file._id === 'file3') {
            return Object.assign({}, f, { path: 'duplicate.jpg (1)' })
          }
          if (f.file._id === 'file4') {
            return Object.assign({}, f, { path: 'another dupe (23)' })
          }
          return f
        })
        expect(
          this.DocumentUpdaterHandler.promises.resyncProjectHistory
        ).to.have.been.calledWith(projectId, projectHistoryId, docs, files)
      })
    })

    describe('a project with bad filenames', function () {
      beforeEach(function (done) {
        this.ProjectGetter.promises.getProject.resolves(this.project)
        this.docs = [
          {
            doc: { _id: 'doc1', name: '/d/e/f/test.tex' },
            path: 'a/b/c/d/e/f/test.tex',
          },
          {
            doc: { _id: 'doc2', name: '' },
            path: 'a',
          },
        ]
        this.files = [
          {
            file: { _id: 'file1', name: 'A*.png', hash: 'hash1' },
            path: 'A*.png',
          },
          {
            file: { _id: 'file2', name: 'A_.png', hash: 'hash2' },
            path: 'A_.png',
          },
        ]
        this.ProjectEntityHandler.getAllEntitiesFromProject.returns({
          docs: this.docs,
          files: this.files,
          folders: [],
        })
        this.ProjectEntityUpdateHandler.resyncProjectHistory(
          projectId,
          {},
          done
        )
      })

      it('renames the files', function () {
        const renameEntity =
          this.ProjectEntityMongoUpdateHandler.promises.renameEntity
        expect(renameEntity).to.have.callCount(4)
        expect(renameEntity).to.have.been.calledWith(
          projectId,
          'doc1',
          'doc',
          '_d_e_f_test.tex'
        )
        expect(renameEntity).to.have.been.calledWith(
          projectId,
          'doc2',
          'doc',
          'untitled'
        )
        expect(renameEntity).to.have.been.calledWith(
          projectId,
          'file1',
          'file',
          'A_.png'
        )
        expect(renameEntity).to.have.been.calledWith(
          projectId,
          'file2',
          'file',
          'A_.png (1)'
        )
      })

      it('tells the doc updater to resync the project', function () {
        const docs = this.docs.map(d => {
          if (d.doc._id === 'doc1') {
            return Object.assign({}, d, { path: 'a/b/c/_d_e_f_test.tex' })
          }
          if (d.doc._id === 'doc2') {
            return Object.assign({}, d, { path: 'a/untitled' })
          }
          return d
        })
        const files = this.files.map(f => {
          if (f.file._id === 'file1') {
            return Object.assign({}, f, { path: 'A_.png' })
          }
          if (f.file._id === 'file2') {
            return Object.assign({}, f, { path: 'A_.png (1)' })
          }
          return f
        })
        expect(
          this.DocumentUpdaterHandler.promises.resyncProjectHistory
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
      beforeEach(function (done) {
        this.ProjectGetter.promises.getProject.resolves(this.project)
        this.ProjectEntityHandler.getAllEntitiesFromProject.returns({
          docs,
          files,
          folders,
        })
        this.ProjectEntityUpdateHandler.resyncProjectHistory(
          projectId,
          {},
          done
        )
      })

      it('renames the folder', function () {
        const renameEntity =
          this.ProjectEntityMongoUpdateHandler.promises.renameEntity
        expect(renameEntity).to.have.callCount(1)
        expect(renameEntity).to.have.been.calledWith(
          projectId,
          'folder2',
          'folder',
          'bad_'
        )
      })

      it('tells the doc updater to resync the project', function () {
        const fixedDocs = docs.map(d => {
          if (d.doc._id === 'doc2') {
            return Object.assign({}, d, { path: 'bad_/doc2.tex' })
          }
          return d
        })
        expect(
          this.DocumentUpdaterHandler.promises.resyncProjectHistory
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
      beforeEach(function (done) {
        this.ProjectGetter.promises.getProject.resolves(this.project)
        this.ProjectEntityHandler.getAllEntitiesFromProject.returns({
          docs,
          files,
          folders,
        })
        this.ProjectEntityUpdateHandler.resyncProjectHistory(
          projectId,
          {},
          done
        )
      })

      it('renames the doc', function () {
        const renameEntity =
          this.ProjectEntityMongoUpdateHandler.promises.renameEntity
        expect(renameEntity).to.have.callCount(1)
        expect(renameEntity).to.have.been.calledWith(
          projectId,
          'doc1',
          'doc',
          'chapters (1)'
        )
      })

      it('tells the doc updater to resync the project', function () {
        const fixedDocs = docs.map(d => {
          if (d.doc._id === 'doc1') {
            return Object.assign({}, d, { path: 'chapters (1)' })
          }
          return d
        })
        expect(
          this.DocumentUpdaterHandler.promises.resyncProjectHistory
        ).to.have.been.calledWith(projectId, projectHistoryId, fixedDocs, files)
      })
    })

    describe('a project with an invalid file tree', function () {
      beforeEach(function (done) {
        this.callback = sinon.stub()
        this.ProjectGetter.promises.getProject.resolves(this.project)
        this.ProjectEntityHandler.getAllEntitiesFromProject.throws()
        this.ProjectEntityUpdateHandler.resyncProjectHistory(
          projectId,
          {},
          (...args) => {
            this.callback(...args)
            done()
          }
        )
      })

      it('calls the callback with an error', function () {
        expect(this.callback).to.have.been.calledWith(
          sinon.match.instanceOf(Error)
        )
      })
    })
  })

  describe('_cleanUpEntity', function () {
    beforeEach(function () {
      this.entityId = '4eecaffcbffa66588e000009'
      this.FileStoreHandler.promises.deleteFile.resolves()
      this.ProjectEntityUpdateHandler.promises.unsetRootDoc = sinon
        .stub()
        .resolves()
      this.ProjectEntityMongoUpdateHandler.promises._insertDeletedFileReference.resolves()
    })

    describe('a file', function () {
      beforeEach(async function () {
        this.path = '/file/system/path.png'
        this.entity = { _id: this.entityId }
        this.newProject = 'new-project'
        this.subtreeListing =
          await this.ProjectEntityUpdateHandler._cleanUpEntity(
            this.project,
            this.newProject,
            this.entity,
            'file',
            this.path,
            userId,
            this.source
          )
      })

      it('should insert the file into the deletedFiles collection', function () {
        this.ProjectEntityMongoUpdateHandler.promises._insertDeletedFileReference
          .calledWith(this.project._id, this.entity)
          .should.equal(true)
      })

      it('should not delete the file from FileStoreHandler', function () {
        this.FileStoreHandler.promises.deleteFile
          .calledWith(projectId, this.entityId)
          .should.equal(false)
      })

      it('should not attempt to delete from the document updater', function () {
        this.DocumentUpdaterHandler.promises.deleteDoc.called.should.equal(
          false
        )
      })

      it('should send the update to the doc updater', function () {
        const oldFiles = [{ file: this.entity, path: this.path }]
        this.DocumentUpdaterHandler.promises.updateProjectStructure.should.have.been.calledWith(
          projectId,
          projectHistoryId,
          userId,
          {
            oldFiles,
            oldDocs: [],
            newProject: this.newProject,
          },
          this.source
        )
      })

      it('should return a subtree listing containing only the file', function () {
        expect(this.subtreeListing).to.deep.equal([
          { type: 'file', entity: this.entity, path: this.path },
        ])
      })
    })

    describe('a doc', function () {
      beforeEach(async function () {
        this.path = '/file/system/path.tex'
        this.ProjectEntityUpdateHandler._cleanUpDoc = sinon.stub().resolves()
        this.entity = { _id: this.entityId }
        this.newProject = 'new-project'
        this.subtreeListing =
          await this.ProjectEntityUpdateHandler._cleanUpEntity(
            this.project,
            this.newProject,
            this.entity,
            'doc',
            this.path,
            userId,
            this.source
          )
      })

      it('should clean up the doc', function () {
        this.ProjectEntityUpdateHandler._cleanUpDoc
          .calledWith(this.project, this.entity, this.path, userId)
          .should.equal(true)
      })

      it('should send the update to the doc updater', function () {
        const oldDocs = [{ doc: this.entity, path: this.path }]
        this.DocumentUpdaterHandler.promises.updateProjectStructure.should.have.been.calledWith(
          projectId,
          projectHistoryId,
          userId,
          {
            oldDocs,
            oldFiles: [],
            newProject: this.newProject,
          },
          this.source
        )
      })

      it('should return a subtree listing containing only the doc', function () {
        expect(this.subtreeListing).to.deep.equal([
          { type: 'doc', entity: this.entity, path: this.path },
        ])
      })
    })

    describe('a folder', function () {
      beforeEach(async function () {
        this.folder = {
          folders: [
            {
              name: 'subfolder',
              fileRefs: [
                (this.file1 = { _id: 'file-id-1', name: 'file-name-1' }),
              ],
              docs: [(this.doc1 = { _id: 'doc-id-1', name: 'doc-name-1' })],
              folders: [],
            },
          ],
          fileRefs: [(this.file2 = { _id: 'file-id-2', name: 'file-name-2' })],
          docs: [(this.doc2 = { _id: 'doc-id-2', name: 'doc-name-2' })],
        }

        this.ProjectEntityUpdateHandler._cleanUpDoc = sinon.stub().resolves()
        this.ProjectEntityUpdateHandler._cleanUpFile = sinon.stub().resolves()
        const path = '/folder'
        this.newProject = 'new-project'
        this.subtreeListing =
          await this.ProjectEntityUpdateHandler._cleanUpEntity(
            this.project,
            this.newProject,
            this.folder,
            'folder',
            path,
            userId,
            this.source
          )
      })

      it('should clean up all sub files', function () {
        this.ProjectEntityUpdateHandler._cleanUpFile.should.have.been.calledWith(
          this.project,
          this.file1
        )
        this.ProjectEntityUpdateHandler._cleanUpFile.should.have.been.calledWith(
          this.project,
          this.file2
        )
      })

      it('should clean up all sub docs', function () {
        this.ProjectEntityUpdateHandler._cleanUpDoc
          .calledWith(
            this.project,
            this.doc1,
            '/folder/subfolder/doc-name-1',
            userId
          )
          .should.equal(true)
        this.ProjectEntityUpdateHandler._cleanUpDoc
          .calledWith(this.project, this.doc2, '/folder/doc-name-2', userId)
          .should.equal(true)
      })

      it('should should send one update to the doc updater for all docs and files', function () {
        const oldFiles = [
          { file: this.file2, path: '/folder/file-name-2' },
          { file: this.file1, path: '/folder/subfolder/file-name-1' },
        ]
        const oldDocs = [
          { doc: this.doc2, path: '/folder/doc-name-2' },
          { doc: this.doc1, path: '/folder/subfolder/doc-name-1' },
        ]
        this.DocumentUpdaterHandler.promises.updateProjectStructure
          .calledWith(
            projectId,
            projectHistoryId,
            userId,
            {
              oldFiles,
              oldDocs,
              newProject: this.newProject,
            },
            this.source
          )
          .should.equal(true)
      })

      it('should return a subtree listing containing all sub-entities', function () {
        expect(this.subtreeListing).to.have.deep.members([
          { type: 'folder', entity: this.folder, path: '/folder' },
          {
            type: 'folder',
            entity: this.folder.folders[0],
            path: '/folder/subfolder',
          },
          {
            type: 'file',
            entity: this.file1,
            path: '/folder/subfolder/file-name-1',
          },
          {
            type: 'doc',
            entity: this.doc1,
            path: '/folder/subfolder/doc-name-1',
          },
          { type: 'file', entity: this.file2, path: '/folder/file-name-2' },
          { type: 'doc', entity: this.doc2, path: '/folder/doc-name-2' },
        ])
      })
    })
  })

  describe('_cleanUpDoc', function () {
    beforeEach(function () {
      this.doc = {
        _id: new ObjectId(),
        name: 'test.tex',
      }
      this.path = '/path/to/doc'
      this.ProjectEntityUpdateHandler.promises.unsetRootDoc = sinon
        .stub()
        .resolves()
      this.DocstoreManager.promises.deleteDoc.resolves()
    })

    describe('when the doc is the root doc', function () {
      beforeEach(async function () {
        this.project.rootDoc_id = this.doc._id
        await this.ProjectEntityUpdateHandler._cleanUpDoc(
          this.project,
          this.doc,
          this.path,
          userId
        )
      })

      it('should unset the root doc', function () {
        this.ProjectEntityUpdateHandler.promises.unsetRootDoc.should.have.been.calledWith(
          projectId
        )
      })

      it('should delete the doc in the doc updater', function () {
        this.DocumentUpdaterHandler.promises.deleteDoc
          .calledWith(projectId, this.doc._id.toString())
          .should.equal(true)
      })

      it('should delete the doc in the doc store', function () {
        this.DocstoreManager.promises.deleteDoc
          .calledWith(projectId, this.doc._id.toString(), 'test.tex')
          .should.equal(true)
      })
    })

    describe('when the doc is not the root doc', function () {
      beforeEach(async function () {
        this.project.rootDoc_id = new ObjectId()
        await this.ProjectEntityUpdateHandler._cleanUpDoc(
          this.project,
          this.doc,
          this.path,
          userId
        )
      })

      it('should not unset the root doc', function () {
        this.ProjectEntityUpdateHandler.promises.unsetRootDoc.called.should.equal(
          false
        )
      })
    })
  })

  describe('convertDocToFile', function () {
    beforeEach(function () {
      this.docPath = '/folder/doc.tex'
      this.docLines = ['line one', 'line two']
      this.tmpFilePath = '/tmp/file'
      this.fileStoreUrl = 'http://filestore/file'
      this.folder = { _id: new ObjectId() }
      this.rev = 3
      this.ProjectLocator.promises.findElement
        .withArgs({
          project_id: this.project._id,
          element_id: this.doc._id,
          type: 'doc',
        })
        .resolves({
          element: this.doc,
          path: { fileSystem: this.path },
          folder: this.folder,
        })
      this.ProjectLocator.promises.findElement
        .withArgs({
          project_id: this.project._id.toString(),
          element_id: this.file._id,
          type: 'file',
        })
        .resolves({
          element: this.file,
          path: this.docPath,
          folder: this.folder,
        })
      this.DocstoreManager.promises.getDoc
        .withArgs(this.project._id, this.doc._id)
        .resolves({ lines: this.docLines, rev: this.rev })
      this.FileWriter.promises.writeLinesToDisk.resolves(this.tmpFilePath)
      this.FileStoreHandler.promises.uploadFileFromDisk.resolves({
        url: this.fileStoreUrl,
        fileRef: this.file,
        createdBlob: true,
      })
      this.ProjectEntityMongoUpdateHandler.promises.replaceDocWithFile.resolves(
        this.project
      )
    })

    describe('successfully', function () {
      beforeEach(function (done) {
        this.ProjectEntityUpdateHandler.convertDocToFile(
          this.project._id,
          this.doc._id,
          this.user._id,
          this.source,
          done
        )
      })

      it('deletes the document in doc updater', function () {
        expect(
          this.DocumentUpdaterHandler.promises.deleteDoc
        ).to.have.been.calledWith(this.project._id, this.doc._id)
      })

      it('uploads the file to filestore', function () {
        expect(
          this.FileStoreHandler.promises.uploadFileFromDisk
        ).to.have.been.calledWith(
          this.project._id,
          { name: this.doc.name, rev: this.rev + 1 },
          this.tmpFilePath
        )
      })

      it('cleans up the temporary file', function () {
        expect(this.fs.promises.unlink).to.have.been.calledWith(
          this.tmpFilePath
        )
      })

      it('replaces the doc with the file', function () {
        expect(
          this.ProjectEntityMongoUpdateHandler.promises.replaceDocWithFile
        ).to.have.been.calledWith(this.project._id, this.doc._id, this.file)
      })

      it('notifies document updater of changes', function () {
        expect(
          this.DocumentUpdaterHandler.promises.updateProjectStructure
        ).to.have.been.calledWith(
          this.project._id,
          this.project.overleaf.history.id,
          this.user._id,
          {
            oldDocs: [{ doc: this.doc, path: this.path }],
            newFiles: [
              {
                file: this.file,
                path: this.path,
                url: this.fileStoreUrl,
                createdBlob: true,
              },
            ],
            newProject: this.project,
          },
          this.source
        )
      })

      it('should notify real-time of the doc deletion', function () {
        expect(
          this.EditorRealTimeController.emitToRoom
        ).to.have.been.calledWith(
          this.project._id,
          'removeEntity',
          this.doc._id,
          'convertDocToFile'
        )
      })

      it('should notify real-time of the file creation', function () {
        expect(
          this.EditorRealTimeController.emitToRoom
        ).to.have.been.calledWith(
          this.project._id,
          'reciveNewFile',
          this.folder._id,
          this.file,
          'convertDocToFile',
          null
        )
      })
    })

    describe('when the doc has ranges', function () {
      it('should throw a DocHasRangesError', function (done) {
        this.ranges = { comments: [{ id: 123 }] }
        this.DocstoreManager.promises.getDoc
          .withArgs(this.project._id, this.doc._id)
          .resolves({
            lines: this.docLines,
            rev: 'rev',
            version: 'version',
            ranges: this.ranges,
          })
        this.ProjectEntityUpdateHandler.convertDocToFile(
          this.project._id,
          this.doc._id,
          this.user._id,
          this.source,
          err => {
            expect(err).to.be.instanceof(Errors.DocHasRangesError)
            done()
          }
        )
      })
    })
  })

  describe('isPathValidForMainBibliographyDoc', function () {
    it('should not allow other endings than .bib', function () {
      const endings = ['.tex', '.png', '.jpg', '.pdf', '.docx', '.doc']
      endings.forEach(ending => {
        expect(
          this.ProjectEntityUpdateHandler.isPathValidForMainBibliographyDoc(
            `/foo/bar/baz${ending}`
          )
        ).to.be.false
      })
    })

    it('should allow a mix of lower and uppercase letters', function () {
      const endings = ['.bib', '.BiB', '.BIB', '.bIB']
      endings.forEach(ending => {
        expect(
          this.ProjectEntityUpdateHandler.isPathValidForMainBibliographyDoc(
            `/foo/bar/baz.${ending}`
          )
        ).to.be.true
      })
    })

    it('should not allow a path without an extension', function () {
      expect(
        this.ProjectEntityUpdateHandler.isPathValidForMainBibliographyDoc(
          '/foo/bar/baz'
        )
      ).to.be.false
    })

    it('should not allow the empty path', function () {
      expect(
        this.ProjectEntityUpdateHandler.isPathValidForMainBibliographyDoc('')
      ).to.be.false
    })
  })

  describe('setMainBibliographyDoc', function () {
    describe('on success', function () {
      beforeEach(function (done) {
        this.doc = {
          _id: new ObjectId(),
          name: 'test.bib',
        }
        this.path = '/path/to/test.bib'
        this.ProjectEntityHandler.promises.getDocPathByProjectIdAndDocId
          .withArgs(this.project._id, this.doc._id)
          .resolves(this.path)

        this.callback = sinon.stub().callsFake(() => done())

        this.ProjectEntityUpdateHandler.setMainBibliographyDoc(
          this.project._id,
          this.doc._id,
          this.callback
        )
      })

      it('should update the project with the new main bibliography doc', function () {
        expect(this.ProjectModel.updateOne).to.have.been.calledWith(
          { _id: this.project._id },
          { mainBibliographyDoc_id: this.doc._id }
        )
      })
    })

    describe('on failure', function () {
      describe("when document can't be found", function () {
        beforeEach(function (done) {
          this.doc = {
            _id: new ObjectId(),
            name: 'test.bib',
          }
          this.ProjectEntityHandler.promises.getDocPathByProjectIdAndDocId
            .withArgs(this.project._id, this.doc._id)
            .rejects(new Error('error'))

          this.callback = sinon.stub().callsFake(() => done())

          this.ProjectEntityUpdateHandler.setMainBibliographyDoc(
            this.project._id,
            this.doc._id,
            this.callback
          )
        })

        it('should call the callback with an error', function () {
          expect(this.callback).to.have.been.calledWith(
            sinon.match.instanceOf(Error)
          )
        })

        it('should not update the project with the new main bibliography doc', function () {
          expect(this.ProjectModel.updateOne).to.not.have.been.called
        })
      })

      describe("when path is not a bib file can't be found", function () {
        beforeEach(function (done) {
          this.doc = {
            _id: new ObjectId(),
            name: 'test.bib',
          }

          this.path = '/path/to/test.tex'
          this.ProjectEntityHandler.promises.getDocPathByProjectIdAndDocId
            .withArgs(this.project._id, this.doc._id)
            .resolves(this.path)

          this.callback = sinon.stub().callsFake(() => done())

          this.ProjectEntityUpdateHandler.setMainBibliographyDoc(
            this.project._id,
            this.doc._id,
            this.callback
          )
        })

        it('should call the callback with an error', function () {
          expect(this.callback).to.have.been.calledWith(
            sinon.match.instanceOf(Error)
          )
        })

        it('should not update the project with the new main bibliography doc', function () {
          expect(this.ProjectModel.updateOne).to.not.have.been.called
        })
      })
    })
  })

  describe('appendToDoc', function () {
    describe('when document cannot be found', function () {
      beforeEach(function (done) {
        this.appendedLines = ['5678', 'def']
        this.DocumentUpdaterHandler.promises.appendToDocument = sinon.stub()
        this.ProjectLocator.promises.findElement = sinon.stub()
        this.ProjectLocator.promises.findElement
          .withArgs({ project_id: projectId, element_id: docId, type: 'doc' })
          .rejects(new Errors.NotFoundError())
        this.ProjectEntityUpdateHandler.appendToDoc(
          projectId,
          docId,
          this.appendedLines,
          this.source,
          userId,
          (...args) => {
            this.callback(...args)
            done()
          }
        )
      })

      it('should not talk to DocumentUpdaterHandler', function () {
        this.DocumentUpdaterHandler.promises.appendToDocument.should.not.have
          .been.called
      })

      it('should throw the error', function () {
        this.callback.should.have.been.calledWith(
          sinon.match.instanceOf(Errors.NotFoundError)
        )
      })
    })

    describe('when document is found', function () {
      beforeEach(function (done) {
        this.appendedLines = ['5678', 'def']
        this.DocumentUpdaterHandler.promises.appendToDocument = sinon.stub()
        this.DocumentUpdaterHandler.promises.appendToDocument
          .withArgs(projectId, docId, userId, this.appendedLines, this.source)
          .resolves({ rev: 1 })
        this.ProjectLocator.promises.findElement = sinon.stub()
        this.ProjectLocator.promises.findElement
          .withArgs({ project_id: projectId, element_id: docId, type: 'doc' })
          .resolves({ element: { _id: docId } })
        this.ProjectEntityUpdateHandler.appendToDoc(
          projectId,
          docId,
          this.appendedLines,
          this.source,
          userId,
          (...args) => {
            this.callback(...args)
            done()
          }
        )
      })

      it('should forward call to DocumentUpdaterHandler.appendToDocument', function () {
        this.DocumentUpdaterHandler.promises.appendToDocument.should.have.been.calledWith(
          projectId,
          docId,
          userId,
          this.appendedLines,
          this.source
        )
      })

      it('should return the response from DocumentUpdaterHandler', function () {
        this.callback.should.have.been.calledWith(null, { rev: 1 })
      })
    })

    describe('when DocumentUpdater throws an error', function () {
      beforeEach(function (done) {
        this.appendedLines = ['5678', 'def']
        this.DocumentUpdaterHandler.promises.appendToDocument = sinon.stub()
        this.DocumentUpdaterHandler.promises.appendToDocument.rejects(
          new Error()
        )
        this.ProjectLocator.promises.findElement = sinon.stub()
        this.ProjectLocator.promises.findElement
          .withArgs({ project_id: projectId, element_id: docId, type: 'doc' })
          .resolves({ element: { _id: docId } })
        this.ProjectEntityUpdateHandler.appendToDoc(
          projectId,
          docId,
          this.appendedLines,
          this.source,
          userId,
          (...args) => {
            this.callback(...args)
            done()
          }
        )
      })

      it('should return the response from DocumentUpdaterHandler', function () {
        this.callback.should.have.been.calledWith(sinon.match.instanceOf(Error))
      })
    })
  })
})
