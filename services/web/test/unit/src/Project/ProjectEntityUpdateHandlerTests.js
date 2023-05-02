const { expect } = require('chai')
const sinon = require('sinon')
const Errors = require('../../../../app/src/Features/Errors/Errors')
const SandboxedModule = require('sandboxed-module')
const { ObjectId } = require('mongodb')

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
      getDoc: sinon.stub(),
      isDocDeleted: sinon.stub(),
      updateDoc: sinon.stub(),
      deleteDoc: sinon.stub(),
    }
    this.DocumentUpdaterHandler = {
      flushDocToMongo: sinon.stub().yields(),
      flushProjectToMongo: sinon.stub().yields(),
      updateProjectStructure: sinon.stub().yields(),
      setDocument: sinon.stub(),
      resyncProjectHistory: sinon.stub().yields(),
      deleteDoc: sinon.stub().yields(),
    }
    this.fs = {
      unlink: sinon.stub().yields(),
    }
    this.LockManager = {
      runWithLock: sinon.spy((namespace, id, runner, callback) =>
        runner(callback)
      ),
      withTimeout: sinon.stub().returns(this.LockManager),
    }
    this.ProjectModel = {
      updateOne: sinon.stub(),
    }
    this.ProjectGetter = {
      getProject: sinon.stub(),
      getProjectWithoutDocLines: sinon.stub(),
    }
    this.ProjectLocator = {
      findElement: sinon.stub(),
      findElementByPath: sinon.stub(),
    }
    this.ProjectUpdater = {
      markAsUpdated: sinon.stub(),
    }
    this.ProjectEntityHandler = {
      getDoc: sinon.stub(),
      getDocPathByProjectIdAndDocId: sinon.stub(),
      getAllEntitiesFromProject: sinon.stub(),
    }
    this.ProjectEntityMongoUpdateHandler = {
      addDoc: sinon.stub(),
      addFile: sinon.stub(),
      addFolder: sinon.stub(),
      _confirmFolder: sinon.stub(),
      _putElement: sinon.stub(),
      _insertDeletedFileReference: sinon.stub(),
      replaceFileWithNew: sinon.stub(),
      mkdirp: sinon.stub(),
      moveEntity: sinon.stub(),
      renameEntity: sinon.stub().yields(),
      deleteEntity: sinon.stub(),
      replaceDocWithFile: sinon.stub(),
      replaceFileWithDoc: sinon.stub(),
    }
    this.TpdsUpdateSender = {
      addFile: sinon.stub().yields(),
      addDoc: sinon.stub(),
      deleteEntity: sinon.stub().yields(),
      moveEntity: sinon.stub().yields(),
    }
    this.FileStoreHandler = {
      copyFile: sinon.stub(),
      uploadFileFromDisk: sinon.stub(),
      deleteFile: sinon.stub(),
      _buildUrl: sinon
        .stub()
        .callsFake(
          (projectId, fileId) => `www.filestore.test/${projectId}/${fileId}`
        ),
    }
    this.FileWriter = {
      writeLinesToDisk: sinon.stub(),
    }
    this.EditorRealTimeController = {
      emitToRoom: sinon.stub(),
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
      this.parentFolder = { _id: ObjectId() }
      this.DocstoreManager.isDocDeleted.yields(null, false)
      this.ProjectGetter.getProject.yields(null, this.project)
      this.ProjectLocator.findElement.yields(
        null,
        this.doc,
        {
          fileSystem: this.path,
        },
        this.parentFolder
      )
      this.TpdsUpdateSender.addDoc.yields()
    })

    describe('when the doc has been modified', function () {
      beforeEach(function () {
        this.DocstoreManager.updateDoc.yields(null, true, (this.rev = 5))
        this.ProjectEntityUpdateHandler.updateDocLines(
          projectId,
          docId,
          this.docLines,
          this.version,
          this.ranges,
          this.lastUpdatedAt,
          this.lastUpdatedBy,
          this.callback
        )
      })

      it('should get the project with very few fields', function () {
        this.ProjectGetter.getProject
          .calledWith(projectId, {
            name: true,
            rootFolder: true,
          })
          .should.equal(true)
      })

      it('should find the doc', function () {
        this.ProjectLocator.findElement
          .calledWith({
            project: this.project,
            type: 'docs',
            element_id: docId,
          })
          .should.equal(true)
      })

      it('should update the doc in the docstore', function () {
        this.DocstoreManager.updateDoc
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
          this.ProjectUpdater.markAsUpdated,
          projectId,
          this.lastUpdatedAt,
          this.lastUpdatedBy
        )
      })

      it('should send the doc the to the TPDS', function () {
        this.TpdsUpdateSender.addDoc.should.have.been.calledWith({
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
      beforeEach(function () {
        this.DocstoreManager.updateDoc.yields(null, false, (this.rev = 5))
        this.ProjectEntityUpdateHandler.updateDocLines(
          projectId,
          docId,
          this.docLines,
          this.version,
          this.ranges,
          this.lastUpdatedAt,
          this.lastUpdatedBy,
          this.callback
        )
      })

      it('should not mark the project as updated', function () {
        this.ProjectUpdater.markAsUpdated.called.should.equal(false)
      })

      it('should not send the doc the to the TPDS', function () {
        this.TpdsUpdateSender.addDoc.called.should.equal(false)
      })

      it('should call the callback', function () {
        this.callback.called.should.equal(true)
      })
    })

    describe('when the doc has been deleted', function () {
      beforeEach(function () {
        this.ProjectGetter.getProject.yields(null, this.project)
        this.ProjectLocator.findElement.yields(new Errors.NotFoundError())
        this.DocstoreManager.isDocDeleted.yields(null, true)
        this.DocstoreManager.updateDoc.yields()
        this.ProjectEntityUpdateHandler.updateDocLines(
          projectId,
          docId,
          this.docLines,
          this.version,
          this.ranges,
          this.lastUpdatedAt,
          this.lastUpdatedBy,
          this.callback
        )
      })

      it('should update the doc in the docstore', function () {
        this.DocstoreManager.updateDoc
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
        this.ProjectUpdater.markAsUpdated.called.should.equal(false)
      })

      it('should not send the doc the to the TPDS', function () {
        this.TpdsUpdateSender.addDoc.called.should.equal(false)
      })

      it('should call the callback', function () {
        this.callback.called.should.equal(true)
      })
    })

    describe('when projects and docs collection are de-synced', function () {
      beforeEach(function () {
        this.ProjectGetter.getProject.yields(null, this.project)

        // The doc is not in the file-tree, but also not marked as deleted.
        // This should not happen, but web should handle it.
        this.ProjectLocator.findElement.yields(new Errors.NotFoundError())
        this.DocstoreManager.isDocDeleted.yields(null, false)

        this.DocstoreManager.updateDoc.yields()
        this.ProjectEntityUpdateHandler.updateDocLines(
          projectId,
          docId,
          this.docLines,
          this.version,
          this.ranges,
          this.lastUpdatedAt,
          this.lastUpdatedBy,
          this.callback
        )
      })

      it('should update the doc in the docstore', function () {
        this.DocstoreManager.updateDoc
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
        this.ProjectUpdater.markAsUpdated.called.should.equal(false)
      })

      it('should not send the doc the to the TPDS', function () {
        this.TpdsUpdateSender.addDoc.called.should.equal(false)
      })

      it('should call the callback', function () {
        this.callback.called.should.equal(true)
      })
    })

    describe('when the doc is not related to the project', function () {
      beforeEach(function () {
        this.ProjectGetter.getProject.yields(null, this.project)
        this.ProjectLocator.findElement.yields(new Errors.NotFoundError())
        this.DocstoreManager.isDocDeleted.yields(new Errors.NotFoundError())
        this.ProjectEntityUpdateHandler.updateDocLines(
          projectId,
          docId,
          this.docLines,
          this.version,
          this.ranges,
          this.lastUpdatedAt,
          this.lastUpdatedBy,
          this.callback
        )
      })

      it('should return a not found error', function () {
        this.callback
          .calledWith(sinon.match.instanceOf(Errors.NotFoundError))
          .should.equal(true)
      })

      it('should not update the doc', function () {
        this.DocstoreManager.updateDoc.called.should.equal(false)
      })

      it('should not send the doc the to the TPDS', function () {
        this.TpdsUpdateSender.addDoc.called.should.equal(false)
      })
    })

    describe('when the project is not found', function () {
      beforeEach(function () {
        this.ProjectGetter.getProject.yields(new Errors.NotFoundError())
        this.ProjectEntityUpdateHandler.updateDocLines(
          projectId,
          docId,
          this.docLines,
          this.version,
          this.ranges,
          this.lastUpdatedAt,
          this.lastUpdatedBy,
          this.callback
        )
      })

      it('should return a not found error', function () {
        this.callback
          .calledWith(sinon.match.instanceOf(Errors.NotFoundError))
          .should.equal(true)
      })

      it('should not update the doc', function () {
        this.DocstoreManager.updateDoc.called.should.equal(false)
      })

      it('should not send the doc the to the TPDS', function () {
        this.TpdsUpdateSender.addDoc.called.should.equal(false)
      })
    })
  })

  describe('setRootDoc', function () {
    beforeEach(function () {
      this.rootDocId = 'root-doc-id-123123'
    })

    it('should call Project.updateOne when the doc exists and has a valid extension', function () {
      this.ProjectEntityHandler.getDocPathByProjectIdAndDocId.yields(
        null,
        `/main.tex`
      )

      this.ProjectEntityUpdateHandler.setRootDoc(
        projectId,
        this.rootDocId,
        () => {}
      )
      this.ProjectModel.updateOne
        .calledWith({ _id: projectId }, { rootDoc_id: this.rootDocId })
        .should.equal(true)
    })

    it("should not call Project.updateOne when the doc doesn't exist", function () {
      this.ProjectEntityHandler.getDocPathByProjectIdAndDocId.yields(
        Errors.NotFoundError
      )

      this.ProjectEntityUpdateHandler.setRootDoc(
        projectId,
        this.rootDocId,
        () => {}
      )
      this.ProjectModel.updateOne
        .calledWith({ _id: projectId }, { rootDoc_id: this.rootDocId })
        .should.equal(false)
    })

    it('should call the callback with an UnsupportedFileTypeError when the doc has an unaccepted file extension', function () {
      this.ProjectEntityHandler.getDocPathByProjectIdAndDocId.yields(
        null,
        `/foo/bar.baz`
      )

      this.ProjectEntityUpdateHandler.setRootDoc(
        projectId,
        this.rootDocId,
        this.callback
      )
      expect(this.callback.firstCall.args[0]).to.be.an.instanceof(
        Errors.UnsupportedFileTypeError
      )
    })
  })

  describe('unsetRootDoc', function () {
    it('should call Project.updateOne', function () {
      this.ProjectEntityUpdateHandler.unsetRootDoc(projectId)
      this.ProjectModel.updateOne
        .calledWith({ _id: projectId }, { $unset: { rootDoc_id: true } })
        .should.equal(true)
    })
  })

  describe('addDoc', function () {
    describe('adding a doc', function () {
      beforeEach(function () {
        this.path = '/path/to/doc'
        this.rev = 5

        this.newDoc = new this.DocModel({
          name: this.docName,
          lines: undefined,
          _id: docId,
          rev: this.rev,
        })
        this.DocstoreManager.updateDoc.yields(null, false, this.rev)
        this.TpdsUpdateSender.addDoc.yields()
        this.ProjectEntityMongoUpdateHandler.addDoc.yields(
          null,
          { path: { fileSystem: this.path } },
          this.project
        )
        this.ProjectEntityUpdateHandler.addDoc(
          projectId,
          docId,
          this.docName,
          this.docLines,
          userId,
          this.source,
          this.callback
        )
      })

      it('creates the doc without history', function () {
        this.DocstoreManager.updateDoc
          .calledWith(projectId, docId, this.docLines, 0, {})
          .should.equal(true)
      })

      it('sends the change in project structure to the doc updater', function () {
        const newDocs = [
          {
            doc: this.newDoc,
            path: this.path,
            docLines: this.docLines.join('\n'),
          },
        ]
        this.DocumentUpdaterHandler.updateProjectStructure.should.have.been.calledWith(
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
      beforeEach(function () {
        this.path = '/path/to/doc'

        this.newDoc = { _id: docId }
        this.ProjectEntityUpdateHandler.addDoc(
          projectId,
          folderId,
          `*${this.docName}`,
          this.docLines,
          userId,
          this.source,
          this.callback
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
      beforeEach(function () {
        this.path = '/path/to/file'

        this.newFile = {
          _id: fileId,
          rev: 0,
          name: this.fileName,
          linkedFileData: this.linkedFileData,
        }
        this.FileStoreHandler.uploadFileFromDisk.yields(
          null,
          this.fileUrl,
          this.newFile
        )
        this.TpdsUpdateSender.addFile.yields()
        this.ProjectEntityMongoUpdateHandler.addFile.yields(
          null,
          { path: { fileSystem: this.path } },
          this.project
        )
        this.ProjectEntityUpdateHandler.addFile(
          projectId,
          folderId,
          this.fileName,
          this.fileSystemPath,
          this.linkedFileData,
          userId,
          this.source,
          this.callback
        )
      })

      it('updates the file in the filestore', function () {
        this.FileStoreHandler.uploadFileFromDisk
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

        this.ProjectEntityMongoUpdateHandler.addFile
          .calledWithMatch(projectId, folderId, fileMatcher)
          .should.equal(true)
      })

      it('notifies the tpds', function () {
        this.TpdsUpdateSender.addFile
          .calledWith({
            projectId,
            projectName: this.project.name,
            fileId,
            rev: 0,
            path: this.path,
            folderId,
          })
          .should.equal(true)
      })

      it('should mark the project as updated', function () {
        const args = this.ProjectUpdater.markAsUpdated.args[0]
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
          },
        ]
        this.DocumentUpdaterHandler.updateProjectStructure
          .calledWith(
            projectId,
            projectHistoryId,
            userId,
            {
              newFiles,
              newProject: this.project,
            },
            this.source
          )
          .should.equal(true)
      })
    })

    describe('adding a file with an invalid name', function () {
      beforeEach(function () {
        this.path = '/path/to/file'

        this.newFile = {
          _id: fileId,
          rev: 0,
          name: this.fileName,
          linkedFileData: this.linkedFileData,
        }
        this.TpdsUpdateSender.addFile.yields()
        this.ProjectEntityMongoUpdateHandler.addFile.yields(
          null,
          { path: { fileSystem: this.path } },
          this.project
        )
        this.ProjectEntityUpdateHandler.addFile(
          projectId,
          folderId,
          `*${this.fileName}`,
          this.fileSystemPath,
          this.linkedFileData,
          userId,
          this.source,
          this.callback
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
      beforeEach(function () {
        this.ProjectLocator.findElement.yields()
        this.ProjectEntityUpdateHandler.upsertDoc(
          projectId,
          folderId,
          this.docName,
          this.docLines,
          this.source,
          userId,
          this.callback
        )
      })

      it('returns an error', function () {
        const errorMatcher = sinon.match.instanceOf(Error)
        this.callback.calledWithMatch(errorMatcher).should.equal(true)
      })
    })

    describe('updating an existing doc', function () {
      beforeEach(function () {
        this.existingDoc = { _id: docId, name: this.docName }
        this.existingFile = { _id: fileId, name: this.fileName }
        this.folder = {
          _id: folderId,
          docs: [this.existingDoc],
          fileRefs: [this.existingFile],
        }
        this.ProjectLocator.findElement.yields(null, this.folder)
        this.DocumentUpdaterHandler.setDocument.yields()

        this.ProjectEntityUpdateHandler.upsertDoc(
          projectId,
          folderId,
          this.docName,
          this.docLines,
          this.source,
          userId,
          this.callback
        )
      })

      it('tries to find the folder', function () {
        this.ProjectLocator.findElement
          .calledWith({
            project_id: projectId,
            element_id: folderId,
            type: 'folder',
          })
          .should.equal(true)
      })

      it('updates the doc contents', function () {
        this.DocumentUpdaterHandler.setDocument
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
      beforeEach(function () {
        this.folder = { _id: folderId, docs: [], fileRefs: [] }
        this.newDoc = { _id: docId }
        this.ProjectLocator.findElement.yields(null, this.folder)
        this.ProjectEntityUpdateHandler.addDocWithRanges = {
          withoutLock: sinon.stub().yields(null, this.newDoc),
        }

        this.ProjectEntityUpdateHandler.upsertDoc(
          projectId,
          folderId,
          this.docName,
          this.docLines,
          this.source,
          userId,
          this.callback
        )
      })

      it('tries to find the folder', function () {
        this.ProjectLocator.findElement
          .calledWith({
            project_id: projectId,
            element_id: folderId,
            type: 'folder',
          })
          .should.equal(true)
      })

      it('adds the doc', function () {
        this.ProjectEntityUpdateHandler.addDocWithRanges.withoutLock
          .calledWith(
            projectId,
            folderId,
            this.docName,
            this.docLines,
            {},
            userId,
            this.source
          )
          .should.equal(true)
      })

      it('returns the doc', function () {
        this.callback.calledWith(null, this.newDoc, true)
      })
    })

    describe('upserting a new doc with an invalid name', function () {
      beforeEach(function () {
        this.folder = { _id: folderId, docs: [], fileRefs: [] }
        this.newDoc = { _id: docId }
        this.ProjectLocator.findElement.yields(null, this.folder)
        this.ProjectEntityUpdateHandler.addDocWithRanges = {
          withoutLock: sinon.stub().yields(null, this.newDoc),
        }

        this.ProjectEntityUpdateHandler.upsertDoc(
          projectId,
          folderId,
          `*${this.docName}`,
          this.docLines,
          this.source,
          userId,
          this.callback
        )
      })

      it('returns an error', function () {
        const errorMatcher = sinon.match.instanceOf(Errors.InvalidNameError)
        this.callback.calledWithMatch(errorMatcher).should.equal(true)
      })
    })

    describe('upserting a doc on top of a file', function () {
      beforeEach(function () {
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
        this.ProjectLocator.findElement
          .withArgs({
            project_id: projectId,
            element_id: this.folder._id,
            type: 'folder',
          })
          .yields(null, this.folder, {
            fileSystem: this.folderPath,
          })
        this.DocstoreManager.updateDoc.yields()
        this.ProjectEntityMongoUpdateHandler.replaceFileWithDoc.yields(
          null,
          this.newProject
        )
        this.TpdsUpdateSender.addDoc.yields()

        this.ProjectEntityUpdateHandler.upsertDoc(
          projectId,
          folderId,
          'foo.tex',
          this.docLines,
          this.source,
          userId,
          this.callback
        )
      })

      it('notifies docstore of the new doc', function () {
        expect(this.DocstoreManager.updateDoc).to.have.been.calledWith(
          projectId,
          this.newDoc._id,
          this.docLines
        )
      })

      it('adds the new doc and removes the file in one go', function () {
        expect(
          this.ProjectEntityMongoUpdateHandler.replaceFileWithDoc
        ).to.have.been.calledWithMatch(
          projectId,
          this.existingFile._id,
          this.newDoc
        )
      })

      it('sends the doc to TPDS', function () {
        expect(this.TpdsUpdateSender.addDoc).to.have.been.calledWith({
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
          this.DocumentUpdaterHandler.updateProjectStructure
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
      this.FileStoreHandler.uploadFileFromDisk.yields(
        null,
        this.fileUrl,
        this.file
      )
    })

    describe('upserting into an invalid folder', function () {
      beforeEach(function () {
        this.ProjectLocator.findElement.yields()
        this.ProjectEntityUpdateHandler.upsertFile(
          projectId,
          folderId,
          this.fileName,
          this.fileSystemPath,
          this.linkedFileData,
          userId,
          this.source,
          this.callback
        )
      })

      it('returns an error', function () {
        const errorMatcher = sinon.match.instanceOf(Error)
        this.callback.calledWithMatch(errorMatcher).should.equal(true)
      })
    })

    describe('updating an existing file', function () {
      beforeEach(function () {
        this.existingFile = { _id: fileId, name: this.fileName, rev: 1 }
        this.newFile = { _id: ObjectId(), name: this.fileName, rev: 3 }
        this.folder = { _id: folderId, fileRefs: [this.existingFile], docs: [] }
        this.ProjectLocator.findElement.yields(null, this.folder)
        this.newProject = 'new-project-stub'
        this.ProjectEntityMongoUpdateHandler.replaceFileWithNew.yields(
          null,
          this.existingFile,
          this.project,
          { fileSystem: this.fileSystemPath },
          this.newProject,
          this.newFile
        )
        this.ProjectEntityUpdateHandler.upsertFile(
          projectId,
          folderId,
          this.fileName,
          this.fileSystemPath,
          this.linkedFileData,
          userId,
          this.source,
          this.callback
        )
      })

      it('uploads a new version of the file', function () {
        this.FileStoreHandler.uploadFileFromDisk.should.have.been.calledWith(
          projectId,
          {
            name: this.fileName,
            linkedFileData: this.linkedFileData,
          },
          this.fileSystemPath
        )
      })

      it('replaces the file in mongo', function () {
        this.ProjectEntityMongoUpdateHandler.replaceFileWithNew.should.have.been.calledWith(
          projectId,
          this.existingFile._id,
          this.file
        )
      })

      it('notifies the tpds', function () {
        this.TpdsUpdateSender.addFile.should.have.been.calledWith({
          projectId,
          projectName: this.project.name,
          fileId: this.newFile._id,
          rev: this.newFile.rev,
          path: this.fileSystemPath,
          folderId,
        })
      })

      it('should mark the project as updated', function () {
        const args = this.ProjectUpdater.markAsUpdated.args[0]
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
          },
        ]
        this.DocumentUpdaterHandler.updateProjectStructure.should.have.been.calledWith(
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
      beforeEach(function () {
        this.folder = { _id: folderId, fileRefs: [], docs: [] }
        this.newFile = { _id: fileId }
        this.ProjectLocator.findElement.yields(null, this.folder)
        this.FileStoreHandler.uploadFileFromDisk.yields(
          null,
          this.fileUrl,
          this.newFile
        )
        this.ProjectEntityUpdateHandler.addFile = {
          mainTask: sinon.stub().yields(null, this.newFile),
        }

        this.ProjectEntityUpdateHandler.upsertFile(
          projectId,
          folderId,
          this.fileName,
          this.fileSystemPath,
          this.linkedFileData,
          userId,
          this.source,
          this.callback
        )
      })

      it('tries to find the folder', function () {
        this.ProjectLocator.findElement
          .calledWith({
            project_id: projectId,
            element_id: folderId,
            type: 'folder',
          })
          .should.equal(true)
      })

      it('adds the file', function () {
        expect(
          this.ProjectEntityUpdateHandler.addFile.mainTask
        ).to.have.been.calledWith(
          projectId,
          folderId,
          this.fileName,
          this.fileSystemPath,
          this.linkedFileData,
          userId,
          this.newFile,
          this.fileUrl,
          this.source
        )
      })

      it('returns the file', function () {
        this.callback.calledWith(null, this.newFile, true)
      })
    })

    describe('upserting a new file with an invalid name', function () {
      beforeEach(function () {
        this.folder = { _id: folderId, fileRefs: [] }
        this.newFile = { _id: fileId }
        this.ProjectLocator.findElement.yields(null, this.folder)
        this.ProjectEntityUpdateHandler.addFile = {
          mainTask: sinon.stub().yields(null, this.newFile),
        }

        this.ProjectEntityUpdateHandler.upsertFile(
          projectId,
          folderId,
          `*${this.fileName}`,
          this.fileSystemPath,
          this.linkedFileData,
          userId,
          this.source,
          this.callback
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
        this.ProjectLocator.findElement
          .withArgs({
            project_id: this.project._id.toString(),
            element_id: folderId,
            type: 'folder',
          })
          .yields(null, this.folder)
        this.ProjectLocator.findElement
          .withArgs({
            project_id: this.project._id.toString(),
            element_id: this.existingDoc._id,
            type: 'doc',
          })
          .yields(
            null,
            this.existingDoc,
            { fileSystem: this.path },
            this.folder
          )

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
        this.FileStoreHandler.uploadFileFromDisk.yields(
          null,
          this.newFileUrl,
          this.newFile
        )
        this.ProjectEntityMongoUpdateHandler.replaceDocWithFile.yields(
          null,
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
          this.ProjectEntityMongoUpdateHandler.replaceDocWithFile
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
          },
        ]
        const updates = {
          oldDocs,
          newFiles,
          newProject: this.newProject,
        }
        expect(
          this.DocumentUpdaterHandler.updateProjectStructure
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
      beforeEach(function () {
        this.path = '/folder/doc.tex'
        this.newFolders = ['mock-a', 'mock-b']
        this.folder = { _id: folderId }
        this.doc = { _id: docId }
        this.isNewDoc = true
        this.ProjectEntityUpdateHandler.mkdirp = {
          withoutLock: sinon.stub().yields(null, this.newFolders, this.folder),
        }
        this.ProjectEntityUpdateHandler.upsertDoc = {
          withoutLock: sinon.stub().yields(null, this.doc, this.isNewDoc),
        }

        this.ProjectEntityUpdateHandler.upsertDocWithPath(
          projectId,
          this.path,
          this.docLines,
          this.source,
          userId,
          this.callback
        )
      })

      it('creates any necessary folders', function () {
        this.ProjectEntityUpdateHandler.mkdirp.withoutLock
          .calledWith(projectId, '/folder')
          .should.equal(true)
      })

      it('upserts the doc', function () {
        this.ProjectEntityUpdateHandler.upsertDoc.withoutLock
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
      beforeEach(function () {
        this.path = '/*folder/doc.tex'
        this.newFolders = ['mock-a', 'mock-b']
        this.folder = { _id: folderId }
        this.doc = { _id: docId }
        this.isNewDoc = true
        this.ProjectEntityUpdateHandler.mkdirp = {
          withoutLock: sinon.stub().yields(null, this.newFolders, this.folder),
        }
        this.ProjectEntityUpdateHandler.upsertDoc = {
          withoutLock: sinon.stub().yields(null, this.doc, this.isNewDoc),
        }

        this.ProjectEntityUpdateHandler.upsertDocWithPath(
          projectId,
          this.path,
          this.docLines,
          this.source,
          userId,
          this.callback
        )
      })

      it('returns an error', function () {
        const errorMatcher = sinon.match.instanceOf(Errors.InvalidNameError)
        this.callback.calledWithMatch(errorMatcher).should.equal(true)
      })
    })

    describe('upserting a doc with an invalid name', function () {
      beforeEach(function () {
        this.path = '/folder/*doc.tex'
        this.newFolders = ['mock-a', 'mock-b']
        this.folder = { _id: folderId }
        this.doc = { _id: docId }
        this.isNewDoc = true
        this.ProjectEntityUpdateHandler.mkdirp = {
          withoutLock: sinon.stub().yields(null, this.newFolders, this.folder),
        }
        this.ProjectEntityUpdateHandler.upsertDoc = {
          withoutLock: sinon.stub().yields(null, this.doc, this.isNewDoc),
        }

        this.ProjectEntityUpdateHandler.upsertDocWithPath(
          projectId,
          this.path,
          this.docLines,
          this.source,
          userId,
          this.callback
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
      beforeEach(function () {
        this.path = '/folder/file.png'
        this.newFolders = ['mock-a', 'mock-b']
        this.folder = { _id: folderId }
        this.file = { _id: fileId }
        this.isNewFile = true
        this.FileStoreHandler.uploadFileFromDisk.yields(
          null,
          this.fileUrl,
          this.newFile
        )
        this.ProjectEntityUpdateHandler.mkdirp = {
          withoutLock: sinon.stub().yields(null, this.newFolders, this.folder),
        }
        this.ProjectEntityUpdateHandler.upsertFile = {
          mainTask: sinon.stub().yields(null, this.file, this.isNewFile),
        }

        this.ProjectEntityUpdateHandler.upsertFileWithPath(
          projectId,
          this.path,
          this.fileSystemPath,
          this.linkedFileData,
          userId,
          this.source,
          this.callback
        )
      })

      it('creates any necessary folders', function () {
        this.ProjectEntityUpdateHandler.mkdirp.withoutLock
          .calledWith(projectId, '/folder')
          .should.equal(true)
      })

      it('upserts the file', function () {
        this.ProjectEntityUpdateHandler.upsertFile.mainTask
          .calledWith(
            projectId,
            this.folder._id,
            'file.png',
            this.fileSystemPath,
            this.linkedFileData,
            userId,
            this.newFile,
            this.fileUrl,
            this.source
          )
          .should.equal(true)
      })

      it('calls the callback', function () {
        this.callback
          .calledWith(
            null,
            this.file,
            this.isNewFile,
            undefined,
            this.newFolders,
            this.folder
          )
          .should.equal(true)
      })
    })

    describe('upserting a file with an invalid path', function () {
      beforeEach(function () {
        this.path = '/*folder/file.png'
        this.newFolders = ['mock-a', 'mock-b']
        this.folder = { _id: folderId }
        this.file = { _id: fileId }
        this.isNewFile = true
        this.ProjectEntityUpdateHandler.mkdirp = {
          withoutLock: sinon.stub().yields(null, this.newFolders, this.folder),
        }
        this.ProjectEntityUpdateHandler.upsertFile = {
          mainTask: sinon.stub().yields(null, this.file, this.isNewFile),
        }

        this.ProjectEntityUpdateHandler.upsertFileWithPath(
          projectId,
          this.path,
          this.fileSystemPath,
          this.linkedFileData,
          userId,
          this.source,
          this.callback
        )
      })

      it('returns an error', function () {
        const errorMatcher = sinon.match.instanceOf(Errors.InvalidNameError)
        this.callback.calledWithMatch(errorMatcher).should.equal(true)
      })
    })

    describe('upserting a file with an invalid name', function () {
      beforeEach(function () {
        this.path = '/folder/*file.png'
        this.newFolders = ['mock-a', 'mock-b']
        this.folder = { _id: folderId }
        this.file = { _id: fileId }
        this.isNewFile = true
        this.ProjectEntityUpdateHandler.mkdirp = {
          withoutLock: sinon.stub().yields(null, this.newFolders, this.folder),
        }
        this.ProjectEntityUpdateHandler.upsertFile = {
          mainTask: sinon.stub().yields(null, this.file, this.isNewFile),
        }

        this.ProjectEntityUpdateHandler.upsertFileWithPath(
          projectId,
          this.path,
          this.fileSystemPath,
          this.linkedFileData,
          userId,
          this.source,
          this.callback
        )
      })

      it('returns an error', function () {
        const errorMatcher = sinon.match.instanceOf(Errors.InvalidNameError)
        this.callback.calledWithMatch(errorMatcher).should.equal(true)
      })
    })
  })

  describe('deleteEntity', function () {
    beforeEach(function () {
      this.path = '/path/to/doc.tex'
      this.doc = { _id: docId }
      this.projectBeforeDeletion = { _id: projectId, name: 'project' }
      this.newProject = 'new-project'
      this.ProjectEntityMongoUpdateHandler.deleteEntity.yields(
        null,
        this.doc,
        { fileSystem: this.path },
        this.projectBeforeDeletion,
        this.newProject
      )
      this.ProjectEntityUpdateHandler._cleanUpEntity = sinon
        .stub()
        .yields(null, [{ type: 'doc', entity: this.doc, path: this.path }])

      this.ProjectEntityUpdateHandler.deleteEntity(
        projectId,
        docId,
        'doc',
        userId,
        this.source,
        this.callback
      )
    })

    it('deletes the entity in mongo', function () {
      this.ProjectEntityMongoUpdateHandler.deleteEntity
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
      this.TpdsUpdateSender.deleteEntity.should.have.been.calledWith({
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
      beforeEach(function () {
        this.doc = { _id: docId }
        this.ProjectLocator.findElementByPath.yields(null, this.doc, 'doc')
        this.ProjectEntityUpdateHandler.deleteEntity = {
          withoutLock: sinon.stub().yields(),
        }
        this.path = '/path/to/doc.tex'
        this.ProjectEntityUpdateHandler.deleteEntityWithPath(
          projectId,
          this.path,
          userId,
          this.source,
          this.callback
        )
      })

      it('finds the entity', function () {
        this.ProjectLocator.findElementByPath
          .calledWith({
            project_id: projectId,
            path: this.path,
            exactCaseMatch: true,
          })
          .should.equal(true)
      })

      it('deletes the entity', function () {
        this.ProjectEntityUpdateHandler.deleteEntity.withoutLock
          .calledWith(
            projectId,
            this.doc._id,
            'doc',
            userId,
            this.source,
            this.callback
          )
          .should.equal(true)
      })
    })

    describe('when the entity does not exist', function () {
      beforeEach(function () {
        this.ProjectLocator.findElementByPath.yields()
        this.path = '/doc.tex'
        this.ProjectEntityUpdateHandler.deleteEntityWithPath(
          projectId,
          this.path,
          userId,
          this.source,
          this.callback
        )
      })

      it('returns an error', function () {
        this.callback
          .calledWith(sinon.match.instanceOf(Errors.NotFoundError))
          .should.equal(true)
      })
    })
  })

  describe('mkdirp', function () {
    beforeEach(function () {
      this.docPath = '/folder/doc.tex'
      this.ProjectEntityMongoUpdateHandler.mkdirp.yields()
      this.ProjectEntityUpdateHandler.mkdirp(
        projectId,
        this.docPath,
        this.callback
      )
    })

    it('calls ProjectEntityMongoUpdateHandler', function () {
      this.ProjectEntityMongoUpdateHandler.mkdirp
        .calledWith(projectId, this.docPath)
        .should.equal(true)
    })
  })

  describe('mkdirpWithExactCase', function () {
    beforeEach(function () {
      this.docPath = '/folder/doc.tex'
      this.ProjectEntityMongoUpdateHandler.mkdirp.yields()
      this.ProjectEntityUpdateHandler.mkdirpWithExactCase(
        projectId,
        this.docPath,
        this.callback
      )
    })

    it('calls ProjectEntityMongoUpdateHandler', function () {
      this.ProjectEntityMongoUpdateHandler.mkdirp
        .calledWith(projectId, this.docPath, { exactCaseMatch: true })
        .should.equal(true)
    })
  })

  describe('addFolder', function () {
    describe('adding a folder', function () {
      beforeEach(function () {
        this.parentFolderId = '123asdf'
        this.folderName = 'new-folder'
        this.ProjectEntityMongoUpdateHandler.addFolder.yields()
        this.ProjectEntityUpdateHandler.addFolder(
          projectId,
          this.parentFolderId,
          this.folderName,
          this.callback
        )
      })

      it('calls ProjectEntityMongoUpdateHandler', function () {
        this.ProjectEntityMongoUpdateHandler.addFolder
          .calledWith(projectId, this.parentFolderId, this.folderName)
          .should.equal(true)
      })
    })

    describe('adding a folder with an invalid name', function () {
      beforeEach(function () {
        this.parentFolderId = '123asdf'
        this.folderName = '*new-folder'
        this.ProjectEntityMongoUpdateHandler.addFolder.yields()
        this.ProjectEntityUpdateHandler.addFolder(
          projectId,
          this.parentFolderId,
          this.folderName,
          this.callback
        )
      })

      it('returns an error', function () {
        const errorMatcher = sinon.match.instanceOf(Errors.InvalidNameError)
        this.callback.calledWithMatch(errorMatcher).should.equal(true)
      })
    })
  })

  describe('moveEntity', function () {
    beforeEach(function () {
      this.project_name = 'project name'
      this.startPath = '/a.tex'
      this.endPath = '/folder/b.tex'
      this.rev = 2
      this.changes = { newDocs: ['old-doc'], newFiles: ['old-file'] }
      this.ProjectEntityMongoUpdateHandler.moveEntity.yields(
        null,
        this.project,
        this.startPath,
        this.endPath,
        this.rev,
        this.changes
      )

      this.ProjectEntityUpdateHandler.moveEntity(
        projectId,
        docId,
        folderId,
        'doc',
        userId,
        this.source,
        this.callback
      )
    })

    it('moves the entity in mongo', function () {
      this.ProjectEntityMongoUpdateHandler.moveEntity
        .calledWith(projectId, docId, folderId, 'doc')
        .should.equal(true)
    })

    it('notifies tpds', function () {
      this.TpdsUpdateSender.moveEntity
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
      this.DocumentUpdaterHandler.updateProjectStructure
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
      beforeEach(function () {
        this.project_name = 'project name'
        this.startPath = '/folder/a.tex'
        this.endPath = '/folder/b.tex'
        this.rev = 2
        this.changes = { newDocs: ['old-doc'], newFiles: ['old-file'] }
        this.newDocName = 'b.tex'
        this.ProjectEntityMongoUpdateHandler.renameEntity.yields(
          null,
          this.project,
          this.startPath,
          this.endPath,
          this.rev,
          this.changes
        )

        this.ProjectEntityUpdateHandler.renameEntity(
          projectId,
          docId,
          'doc',
          this.newDocName,
          userId,
          this.source,
          this.callback
        )
      })

      it('moves the entity in mongo', function () {
        this.ProjectEntityMongoUpdateHandler.renameEntity
          .calledWith(projectId, docId, 'doc', this.newDocName)
          .should.equal(true)
      })

      it('notifies tpds', function () {
        this.TpdsUpdateSender.moveEntity
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
        this.DocumentUpdaterHandler.flushProjectToMongo.should.have.been.calledWith(
          projectId
        )
      })

      it('sends the changes in project structure to the doc updater', function () {
        this.DocumentUpdaterHandler.updateProjectStructure
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
      beforeEach(function () {
        this.project_name = 'project name'
        this.startPath = '/folder/a.tex'
        this.endPath = '/folder/b.tex'
        this.rev = 2
        this.changes = { newDocs: ['old-doc'], newFiles: ['old-file'] }
        this.newDocName = '*b.tex'
        this.ProjectEntityMongoUpdateHandler.renameEntity.yields(
          null,
          this.project,
          this.startPath,
          this.endPath,
          this.rev,
          this.changes
        )

        this.ProjectEntityUpdateHandler.renameEntity(
          projectId,
          docId,
          'doc',
          this.newDocName,
          userId,
          this.source,
          this.callback
        )
      })

      it('returns an error', function () {
        const errorMatcher = sinon.match.instanceOf(Errors.InvalidNameError)
        this.callback.calledWithMatch(errorMatcher).should.equal(true)
      })
    })

    describe('renaming an entity with a non-string value', function () {
      beforeEach(function () {
        this.project_name = 'project name'
        this.startPath = '/folder/a.tex'
        this.endPath = '/folder/b.tex'
        this.rev = 2
        this.changes = { newDocs: ['old-doc'], newFiles: ['old-file'] }
        this.newDocName = ['hello']
        this.ProjectEntityMongoUpdateHandler.renameEntity.yields(
          null,
          this.project,
          this.startPath,
          this.endPath,
          this.rev,
          this.changes
        )

        this.ProjectEntityUpdateHandler.renameEntity(
          projectId,
          docId,
          'doc',
          this.newDocName,
          userId,
          this.source,
          this.callback
        )
      })

      it('returns an error', function () {
        const errorMatcher = sinon.match.instanceOf(Error)
        this.callback.calledWithMatch(errorMatcher).should.equal(true)
        expect(
          this.ProjectEntityMongoUpdateHandler.renameEntity.called
        ).to.equal(false)
      })
    })
  })

  describe('resyncProjectHistory', function () {
    describe('a deleted project', function () {
      beforeEach(function () {
        this.ProjectGetter.getProject.yields()

        this.ProjectEntityUpdateHandler.resyncProjectHistory(
          projectId,
          this.callback
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
      beforeEach(function () {
        this.project.overleaf = {}
        this.ProjectGetter.getProject.yields(null, this.project)

        this.ProjectEntityUpdateHandler.resyncProjectHistory(
          projectId,
          this.callback
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
      beforeEach(function () {
        this.ProjectGetter.getProject.yields(null, this.project)
        const docs = [
          { doc: { _id: docId, name: 'main.tex' }, path: 'main.tex' },
        ]
        const files = [
          {
            file: { _id: fileId, name: 'universe.png', hash: '123456' },
            path: 'universe.png',
          },
        ]
        const folders = []
        this.ProjectEntityHandler.getAllEntitiesFromProject.returns({
          docs,
          files,
          folders,
        })
        this.ProjectEntityUpdateHandler.resyncProjectHistory(
          projectId,
          this.callback
        )
      })

      it('gets the project', function () {
        this.ProjectGetter.getProject.calledWith(projectId).should.equal(true)
      })

      it('gets the entities for the project', function () {
        this.ProjectEntityHandler.getAllEntitiesFromProject
          .calledWith(this.project)
          .should.equal(true)
      })

      it('uses an extended timeout', function () {
        this.LockManager.withTimeout.calledWith(6 * 60).should.equal(true)
      })

      it('tells the doc updater to sync the project', function () {
        const docs = [
          {
            doc: docId,
            path: 'main.tex',
          },
        ]
        const files = [
          {
            file: fileId,
            path: 'universe.png',
            url: `www.filestore.test/${projectId}/${fileId}`,
            _hash: '123456',
          },
        ]
        this.DocumentUpdaterHandler.resyncProjectHistory
          .calledWith(projectId, projectHistoryId, docs, files)
          .should.equal(true)
      })

      it('calls the callback', function () {
        this.callback.called.should.equal(true)
      })
    })

    describe('a project with duplicate filenames', function () {
      beforeEach(function (done) {
        this.ProjectGetter.getProject.yields(null, this.project)
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
        this.ProjectEntityUpdateHandler.resyncProjectHistory(projectId, done)
      })

      it('renames the duplicate files', function () {
        const renameEntity = this.ProjectEntityMongoUpdateHandler.renameEntity
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
        const docs = [
          { doc: 'doc1', path: 'main.tex' },
          { doc: 'doc2', path: 'a/b/c/duplicate.tex' },
          { doc: 'doc3', path: 'a/b/c/duplicate.tex (1)' },
          { doc: 'doc4', path: 'another dupe (22)' },
          { doc: 'doc5', path: 'a/b/c/duplicate.tex (2)' },
        ]
        const urlPrefix = `www.filestore.test/${projectId}`
        const files = [
          {
            file: 'file1',
            path: 'image.jpg',
            url: `${urlPrefix}/file1`,
            _hash: 'hash1',
          },
          {
            file: 'file2',
            path: 'duplicate.jpg',
            url: `${urlPrefix}/file2`,
            _hash: 'hash2',
          },
          {
            file: 'file3',
            path: 'duplicate.jpg (1)',
            url: `${urlPrefix}/file3`,
            _hash: 'hash3',
          },
          {
            file: 'file4',
            path: 'another dupe (23)',
            url: `${urlPrefix}/file4`,
            _hash: 'hash4',
          },
        ]
        expect(
          this.DocumentUpdaterHandler.resyncProjectHistory
        ).to.have.been.calledWith(projectId, projectHistoryId, docs, files)
      })
    })

    describe('a project with bad filenames', function () {
      beforeEach(function (done) {
        this.ProjectGetter.getProject.yields(null, this.project)
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
        this.ProjectEntityUpdateHandler.resyncProjectHistory(projectId, done)
      })

      it('renames the files', function () {
        const renameEntity = this.ProjectEntityMongoUpdateHandler.renameEntity
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
        const docs = [
          { doc: 'doc1', path: 'a/b/c/_d_e_f_test.tex' },
          { doc: 'doc2', path: 'a/untitled' },
        ]
        const urlPrefix = `www.filestore.test/${projectId}`
        const files = [
          {
            file: 'file1',
            path: 'A_.png',
            url: `${urlPrefix}/file1`,
            _hash: 'hash1',
          },
          {
            file: 'file2',
            path: 'A_.png (1)',
            url: `${urlPrefix}/file2`,
            _hash: 'hash2',
          },
        ]
        expect(
          this.DocumentUpdaterHandler.resyncProjectHistory
        ).to.have.been.calledWith(projectId, projectHistoryId, docs, files)
      })
    })

    describe('a project with a bad folder name', function () {
      beforeEach(function (done) {
        this.ProjectGetter.getProject.yields(null, this.project)
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
        this.ProjectEntityHandler.getAllEntitiesFromProject.returns({
          docs,
          files,
          folders,
        })
        this.ProjectEntityUpdateHandler.resyncProjectHistory(projectId, done)
      })

      it('renames the folder', function () {
        const renameEntity = this.ProjectEntityMongoUpdateHandler.renameEntity
        expect(renameEntity).to.have.callCount(1)
        expect(renameEntity).to.have.been.calledWith(
          projectId,
          'folder2',
          'folder',
          'bad_'
        )
      })

      it('tells the doc updater to resync the project', function () {
        const docs = [
          { doc: 'doc1', path: 'good/doc1.tex' },
          { doc: 'doc2', path: 'bad_/doc2.tex' },
        ]
        const files = []
        expect(
          this.DocumentUpdaterHandler.resyncProjectHistory
        ).to.have.been.calledWith(projectId, projectHistoryId, docs, files)
      })
    })

    describe('a project with duplicate names between a folder and a doc', function () {
      beforeEach(function (done) {
        this.ProjectGetter.getProject.yields(null, this.project)
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
        this.ProjectEntityHandler.getAllEntitiesFromProject.returns({
          docs,
          files,
          folders,
        })
        this.ProjectEntityUpdateHandler.resyncProjectHistory(projectId, done)
      })

      it('renames the doc', function () {
        const renameEntity = this.ProjectEntityMongoUpdateHandler.renameEntity
        expect(renameEntity).to.have.callCount(1)
        expect(renameEntity).to.have.been.calledWith(
          projectId,
          'doc1',
          'doc',
          'chapters (1)'
        )
      })

      it('tells the doc updater to resync the project', function () {
        const docs = [
          { doc: 'doc1', path: 'chapters (1)' },
          { doc: 'doc2', path: 'chapters/chapter1.tex' },
        ]
        const files = []
        expect(
          this.DocumentUpdaterHandler.resyncProjectHistory
        ).to.have.been.calledWith(projectId, projectHistoryId, docs, files)
      })
    })

    describe('a project with an invalid file tree', function () {
      beforeEach(function () {
        this.callback = sinon.stub()
        this.ProjectGetter.getProject.yields(null, this.project)
        this.ProjectEntityHandler.getAllEntitiesFromProject.throws()
        this.ProjectEntityUpdateHandler.resyncProjectHistory(
          projectId,
          this.callback
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
      this.FileStoreHandler.deleteFile.yields()
      this.ProjectEntityUpdateHandler.unsetRootDoc = sinon.stub().yields()
      this.ProjectEntityMongoUpdateHandler._insertDeletedFileReference.yields()
    })

    describe('a file', function () {
      beforeEach(function (done) {
        this.path = '/file/system/path.png'
        this.entity = { _id: this.entityId }
        this.newProject = 'new-project'
        this.ProjectEntityUpdateHandler._cleanUpEntity(
          this.project,
          this.newProject,
          this.entity,
          'file',
          this.path,
          userId,
          this.source,
          (err, subtreeListing) => {
            if (err) {
              return done(err)
            }
            this.subtreeListing = subtreeListing
            done()
          }
        )
      })

      it('should insert the file into the deletedFiles collection', function () {
        this.ProjectEntityMongoUpdateHandler._insertDeletedFileReference
          .calledWith(this.project._id, this.entity)
          .should.equal(true)
      })

      it('should not delete the file from FileStoreHandler', function () {
        this.FileStoreHandler.deleteFile
          .calledWith(projectId, this.entityId)
          .should.equal(false)
      })

      it('should not attempt to delete from the document updater', function () {
        this.DocumentUpdaterHandler.deleteDoc.called.should.equal(false)
      })

      it('should send the update to the doc updater', function () {
        const oldFiles = [{ file: this.entity, path: this.path }]
        this.DocumentUpdaterHandler.updateProjectStructure.should.have.been.calledWith(
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
      beforeEach(function (done) {
        this.path = '/file/system/path.tex'
        this.ProjectEntityUpdateHandler._cleanUpDoc = sinon.stub().yields()
        this.entity = { _id: this.entityId }
        this.newProject = 'new-project'
        this.ProjectEntityUpdateHandler._cleanUpEntity(
          this.project,
          this.newProject,
          this.entity,
          'doc',
          this.path,
          userId,
          this.source,
          (err, subtreeListing) => {
            if (err) {
              return done(err)
            }
            this.subtreeListing = subtreeListing
            done()
          }
        )
      })

      it('should clean up the doc', function () {
        this.ProjectEntityUpdateHandler._cleanUpDoc
          .calledWith(this.project, this.entity, this.path, userId)
          .should.equal(true)
      })

      it('should send the update to the doc updater', function () {
        const oldDocs = [{ doc: this.entity, path: this.path }]
        this.DocumentUpdaterHandler.updateProjectStructure.should.have.been.calledWith(
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
      beforeEach(function (done) {
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

        this.ProjectEntityUpdateHandler._cleanUpDoc = sinon.stub().yields()
        this.ProjectEntityUpdateHandler._cleanUpFile = sinon.stub().yields()
        const path = '/folder'
        this.newProject = 'new-project'
        this.ProjectEntityUpdateHandler._cleanUpEntity(
          this.project,
          this.newProject,
          this.folder,
          'folder',
          path,
          userId,
          this.source,
          (err, subtreeListing) => {
            if (err) {
              return done(err)
            }
            this.subtreeListing = subtreeListing
            done()
          }
        )
      })

      it('should clean up all sub files', function () {
        this.ProjectEntityUpdateHandler._cleanUpFile
          .calledWith(
            this.project,
            this.file1,
            '/folder/subfolder/file-name-1',
            userId
          )
          .should.equal(true)
        this.ProjectEntityUpdateHandler._cleanUpFile
          .calledWith(this.project, this.file2, '/folder/file-name-2', userId)
          .should.equal(true)
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
        this.DocumentUpdaterHandler.updateProjectStructure
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
        _id: ObjectId(),
        name: 'test.tex',
      }
      this.path = '/path/to/doc'
      this.ProjectEntityUpdateHandler.unsetRootDoc = sinon.stub().yields()
      this.DocstoreManager.deleteDoc.yields()
    })

    describe('when the doc is the root doc', function () {
      beforeEach(function () {
        this.project.rootDoc_id = this.doc._id
        this.ProjectEntityUpdateHandler._cleanUpDoc(
          this.project,
          this.doc,
          this.path,
          userId,
          this.callback
        )
      })

      it('should unset the root doc', function () {
        this.ProjectEntityUpdateHandler.unsetRootDoc
          .calledWith(projectId)
          .should.equal(true)
      })

      it('should delete the doc in the doc updater', function () {
        this.DocumentUpdaterHandler.deleteDoc
          .calledWith(projectId, this.doc._id.toString())
          .should.equal(true)
      })

      it('should delete the doc in the doc store', function () {
        this.DocstoreManager.deleteDoc
          .calledWith(projectId, this.doc._id.toString(), 'test.tex')
          .should.equal(true)
      })

      it('should call the callback', function () {
        this.callback.called.should.equal(true)
      })
    })

    describe('when the doc is not the root doc', function () {
      beforeEach(function () {
        this.project.rootDoc_id = ObjectId()
        this.ProjectEntityUpdateHandler._cleanUpDoc(
          this.project,
          this.doc,
          this.path,
          userId,
          this.callback
        )
      })

      it('should not unset the root doc', function () {
        this.ProjectEntityUpdateHandler.unsetRootDoc.called.should.equal(false)
      })

      it('should call the callback', function () {
        this.callback.called.should.equal(true)
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
      this.ProjectLocator.findElement
        .withArgs({
          project_id: this.project._id,
          element_id: this.doc._id,
          type: 'doc',
        })
        .yields(null, this.doc, { fileSystem: this.path }, this.folder)
      this.ProjectLocator.findElement
        .withArgs({
          project_id: this.project._id.toString(),
          element_id: this.file._id,
          type: 'file',
        })
        .yields(null, this.file, this.docPath, this.folder)
      this.DocstoreManager.getDoc
        .withArgs(this.project._id, this.doc._id)
        .yields(null, this.docLines, this.rev)
      this.FileWriter.writeLinesToDisk.yields(null, this.tmpFilePath)
      this.FileStoreHandler.uploadFileFromDisk.yields(
        null,
        this.fileStoreUrl,
        this.file
      )
      this.ProjectEntityMongoUpdateHandler.replaceDocWithFile.yields(
        null,
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
        expect(this.DocumentUpdaterHandler.deleteDoc).to.have.been.calledWith(
          this.project._id,
          this.doc._id
        )
      })

      it('uploads the file to filestore', function () {
        expect(
          this.FileStoreHandler.uploadFileFromDisk
        ).to.have.been.calledWith(
          this.project._id,
          { name: this.doc.name, rev: this.rev + 1 },
          this.tmpFilePath
        )
      })

      it('cleans up the temporary file', function () {
        expect(this.fs.unlink).to.have.been.calledWith(this.tmpFilePath)
      })

      it('replaces the doc with the file', function () {
        expect(
          this.ProjectEntityMongoUpdateHandler.replaceDocWithFile
        ).to.have.been.calledWith(this.project._id, this.doc._id, this.file)
      })

      it('notifies document updater of changes', function () {
        expect(
          this.DocumentUpdaterHandler.updateProjectStructure
        ).to.have.been.calledWith(
          this.project._id,
          this.project.overleaf.history.id,
          this.user._id,
          {
            oldDocs: [{ doc: this.doc, path: this.path }],
            newFiles: [
              { file: this.file, path: this.path, url: this.fileStoreUrl },
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
        this.DocstoreManager.getDoc
          .withArgs(this.project._id, this.doc._id)
          .yields(null, this.docLines, 'rev', 'version', this.ranges)
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
})
