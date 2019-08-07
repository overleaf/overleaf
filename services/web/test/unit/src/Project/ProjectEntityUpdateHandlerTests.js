/* eslint-disable
    camelcase,
    max-len,
    no-return-assign,
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
const chai = require('chai')
const { assert } = require('chai')
const should = chai.should()
const { expect } = chai
const modulePath =
  '../../../../app/src/Features/Project/ProjectEntityUpdateHandler'
const sinon = require('sinon')
const Errors = require('../../../../app/src/Features/Errors/Errors')
const SandboxedModule = require('sandboxed-module')
const { ObjectId } = require('mongoose').Types

describe('ProjectEntityUpdateHandler', function() {
  const project_id = '4eecb1c1bffa66588e0000a1'
  const projectHistoryId = '123456'
  const doc_id = '4eecb1c1bffa66588e0000a2'
  const file_id = '4eecaffcbffa66588e000009'
  const folder_id = '4eecaffcbffa66588e000008'
  const rootFolderId = '4eecaffcbffa66588e000007'
  const new_file_id = '4eecaffcbffa66588e000099'
  const userId = 1234

  beforeEach(function() {
    let Doc, File
    this.project = {
      _id: project_id,
      name: 'project name',
      overleaf: {
        history: {
          id: projectHistoryId
        }
      }
    }
    this.fileUrl = 'filestore.example.com/file'
    this.FileStoreHandler = {}

    this.DocModel = Doc = class Doc {
      constructor(options) {
        ;({ name: this.name, lines: this.lines } = options)
        this._id = doc_id
        this.rev = 0
      }
    }
    this.FileModel = File = class File {
      constructor(options) {
        ;({ name: this.name } = options)
        // use a new id for replacement files
        if (this.name === 'dummy-upload-filename') {
          this._id = new_file_id
        } else {
          this._id = file_id
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

    this.fileName = 'something.jpg'
    this.fileSystemPath = 'somehintg'

    this.linkedFileData = { provider: 'url' }

    this.source = 'editor'
    this.callback = sinon.stub()
    return (this.ProjectEntityUpdateHandler = SandboxedModule.require(
      modulePath,
      {
        globals: {
          console: console
        },
        requires: {
          'logger-sharelatex': (this.logger = {
            log: sinon.stub(),
            warn: sinon.stub(),
            error: sinon.stub(),
            err() {}
          }),
          '../../models/Doc': {
            Doc: this.DocModel
          },
          '../Docstore/DocstoreManager': (this.DocstoreManager = {}),
          '../Errors/Errors': Errors,
          '../../Features/DocumentUpdater/DocumentUpdaterHandler': (this.DocumentUpdaterHandler = {
            updateProjectStructure: sinon.stub().yields()
          }),
          '../../models/File': {
            File: this.FileModel
          },
          '../FileStore/FileStoreHandler': this.FileStoreHandler,
          '../../infrastructure/LockManager': (this.LockManager = {
            runWithLock: sinon.spy((namespace, id, runner, callback) =>
              runner(callback)
            )
          }),
          '../../models/Project': {
            Project: (this.ProjectModel = {})
          },
          './ProjectGetter': (this.ProjectGetter = {}),
          './ProjectLocator': (this.ProjectLocator = {}),
          './ProjectUpdateHandler': (this.ProjectUpdater = {}),
          './ProjectEntityHandler': (this.ProjectEntityHandler = {}),
          './ProjectEntityMongoUpdateHandler': (this.ProjectEntityMongoUpdateHandler = {}),
          '../ThirdPartyDataStore/TpdsUpdateSender': (this.TpdsUpdateSender = {
            addFile: sinon.stub().yields()
          })
        }
      }
    ))
  })

  describe('copyFileFromExistingProjectWithProject', function() {
    beforeEach(function() {
      this.oldProject_id = '123kljadas'
      this.oldFileRef = { name: this.fileName, _id: 'oldFileRef' }
      this.ProjectEntityMongoUpdateHandler._confirmFolder = sinon
        .stub()
        .yields(folder_id)
      this.ProjectEntityMongoUpdateHandler._putElement = sinon
        .stub()
        .yields(null, { path: { fileSystem: this.fileSystemPath } })
      this.FileStoreHandler.copyFile = sinon.stub().yields(null, this.fileUrl)
      return this.ProjectEntityUpdateHandler.copyFileFromExistingProjectWithProject(
        this.project._id,
        this.project,
        folder_id,
        this.oldProject_id,
        this.oldFileRef,
        userId,
        this.callback
      )
    })

    it('should copy the file in FileStoreHandler', function() {
      return this.FileStoreHandler.copyFile
        .calledWith(
          this.oldProject_id,
          this.oldFileRef._id,
          project_id,
          file_id
        )
        .should.equal(true)
    })

    it('should put file into folder by calling put element', function() {
      return this.ProjectEntityMongoUpdateHandler._putElement
        .calledWithMatch(
          this.project,
          folder_id,
          { _id: file_id, name: this.fileName },
          'file'
        )
        .should.equal(true)
    })

    it('should return doc and parent folder', function() {
      return this.callback
        .calledWithMatch(null, { _id: file_id, name: this.fileName }, folder_id)
        .should.equal(true)
    })

    it('should call third party data store if versioning is enabled', function() {
      return this.TpdsUpdateSender.addFile
        .calledWith({
          project_id,
          file_id,
          path: this.fileSystemPath,
          rev: 0,
          project_name: this.project.name
        })
        .should.equal(true)
    })

    it('should should send the change in project structure to the doc updater', function() {
      const changesMatcher = sinon.match(changes => {
        const { newFiles } = changes
        if (newFiles.length !== 1) {
          return false
        }
        const newFile = newFiles[0]
        return (
          newFile.file._id === file_id &&
          newFile.path === this.fileSystemPath &&
          newFile.url === this.fileUrl
        )
      })

      return this.DocumentUpdaterHandler.updateProjectStructure
        .calledWithMatch(project_id, projectHistoryId, userId, changesMatcher)
        .should.equal(true)
    })
  })

  describe('copyFileFromExistingProjectWithProject, with linkedFileData and hash', function() {
    beforeEach(function() {
      this.oldProject_id = '123kljadas'
      this.oldFileRef = {
        _id: 'oldFileRef',
        name: this.fileName,
        linkedFileData: this.linkedFileData,
        hash: '123456'
      }
      this.ProjectEntityMongoUpdateHandler._confirmFolder = sinon
        .stub()
        .yields(folder_id)
      this.ProjectEntityMongoUpdateHandler._putElement = sinon
        .stub()
        .yields(null, { path: { fileSystem: this.fileSystemPath } })
      this.FileStoreHandler.copyFile = sinon.stub().yields(null, this.fileUrl)
      return this.ProjectEntityUpdateHandler.copyFileFromExistingProjectWithProject(
        this.project._id,
        this.project,
        folder_id,
        this.oldProject_id,
        this.oldFileRef,
        userId,
        this.callback
      )
    })

    it('should copy the file in FileStoreHandler', function() {
      return this.FileStoreHandler.copyFile
        .calledWith(
          this.oldProject_id,
          this.oldFileRef._id,
          project_id,
          file_id
        )
        .should.equal(true)
    })

    it('should put file into folder by calling put element, with the linkedFileData and hash', function() {
      return this.ProjectEntityMongoUpdateHandler._putElement
        .calledWithMatch(
          this.project,
          folder_id,
          {
            _id: file_id,
            name: this.fileName,
            linkedFileData: this.linkedFileData,
            hash: '123456'
          },
          'file'
        )
        .should.equal(true)
    })
  })

  describe('updateDocLines', function() {
    beforeEach(function() {
      this.path = '/somewhere/something.tex'
      this.doc = {
        _id: doc_id
      }
      this.version = 42
      this.ranges = { mock: 'ranges' }
      this.lastUpdatedAt = new Date().getTime()
      this.lastUpdatedBy = 'fake-last-updater-id'
      this.ProjectGetter.getProjectWithoutDocLines = sinon
        .stub()
        .yields(null, this.project)
      this.ProjectLocator.findElement = sinon
        .stub()
        .yields(null, this.doc, { fileSystem: this.path })
      this.TpdsUpdateSender.addDoc = sinon.stub().yields()
      this.ProjectUpdater.markAsUpdated = sinon.stub()
      return (this.callback = sinon.stub())
    })

    describe('when the doc has been modified', function() {
      beforeEach(function() {
        this.DocstoreManager.updateDoc = sinon
          .stub()
          .yields(null, true, (this.rev = 5))
        return this.ProjectEntityUpdateHandler.updateDocLines(
          project_id,
          doc_id,
          this.docLines,
          this.version,
          this.ranges,
          this.lastUpdatedAt,
          this.lastUpdatedBy,
          this.callback
        )
      })

      it('should get the project without doc lines', function() {
        return this.ProjectGetter.getProjectWithoutDocLines
          .calledWith(project_id)
          .should.equal(true)
      })

      it('should find the doc', function() {
        return this.ProjectLocator.findElement
          .calledWith({
            project: this.project,
            type: 'docs',
            element_id: doc_id
          })
          .should.equal(true)
      })

      it('should update the doc in the docstore', function() {
        return this.DocstoreManager.updateDoc
          .calledWith(
            project_id,
            doc_id,
            this.docLines,
            this.version,
            this.ranges
          )
          .should.equal(true)
      })

      it('should mark the project as updated', function() {
        return sinon.assert.calledWith(
          this.ProjectUpdater.markAsUpdated,
          project_id,
          this.lastUpdatedAt,
          this.lastUpdatedBy
        )
      })

      it('should send the doc the to the TPDS', function() {
        return this.TpdsUpdateSender.addDoc
          .calledWith({
            project_id,
            project_name: this.project.name,
            doc_id,
            rev: this.rev,
            path: this.path
          })
          .should.equal(true)
      })

      it('should call the callback', function() {
        return this.callback.called.should.equal(true)
      })
    })

    describe('when the doc has not been modified', function() {
      beforeEach(function() {
        this.DocstoreManager.updateDoc = sinon
          .stub()
          .yields(null, false, (this.rev = 5))
        return this.ProjectEntityUpdateHandler.updateDocLines(
          project_id,
          doc_id,
          this.docLines,
          this.version,
          this.ranges,
          this.lastUpdatedAt,
          this.lastUpdatedBy,
          this.callback
        )
      })

      it('should not mark the project as updated', function() {
        return this.ProjectUpdater.markAsUpdated.called.should.equal(false)
      })

      it('should not send the doc the to the TPDS', function() {
        return this.TpdsUpdateSender.addDoc.called.should.equal(false)
      })

      it('should call the callback', function() {
        return this.callback.called.should.equal(true)
      })
    })

    describe('when the doc has been deleted', function() {
      beforeEach(function() {
        this.project.deletedDocs = [{ _id: doc_id }]
        this.ProjectGetter.getProjectWithoutDocLines = sinon
          .stub()
          .yields(null, this.project)
        this.ProjectLocator.findElement = sinon
          .stub()
          .yields(new Errors.NotFoundError())
        this.DocstoreManager.updateDoc = sinon.stub().yields()
        return this.ProjectEntityUpdateHandler.updateDocLines(
          project_id,
          doc_id,
          this.docLines,
          this.version,
          this.ranges,
          this.lastUpdatedAt,
          this.lastUpdatedBy,
          this.callback
        )
      })

      it('should update the doc in the docstore', function() {
        return this.DocstoreManager.updateDoc
          .calledWith(
            project_id,
            doc_id,
            this.docLines,
            this.version,
            this.ranges
          )
          .should.equal(true)
      })

      it('should not mark the project as updated', function() {
        return this.ProjectUpdater.markAsUpdated.called.should.equal(false)
      })

      it('should not send the doc the to the TPDS', function() {
        return this.TpdsUpdateSender.addDoc.called.should.equal(false)
      })

      it('should call the callback', function() {
        return this.callback.called.should.equal(true)
      })
    })

    describe('when the doc is not related to the project', function() {
      beforeEach(function() {
        this.ProjectLocator.findElement = sinon.stub().yields()
        return this.ProjectEntityUpdateHandler.updateDocLines(
          project_id,
          doc_id,
          this.docLines,
          this.version,
          this.ranges,
          this.lastUpdatedAt,
          this.lastUpdatedBy,
          this.callback
        )
      })

      it('should log out the error', function() {
        return this.logger.warn
          .calledWith(
            {
              project_id,
              doc_id,
              lines: this.docLines
            },
            'doc not found while updating doc lines'
          )
          .should.equal(true)
      })

      it('should return a not found error', function() {
        return this.callback
          .calledWith(new Errors.NotFoundError())
          .should.equal(true)
      })
    })

    describe('when the project is not found', function() {
      beforeEach(function() {
        this.ProjectGetter.getProjectWithoutDocLines = sinon.stub().yields()
        return this.ProjectEntityUpdateHandler.updateDocLines(
          project_id,
          doc_id,
          this.docLines,
          this.version,
          this.ranges,
          this.lastUpdatedAt,
          this.lastUpdatedBy,
          this.callback
        )
      })

      it('should return a not found error', function() {
        return this.callback
          .calledWith(new Errors.NotFoundError())
          .should.equal(true)
      })
    })
  })

  describe('setRootDoc', function() {
    it('should call Project.update', function() {
      const rootDoc_id = 'root-doc-id-123123'
      this.ProjectModel.update = sinon.stub()
      this.ProjectEntityUpdateHandler.setRootDoc(project_id, rootDoc_id)
      return this.ProjectModel.update
        .calledWith({ _id: project_id }, { rootDoc_id })
        .should.equal(true)
    })
  })

  describe('unsetRootDoc', function() {
    it('should call Project.update', function() {
      this.ProjectModel.update = sinon.stub()
      this.ProjectEntityUpdateHandler.unsetRootDoc(project_id)
      return this.ProjectModel.update
        .calledWith({ _id: project_id }, { $unset: { rootDoc_id: true } })
        .should.equal(true)
    })
  })

  describe('addDoc', function() {
    describe('adding a doc', function() {
      beforeEach(function() {
        this.path = '/path/to/doc'

        this.newDoc = {
          name: this.docName,
          lines: undefined,
          _id: doc_id,
          rev: 0
        }
        this.DocstoreManager.updateDoc = sinon
          .stub()
          .yields(null, false, (this.rev = 5))
        this.TpdsUpdateSender.addDoc = sinon.stub().yields()
        this.ProjectEntityMongoUpdateHandler.addDoc = sinon
          .stub()
          .yields(null, { path: { fileSystem: this.path } }, this.project)
        return this.ProjectEntityUpdateHandler.addDoc(
          project_id,
          doc_id,
          this.docName,
          this.docLines,
          userId,
          this.callback
        )
      })

      it('creates the doc without history', function() {
        return this.DocstoreManager.updateDoc
          .calledWith(project_id, doc_id, this.docLines, 0, {})
          .should.equal(true)
      })

      it('sends the change in project structure to the doc updater', function() {
        const newDocs = [
          {
            doc: this.newDoc,
            path: this.path,
            docLines: this.docLines.join('\n')
          }
        ]
        return this.DocumentUpdaterHandler.updateProjectStructure
          .calledWith(project_id, projectHistoryId, userId, {
            newDocs,
            newProject: this.project
          })
          .should.equal(true)
      })
    })

    describe('adding a doc with an invalid name', function() {
      beforeEach(function() {
        this.path = '/path/to/doc'

        this.newDoc = { _id: doc_id }
        return this.ProjectEntityUpdateHandler.addDoc(
          project_id,
          folder_id,
          `*${this.docName}`,
          this.docLines,
          userId,
          this.callback
        )
      })

      it('returns an error', function() {
        const errorMatcher = sinon.match.instanceOf(Errors.InvalidNameError)
        return this.callback.calledWithMatch(errorMatcher).should.equal(true)
      })
    })
  })

  describe('addFile', function() {
    describe('adding a file', function() {
      beforeEach(function() {
        this.path = '/path/to/file'

        this.newFile = {
          _id: file_id,
          rev: 0,
          name: this.fileName,
          linkedFileData: this.linkedFileData
        }
        this.FileStoreHandler.uploadFileFromDisk = sinon
          .stub()
          .yields(null, this.fileUrl, this.newFile)
        this.TpdsUpdateSender.addFile = sinon.stub().yields()
        this.ProjectEntityMongoUpdateHandler.addFile = sinon
          .stub()
          .yields(null, { path: { fileSystem: this.path } }, this.project)
        return this.ProjectEntityUpdateHandler.addFile(
          project_id,
          folder_id,
          this.fileName,
          this.fileSystemPath,
          this.linkedFileData,
          userId,
          this.callback
        )
      })

      it('updates the file in the filestore', function() {
        return this.FileStoreHandler.uploadFileFromDisk
          .calledWith(
            project_id,
            { name: this.fileName, linkedFileData: this.linkedFileData },
            this.fileSystemPath
          )
          .should.equal(true)
      })

      it('updates the file in mongo', function() {
        const fileMatcher = sinon.match(file => {
          return file.name === this.fileName
        })

        return this.ProjectEntityMongoUpdateHandler.addFile
          .calledWithMatch(project_id, folder_id, fileMatcher)
          .should.equal(true)
      })

      it('notifies the tpds', function() {
        return this.TpdsUpdateSender.addFile
          .calledWith({
            project_id,
            project_name: this.project.name,
            file_id,
            rev: 0,
            path: this.path
          })
          .should.equal(true)
      })

      it('sends the change in project structure to the doc updater', function() {
        const newFiles = [
          {
            file: this.newFile,
            path: this.path,
            url: this.fileUrl
          }
        ]
        return this.DocumentUpdaterHandler.updateProjectStructure
          .calledWith(project_id, projectHistoryId, userId, {
            newFiles,
            newProject: this.project
          })
          .should.equal(true)
      })
    })

    describe('adding a file with an invalid name', function() {
      beforeEach(function() {
        this.path = '/path/to/file'

        this.newFile = {
          _id: file_id,
          rev: 0,
          name: this.fileName,
          linkedFileData: this.linkedFileData
        }
        this.TpdsUpdateSender.addFile = sinon.stub().yields()
        this.ProjectEntityMongoUpdateHandler.addFile = sinon
          .stub()
          .yields(null, { path: { fileSystem: this.path } }, this.project)
        return this.ProjectEntityUpdateHandler.addFile(
          project_id,
          folder_id,
          `*${this.fileName}`,
          this.fileSystemPath,
          this.linkedFileData,
          userId,
          this.callback
        )
      })

      it('returns an error', function() {
        const errorMatcher = sinon.match.instanceOf(Errors.InvalidNameError)
        return this.callback.calledWithMatch(errorMatcher).should.equal(true)
      })
    })
  })

  describe('replaceFile', function() {
    beforeEach(function() {
      // replacement file now creates a new file object
      this.newFileUrl = 'new-file-url'
      this.FileStoreHandler.uploadFileFromDisk = sinon
        .stub()
        .yields(null, this.newFileUrl, this.newFile)

      this.newFile = {
        _id: new_file_id,
        name: 'dummy-upload-filename',
        rev: 0,
        linkedFileData: this.linkedFileData
      }
      this.oldFile = { _id: file_id, rev: 3 }
      this.path = '/path/to/file'
      this.newProject = 'new project'
      this.FileStoreHandler.uploadFileFromDisk = sinon
        .stub()
        .yields(null, this.newFileUrl, this.newFile)
      this.ProjectEntityMongoUpdateHandler._insertDeletedFileReference = sinon
        .stub()
        .yields()
      this.ProjectEntityMongoUpdateHandler.replaceFileWithNew = sinon
        .stub()
        .yields(
          null,
          this.oldFile,
          this.project,
          { fileSystem: this.path },
          this.newProject
        )
      return this.ProjectEntityUpdateHandler.replaceFile(
        project_id,
        file_id,
        this.fileSystemPath,
        this.linkedFileData,
        userId,
        this.callback
      )
    })

    it('uploads a new version of the file', function() {
      return this.FileStoreHandler.uploadFileFromDisk
        .calledWith(
          project_id,
          {
            name: 'dummy-upload-filename',
            linkedFileData: this.linkedFileData
          },
          this.fileSystemPath
        )
        .should.equal(true)
    })

    it('replaces the file in mongo', function() {
      return this.ProjectEntityMongoUpdateHandler.replaceFileWithNew
        .calledWith(project_id, file_id, this.newFile)
        .should.equal(true)
    })

    it('notifies the tpds', function() {
      return this.TpdsUpdateSender.addFile
        .calledWith({
          project_id,
          project_name: this.project.name,
          file_id: new_file_id,
          rev: this.oldFile.rev + 1,
          path: this.path
        })
        .should.equal(true)
    })

    it('updates the project structure in the doc updater', function() {
      const oldFiles = [
        {
          file: this.oldFile,
          path: this.path
        }
      ]
      const newFiles = [
        {
          file: this.newFile,
          path: this.path,
          url: this.newFileUrl
        }
      ]
      return this.DocumentUpdaterHandler.updateProjectStructure
        .calledWith(project_id, projectHistoryId, userId, {
          oldFiles,
          newFiles,
          newProject: this.newProject
        })
        .should.equal(true)
    })
  })

  describe('upsertDoc', function() {
    describe('upserting into an invalid folder', function() {
      beforeEach(function() {
        this.ProjectLocator.findElement = sinon.stub().yields()
        return this.ProjectEntityUpdateHandler.upsertDoc(
          project_id,
          folder_id,
          this.docName,
          this.docLines,
          this.source,
          userId,
          this.callback
        )
      })

      it('returns an error', function() {
        const errorMatcher = sinon.match.instanceOf(Error)
        return this.callback.calledWithMatch(errorMatcher).should.equal(true)
      })
    })

    describe('updating an existing doc', function() {
      beforeEach(function() {
        this.existingDoc = { _id: doc_id, name: this.docName }
        this.folder = { _id: folder_id, docs: [this.existingDoc] }
        this.ProjectLocator.findElement = sinon.stub().yields(null, this.folder)
        this.DocumentUpdaterHandler.setDocument = sinon.stub().yields()
        this.DocumentUpdaterHandler.flushDocToMongo = sinon.stub().yields()

        return this.ProjectEntityUpdateHandler.upsertDoc(
          project_id,
          folder_id,
          this.docName,
          this.docLines,
          this.source,
          userId,
          this.callback
        )
      })

      it('tries to find the folder', function() {
        return this.ProjectLocator.findElement
          .calledWith({ project_id, element_id: folder_id, type: 'folder' })
          .should.equal(true)
      })

      it('updates the doc contents', function() {
        return this.DocumentUpdaterHandler.setDocument
          .calledWith(
            project_id,
            this.existingDoc._id,
            userId,
            this.docLines,
            this.source
          )
          .should.equal(true)
      })

      it('flushes the doc contents', function() {
        return this.DocumentUpdaterHandler.flushDocToMongo
          .calledWith(project_id, this.existingDoc._id)
          .should.equal(true)
      })

      it('returns the doc', function() {
        return this.callback.calledWith(null, this.existingDoc, false)
      })
    })

    describe('creating a new doc', function() {
      beforeEach(function() {
        this.folder = { _id: folder_id, docs: [] }
        this.newDoc = { _id: doc_id }
        this.ProjectLocator.findElement = sinon.stub().yields(null, this.folder)
        this.ProjectEntityUpdateHandler.addDocWithRanges = {
          withoutLock: sinon.stub().yields(null, this.newDoc)
        }

        return this.ProjectEntityUpdateHandler.upsertDoc(
          project_id,
          folder_id,
          this.docName,
          this.docLines,
          this.source,
          userId,
          this.callback
        )
      })

      it('tries to find the folder', function() {
        return this.ProjectLocator.findElement
          .calledWith({ project_id, element_id: folder_id, type: 'folder' })
          .should.equal(true)
      })

      it('adds the doc', function() {
        return this.ProjectEntityUpdateHandler.addDocWithRanges.withoutLock
          .calledWith(
            project_id,
            folder_id,
            this.docName,
            this.docLines,
            {},
            userId
          )
          .should.equal(true)
      })

      it('returns the doc', function() {
        return this.callback.calledWith(null, this.newDoc, true)
      })
    })

    describe('upserting a new doc with an invalid name', function() {
      beforeEach(function() {
        this.folder = { _id: folder_id, docs: [] }
        this.newDoc = { _id: doc_id }
        this.ProjectLocator.findElement = sinon.stub().yields(null, this.folder)
        this.ProjectEntityUpdateHandler.addDocWithRanges = {
          withoutLock: sinon.stub().yields(null, this.newDoc)
        }

        return this.ProjectEntityUpdateHandler.upsertDoc(
          project_id,
          folder_id,
          `*${this.docName}`,
          this.docLines,
          this.source,
          userId,
          this.callback
        )
      })

      it('returns an error', function() {
        const errorMatcher = sinon.match.instanceOf(Errors.InvalidNameError)
        return this.callback.calledWithMatch(errorMatcher).should.equal(true)
      })
    })
  })

  describe('upsertFile', function() {
    beforeEach(function() {
      return (this.FileStoreHandler.uploadFileFromDisk = sinon
        .stub()
        .yields(null, this.fileUrl, this.newFile))
    })

    describe('upserting into an invalid folder', function() {
      beforeEach(function() {
        this.ProjectLocator.findElement = sinon.stub().yields()
        return this.ProjectEntityUpdateHandler.upsertFile(
          project_id,
          folder_id,
          this.fileName,
          this.fileSystemPath,
          this.linkedFileData,
          userId,
          this.callback
        )
      })

      it('returns an error', function() {
        const errorMatcher = sinon.match.instanceOf(Error)
        return this.callback.calledWithMatch(errorMatcher).should.equal(true)
      })
    })

    describe('updating an existing file', function() {
      beforeEach(function() {
        this.existingFile = { _id: file_id, name: this.fileName }
        this.folder = { _id: folder_id, fileRefs: [this.existingFile] }
        this.ProjectLocator.findElement = sinon.stub().yields(null, this.folder)
        this.ProjectEntityUpdateHandler.replaceFile = {
          mainTask: sinon.stub().yields(null, this.newFile)
        }

        return this.ProjectEntityUpdateHandler.upsertFile(
          project_id,
          folder_id,
          this.fileName,
          this.fileSystemPath,
          this.linkedFileData,
          userId,
          this.callback
        )
      })

      it('replaces the file', function() {
        return this.ProjectEntityUpdateHandler.replaceFile.mainTask
          .calledWith(
            project_id,
            file_id,
            this.fileSystemPath,
            this.linkedFileData,
            userId
          )
          .should.equal(true)
      })

      it('returns the file', function() {
        return this.callback.calledWith(null, this.existingFile, false)
      })
    })

    describe('creating a new file', function() {
      beforeEach(function() {
        this.folder = { _id: folder_id, fileRefs: [] }
        this.newFile = { _id: file_id }
        this.ProjectLocator.findElement = sinon.stub().yields(null, this.folder)
        this.ProjectEntityUpdateHandler.addFile = {
          mainTask: sinon.stub().yields(null, this.newFile)
        }

        return this.ProjectEntityUpdateHandler.upsertFile(
          project_id,
          folder_id,
          this.fileName,
          this.fileSystemPath,
          this.linkedFileData,
          userId,
          this.callback
        )
      })

      it('tries to find the folder', function() {
        return this.ProjectLocator.findElement
          .calledWith({ project_id, element_id: folder_id, type: 'folder' })
          .should.equal(true)
      })

      it('adds the file', function() {
        return this.ProjectEntityUpdateHandler.addFile.mainTask
          .calledWith(
            project_id,
            folder_id,
            this.fileName,
            this.fileSystemPath,
            this.linkedFileData,
            userId
          )
          .should.equal(true)
      })

      it('returns the file', function() {
        return this.callback.calledWith(null, this.newFile, true)
      })
    })

    describe('upserting a new file with an invalid name', function() {
      beforeEach(function() {
        this.folder = { _id: folder_id, fileRefs: [] }
        this.newFile = { _id: file_id }
        this.ProjectLocator.findElement = sinon.stub().yields(null, this.folder)
        this.ProjectEntityUpdateHandler.addFile = {
          mainTask: sinon.stub().yields(null, this.newFile)
        }

        return this.ProjectEntityUpdateHandler.upsertFile(
          project_id,
          folder_id,
          `*${this.fileName}`,
          this.fileSystemPath,
          this.linkedFileData,
          userId,
          this.callback
        )
      })

      it('returns an error', function() {
        const errorMatcher = sinon.match.instanceOf(Errors.InvalidNameError)
        return this.callback.calledWithMatch(errorMatcher).should.equal(true)
      })
    })
  })

  describe('upsertDocWithPath', function() {
    describe('upserting a doc', function() {
      beforeEach(function() {
        this.path = '/folder/doc.tex'
        this.newFolders = ['mock-a', 'mock-b']
        this.folder = { _id: folder_id }
        this.doc = { _id: doc_id }
        this.isNewDoc = true
        this.ProjectEntityUpdateHandler.mkdirp = {
          withoutLock: sinon.stub().yields(null, this.newFolders, this.folder)
        }
        this.ProjectEntityUpdateHandler.upsertDoc = {
          withoutLock: sinon.stub().yields(null, this.doc, this.isNewDoc)
        }

        return this.ProjectEntityUpdateHandler.upsertDocWithPath(
          project_id,
          this.path,
          this.docLines,
          this.source,
          userId,
          this.callback
        )
      })

      it('creates any necessary folders', function() {
        return this.ProjectEntityUpdateHandler.mkdirp.withoutLock
          .calledWith(project_id, '/folder')
          .should.equal(true)
      })

      it('upserts the doc', function() {
        return this.ProjectEntityUpdateHandler.upsertDoc.withoutLock
          .calledWith(
            project_id,
            this.folder._id,
            'doc.tex',
            this.docLines,
            this.source,
            userId
          )
          .should.equal(true)
      })

      it('calls the callback', function() {
        return this.callback
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

    describe('upserting a doc with an invalid path', function() {
      beforeEach(function() {
        this.path = '/*folder/doc.tex'
        this.newFolders = ['mock-a', 'mock-b']
        this.folder = { _id: folder_id }
        this.doc = { _id: doc_id }
        this.isNewDoc = true
        this.ProjectEntityUpdateHandler.mkdirp = {
          withoutLock: sinon.stub().yields(null, this.newFolders, this.folder)
        }
        this.ProjectEntityUpdateHandler.upsertDoc = {
          withoutLock: sinon.stub().yields(null, this.doc, this.isNewDoc)
        }

        return this.ProjectEntityUpdateHandler.upsertDocWithPath(
          project_id,
          this.path,
          this.docLines,
          this.source,
          userId,
          this.callback
        )
      })

      it('returns an error', function() {
        const errorMatcher = sinon.match.instanceOf(Errors.InvalidNameError)
        return this.callback.calledWithMatch(errorMatcher).should.equal(true)
      })
    })

    describe('upserting a doc with an invalid name', function() {
      beforeEach(function() {
        this.path = '/folder/*doc.tex'
        this.newFolders = ['mock-a', 'mock-b']
        this.folder = { _id: folder_id }
        this.doc = { _id: doc_id }
        this.isNewDoc = true
        this.ProjectEntityUpdateHandler.mkdirp = {
          withoutLock: sinon.stub().yields(null, this.newFolders, this.folder)
        }
        this.ProjectEntityUpdateHandler.upsertDoc = {
          withoutLock: sinon.stub().yields(null, this.doc, this.isNewDoc)
        }

        return this.ProjectEntityUpdateHandler.upsertDocWithPath(
          project_id,
          this.path,
          this.docLines,
          this.source,
          userId,
          this.callback
        )
      })

      it('returns an error', function() {
        const errorMatcher = sinon.match.instanceOf(Errors.InvalidNameError)
        return this.callback.calledWithMatch(errorMatcher).should.equal(true)
      })
    })
  })

  describe('upsertFileWithPath', function() {
    describe('upserting a file', function() {
      beforeEach(function() {
        this.path = '/folder/file.png'
        this.newFolders = ['mock-a', 'mock-b']
        this.folder = { _id: folder_id }
        this.file = { _id: file_id }
        this.isNewFile = true
        this.FileStoreHandler.uploadFileFromDisk = sinon
          .stub()
          .yields(null, this.fileUrl, this.newFile)
        this.ProjectEntityUpdateHandler.mkdirp = {
          withoutLock: sinon.stub().yields(null, this.newFolders, this.folder)
        }
        this.ProjectEntityUpdateHandler.upsertFile = {
          mainTask: sinon.stub().yields(null, this.file, this.isNewFile)
        }

        return this.ProjectEntityUpdateHandler.upsertFileWithPath(
          project_id,
          this.path,
          this.fileSystemPath,
          this.linkedFileData,
          userId,
          this.callback
        )
      })

      it('creates any necessary folders', function() {
        return this.ProjectEntityUpdateHandler.mkdirp.withoutLock
          .calledWith(project_id, '/folder')
          .should.equal(true)
      })

      it('upserts the file', function() {
        return this.ProjectEntityUpdateHandler.upsertFile.mainTask
          .calledWith(
            project_id,
            this.folder._id,
            'file.png',
            this.fileSystemPath,
            this.linkedFileData,
            userId
          )
          .should.equal(true)
      })

      it('calls the callback', function() {
        return this.callback
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

    describe('upserting a file with an invalid path', function() {
      beforeEach(function() {
        this.path = '/*folder/file.png'
        this.newFolders = ['mock-a', 'mock-b']
        this.folder = { _id: folder_id }
        this.file = { _id: file_id }
        this.isNewFile = true
        this.ProjectEntityUpdateHandler.mkdirp = {
          withoutLock: sinon.stub().yields(null, this.newFolders, this.folder)
        }
        this.ProjectEntityUpdateHandler.upsertFile = {
          mainTask: sinon.stub().yields(null, this.file, this.isNewFile)
        }

        return this.ProjectEntityUpdateHandler.upsertFileWithPath(
          project_id,
          this.path,
          this.fileSystemPath,
          this.linkedFileData,
          userId,
          this.callback
        )
      })

      it('returns an error', function() {
        const errorMatcher = sinon.match.instanceOf(Errors.InvalidNameError)
        return this.callback.calledWithMatch(errorMatcher).should.equal(true)
      })
    })

    describe('upserting a file with an invalid name', function() {
      beforeEach(function() {
        this.path = '/folder/*file.png'
        this.newFolders = ['mock-a', 'mock-b']
        this.folder = { _id: folder_id }
        this.file = { _id: file_id }
        this.isNewFile = true
        this.ProjectEntityUpdateHandler.mkdirp = {
          withoutLock: sinon.stub().yields(null, this.newFolders, this.folder)
        }
        this.ProjectEntityUpdateHandler.upsertFile = {
          mainTask: sinon.stub().yields(null, this.file, this.isNewFile)
        }

        return this.ProjectEntityUpdateHandler.upsertFileWithPath(
          project_id,
          this.path,
          this.fileSystemPath,
          this.linkedFileData,
          userId,
          this.callback
        )
      })

      it('returns an error', function() {
        const errorMatcher = sinon.match.instanceOf(Errors.InvalidNameError)
        return this.callback.calledWithMatch(errorMatcher).should.equal(true)
      })
    })
  })

  describe('deleteEntity', function() {
    beforeEach(function() {
      this.path = '/path/to/doc.tex'
      this.doc = { _id: doc_id }
      this.projectBeforeDeletion = { _id: project_id, name: 'project' }
      this.newProject = 'new-project'
      this.ProjectEntityMongoUpdateHandler.deleteEntity = sinon
        .stub()
        .yields(
          null,
          this.doc,
          { fileSystem: this.path },
          this.projectBeforeDeletion,
          this.newProject
        )
      this.ProjectEntityUpdateHandler._cleanUpEntity = sinon.stub().yields()
      this.TpdsUpdateSender.deleteEntity = sinon.stub().yields()

      return this.ProjectEntityUpdateHandler.deleteEntity(
        project_id,
        doc_id,
        'doc',
        userId,
        this.callback
      )
    })

    it('deletes the entity in mongo', function() {
      return this.ProjectEntityMongoUpdateHandler.deleteEntity
        .calledWith(project_id, doc_id, 'doc')
        .should.equal(true)
    })

    it('cleans up the doc in the docstore', function() {
      return this.ProjectEntityUpdateHandler._cleanUpEntity
        .calledWith(
          this.projectBeforeDeletion,
          this.newProject,
          this.doc,
          'doc',
          this.path,
          userId
        )
        .should.equal(true)
    })

    it('it notifies the tpds', function() {
      return this.TpdsUpdateSender.deleteEntity
        .calledWith({
          project_id,
          path: this.path,
          project_name: this.projectBeforeDeletion.name
        })
        .should.equal(true)
    })

    it('retuns the entity_id', function() {
      return this.callback.calledWith(null, doc_id).should.equal(true)
    })
  })

  describe('deleteEntityWithPath', function() {
    describe('when the entity exists', function() {
      beforeEach(function() {
        this.doc = { _id: doc_id }
        this.ProjectLocator.findElementByPath = sinon
          .stub()
          .yields(null, this.doc, 'doc')
        this.ProjectEntityUpdateHandler.deleteEntity = {
          withoutLock: sinon.stub().yields()
        }
        this.path = '/path/to/doc.tex'
        return this.ProjectEntityUpdateHandler.deleteEntityWithPath(
          project_id,
          this.path,
          userId,
          this.callback
        )
      })

      it('finds the entity', function() {
        return this.ProjectLocator.findElementByPath
          .calledWith({ project_id, path: this.path })
          .should.equal(true)
      })

      it('deletes the entity', function() {
        return this.ProjectEntityUpdateHandler.deleteEntity.withoutLock
          .calledWith(project_id, this.doc._id, 'doc', userId, this.callback)
          .should.equal(true)
      })
    })

    describe('when the entity does not exist', function() {
      beforeEach(function() {
        this.ProjectLocator.findElementByPath = sinon.stub().yields()
        this.path = '/doc.tex'
        return this.ProjectEntityUpdateHandler.deleteEntityWithPath(
          project_id,
          this.path,
          userId,
          this.callback
        )
      })

      it('returns an error', function() {
        return this.callback
          .calledWith(new Errors.NotFoundError())
          .should.equal(true)
      })
    })
  })

  describe('mkdirp', function() {
    beforeEach(function() {
      this.docPath = '/folder/doc.tex'
      this.ProjectEntityMongoUpdateHandler.mkdirp = sinon.stub().yields()
      return this.ProjectEntityUpdateHandler.mkdirp(
        project_id,
        this.docPath,
        this.callback
      )
    })

    it('calls ProjectEntityMongoUpdateHandler', function() {
      return this.ProjectEntityMongoUpdateHandler.mkdirp
        .calledWith(project_id, this.docPath)
        .should.equal(true)
    })
  })

  describe('mkdirpWithExactCase', function() {
    beforeEach(function() {
      this.docPath = '/folder/doc.tex'
      this.ProjectEntityMongoUpdateHandler.mkdirp = sinon.stub().yields()
      return this.ProjectEntityUpdateHandler.mkdirpWithExactCase(
        project_id,
        this.docPath,
        this.callback
      )
    })

    it('calls ProjectEntityMongoUpdateHandler', function() {
      return this.ProjectEntityMongoUpdateHandler.mkdirp
        .calledWith(project_id, this.docPath, { exactCaseMatch: true })
        .should.equal(true)
    })
  })

  describe('addFolder', function() {
    describe('adding a folder', function() {
      beforeEach(function() {
        this.parentFolder_id = '123asdf'
        this.folderName = 'new-folder'
        this.ProjectEntityMongoUpdateHandler.addFolder = sinon.stub().yields()
        return this.ProjectEntityUpdateHandler.addFolder(
          project_id,
          this.parentFolder_id,
          this.folderName,
          this.callback
        )
      })

      it('calls ProjectEntityMongoUpdateHandler', function() {
        return this.ProjectEntityMongoUpdateHandler.addFolder
          .calledWith(project_id, this.parentFolder_id, this.folderName)
          .should.equal(true)
      })
    })

    describe('adding a folder with an invalid name', function() {
      beforeEach(function() {
        this.parentFolder_id = '123asdf'
        this.folderName = '*new-folder'
        this.ProjectEntityMongoUpdateHandler.addFolder = sinon.stub().yields()
        return this.ProjectEntityUpdateHandler.addFolder(
          project_id,
          this.parentFolder_id,
          this.folderName,
          this.callback
        )
      })

      it('returns an error', function() {
        const errorMatcher = sinon.match.instanceOf(Errors.InvalidNameError)
        return this.callback.calledWithMatch(errorMatcher).should.equal(true)
      })
    })
  })

  describe('moveEntity', function() {
    beforeEach(function() {
      this.project_name = 'project name'
      this.startPath = '/a.tex'
      this.endPath = '/folder/b.tex'
      this.rev = 2
      this.changes = { newDocs: ['old-doc'], newFiles: ['old-file'] }
      this.ProjectEntityMongoUpdateHandler.moveEntity = sinon
        .stub()
        .yields(
          null,
          this.project,
          this.startPath,
          this.endPath,
          this.rev,
          this.changes
        )
      this.TpdsUpdateSender.moveEntity = sinon.stub()
      this.DocumentUpdaterHandler.updateProjectStructure = sinon.stub()

      return this.ProjectEntityUpdateHandler.moveEntity(
        project_id,
        doc_id,
        folder_id,
        'doc',
        userId,
        this.callback
      )
    })

    it('moves the entity in mongo', function() {
      return this.ProjectEntityMongoUpdateHandler.moveEntity
        .calledWith(project_id, doc_id, folder_id, 'doc')
        .should.equal(true)
    })

    it('notifies tpds', function() {
      return this.TpdsUpdateSender.moveEntity
        .calledWith({
          project_id,
          project_name: this.project_name,
          startPath: this.startPath,
          endPath: this.endPath,
          rev: this.rev
        })
        .should.equal(true)
    })

    it('sends the changes in project structure to the doc updater', function() {
      return this.DocumentUpdaterHandler.updateProjectStructure
        .calledWith(
          project_id,
          projectHistoryId,
          userId,
          this.changes,
          this.callback
        )
        .should.equal(true)
    })
  })

  describe('renameEntity', function() {
    describe('renaming an entity', function() {
      beforeEach(function() {
        this.project_name = 'project name'
        this.startPath = '/folder/a.tex'
        this.endPath = '/folder/b.tex'
        this.rev = 2
        this.changes = { newDocs: ['old-doc'], newFiles: ['old-file'] }
        this.newDocName = 'b.tex'
        this.ProjectEntityMongoUpdateHandler.renameEntity = sinon
          .stub()
          .yields(
            null,
            this.project,
            this.startPath,
            this.endPath,
            this.rev,
            this.changes
          )
        this.TpdsUpdateSender.moveEntity = sinon.stub()
        this.DocumentUpdaterHandler.updateProjectStructure = sinon.stub()

        return this.ProjectEntityUpdateHandler.renameEntity(
          project_id,
          doc_id,
          'doc',
          this.newDocName,
          userId,
          this.callback
        )
      })

      it('moves the entity in mongo', function() {
        return this.ProjectEntityMongoUpdateHandler.renameEntity
          .calledWith(project_id, doc_id, 'doc', this.newDocName)
          .should.equal(true)
      })

      it('notifies tpds', function() {
        return this.TpdsUpdateSender.moveEntity
          .calledWith({
            project_id,
            project_name: this.project_name,
            startPath: this.startPath,
            endPath: this.endPath,
            rev: this.rev
          })
          .should.equal(true)
      })

      it('sends the changes in project structure to the doc updater', function() {
        return this.DocumentUpdaterHandler.updateProjectStructure
          .calledWith(
            project_id,
            projectHistoryId,
            userId,
            this.changes,
            this.callback
          )
          .should.equal(true)
      })
    })

    describe('renaming an entity to an invalid name', function() {
      beforeEach(function() {
        this.project_name = 'project name'
        this.startPath = '/folder/a.tex'
        this.endPath = '/folder/b.tex'
        this.rev = 2
        this.changes = { newDocs: ['old-doc'], newFiles: ['old-file'] }
        this.newDocName = '*b.tex'
        this.ProjectEntityMongoUpdateHandler.renameEntity = sinon
          .stub()
          .yields(
            null,
            this.project,
            this.startPath,
            this.endPath,
            this.rev,
            this.changes
          )
        this.TpdsUpdateSender.moveEntity = sinon.stub()
        this.DocumentUpdaterHandler.updateProjectStructure = sinon.stub()

        return this.ProjectEntityUpdateHandler.renameEntity(
          project_id,
          doc_id,
          'doc',
          this.newDocName,
          userId,
          this.callback
        )
      })

      it('returns an error', function() {
        const errorMatcher = sinon.match.instanceOf(Errors.InvalidNameError)
        return this.callback.calledWithMatch(errorMatcher).should.equal(true)
      })
    })
  })

  describe('resyncProjectHistory', function() {
    describe('a deleted project', function() {
      beforeEach(function() {
        this.ProjectGetter.getProject = sinon.stub().yields()

        return this.ProjectEntityUpdateHandler.resyncProjectHistory(
          project_id,
          this.callback
        )
      })

      it('should return an error', function() {
        const error = new Errors.ProjectHistoryDisabledError(
          `project history not enabled for ${project_id}`
        )
        return this.callback.calledWith(error).should.equal(true)
      })
    })

    describe('a project without project-history enabled', function() {
      beforeEach(function() {
        this.project.overleaf = {}
        this.ProjectGetter.getProject = sinon.stub().yields(null, this.project)

        return this.ProjectEntityUpdateHandler.resyncProjectHistory(
          project_id,
          this.callback
        )
      })

      it('should return an error', function() {
        const error = new Errors.ProjectHistoryDisabledError(
          `project history not enabled for ${project_id}`
        )
        return this.callback.calledWith(error).should.equal(true)
      })
    })

    describe('a project with project-history enabled', function() {
      beforeEach(function() {
        this.ProjectGetter.getProject = sinon.stub().yields(null, this.project)
        const docs = [
          {
            doc: {
              _id: doc_id
            },
            path: 'main.tex'
          }
        ]
        const files = [
          {
            file: {
              _id: file_id
            },
            path: 'universe.png'
          }
        ]
        this.ProjectEntityHandler.getAllEntitiesFromProject = sinon
          .stub()
          .yields(null, docs, files)
        this.FileStoreHandler._buildUrl = (project_id, file_id) =>
          `www.filestore.test/${project_id}/${file_id}`
        this.DocumentUpdaterHandler.resyncProjectHistory = sinon.stub().yields()

        return this.ProjectEntityUpdateHandler.resyncProjectHistory(
          project_id,
          this.callback
        )
      })

      it('gets the project', function() {
        return this.ProjectGetter.getProject
          .calledWith(project_id)
          .should.equal(true)
      })

      it('gets the entities for the project', function() {
        return this.ProjectEntityHandler.getAllEntitiesFromProject
          .calledWith(this.project)
          .should.equal(true)
      })

      it('tells the doc updater to sync the project', function() {
        const docs = [
          {
            doc: doc_id,
            path: 'main.tex'
          }
        ]
        const files = [
          {
            file: file_id,
            path: 'universe.png',
            url: `www.filestore.test/${project_id}/${file_id}`
          }
        ]
        return this.DocumentUpdaterHandler.resyncProjectHistory
          .calledWith(project_id, projectHistoryId, docs, files)
          .should.equal(true)
      })

      it('calls the callback', function() {
        return this.callback.called.should.equal(true)
      })
    })
  })

  describe('_cleanUpEntity', function() {
    beforeEach(function() {
      this.entity_id = '4eecaffcbffa66588e000009'
      this.FileStoreHandler.deleteFile = sinon.stub().yields()
      this.DocumentUpdaterHandler.deleteDoc = sinon.stub().yields()
      this.ProjectEntityUpdateHandler.unsetRootDoc = sinon.stub().yields()
      return (this.ProjectEntityMongoUpdateHandler._insertDeletedFileReference = sinon
        .stub()
        .yields())
    })

    describe('a file', function() {
      beforeEach(function(done) {
        this.path = '/file/system/path.png'
        this.entity = { _id: this.entity_id }
        this.newProject = 'new-project'
        return this.ProjectEntityUpdateHandler._cleanUpEntity(
          this.project,
          this.newProject,
          this.entity,
          'file',
          this.path,
          userId,
          done
        )
      })

      it('should insert the file into the deletedFiles array', function() {
        return this.ProjectEntityMongoUpdateHandler._insertDeletedFileReference
          .calledWith(this.project._id, this.entity)
          .should.equal(true)
      })

      it('should not delete the file from FileStoreHandler', function() {
        return this.FileStoreHandler.deleteFile
          .calledWith(project_id, this.entity_id)
          .should.equal(false)
      })

      it('should not attempt to delete from the document updater', function() {
        return this.DocumentUpdaterHandler.deleteDoc.called.should.equal(false)
      })

      it('should should send the update to the doc updater', function() {
        const oldFiles = [{ file: this.entity, path: this.path }]
        return this.DocumentUpdaterHandler.updateProjectStructure
          .calledWith(project_id, projectHistoryId, userId, {
            oldFiles,
            newProject: this.newProject
          })
          .should.equal(true)
      })
    })

    describe('a doc', function() {
      beforeEach(function(done) {
        this.path = '/file/system/path.tex'
        this.ProjectEntityUpdateHandler._cleanUpDoc = sinon.stub().yields()
        this.entity = { _id: this.entity_id }
        this.newProject = 'new-project'
        return this.ProjectEntityUpdateHandler._cleanUpEntity(
          this.project,
          this.newProject,
          this.entity,
          'doc',
          this.path,
          userId,
          done
        )
      })

      it('should clean up the doc', function() {
        return this.ProjectEntityUpdateHandler._cleanUpDoc
          .calledWith(this.project, this.entity, this.path, userId)
          .should.equal(true)
      })

      it('should should send the update to the doc updater', function() {
        const oldDocs = [{ doc: this.entity, path: this.path }]
        return this.DocumentUpdaterHandler.updateProjectStructure
          .calledWith(project_id, projectHistoryId, userId, {
            oldDocs,
            newProject: this.newProject
          })
          .should.equal(true)
      })
    })

    describe('a folder', function() {
      beforeEach(function(done) {
        this.folder = {
          folders: [
            {
              name: 'subfolder',
              fileRefs: [
                (this.file1 = { _id: 'file-id-1', name: 'file-name-1' })
              ],
              docs: [(this.doc1 = { _id: 'doc-id-1', name: 'doc-name-1' })],
              folders: []
            }
          ],
          fileRefs: [(this.file2 = { _id: 'file-id-2', name: 'file-name-2' })],
          docs: [(this.doc2 = { _id: 'doc-id-2', name: 'doc-name-2' })]
        }

        this.ProjectEntityUpdateHandler._cleanUpDoc = sinon.stub().yields()
        this.ProjectEntityUpdateHandler._cleanUpFile = sinon.stub().yields()
        const path = '/folder'
        this.newProject = 'new-project'
        return this.ProjectEntityUpdateHandler._cleanUpEntity(
          this.project,
          this.newProject,
          this.folder,
          'folder',
          path,
          userId,
          done
        )
      })

      it('should clean up all sub files', function() {
        this.ProjectEntityUpdateHandler._cleanUpFile
          .calledWith(
            this.project,
            this.file1,
            '/folder/subfolder/file-name-1',
            userId
          )
          .should.equal(true)
        return this.ProjectEntityUpdateHandler._cleanUpFile
          .calledWith(this.project, this.file2, '/folder/file-name-2', userId)
          .should.equal(true)
      })

      it('should clean up all sub docs', function() {
        this.ProjectEntityUpdateHandler._cleanUpDoc
          .calledWith(
            this.project,
            this.doc1,
            '/folder/subfolder/doc-name-1',
            userId
          )
          .should.equal(true)
        return this.ProjectEntityUpdateHandler._cleanUpDoc
          .calledWith(this.project, this.doc2, '/folder/doc-name-2', userId)
          .should.equal(true)
      })

      it('should should send one update to the doc updater for all docs and files', function() {
        const oldFiles = [
          { file: this.file2, path: '/folder/file-name-2' },
          { file: this.file1, path: '/folder/subfolder/file-name-1' }
        ]
        const oldDocs = [
          { doc: this.doc2, path: '/folder/doc-name-2' },
          { doc: this.doc1, path: '/folder/subfolder/doc-name-1' }
        ]
        return this.DocumentUpdaterHandler.updateProjectStructure
          .calledWith(project_id, projectHistoryId, userId, {
            oldFiles,
            oldDocs,
            newProject: this.newProject
          })
          .should.equal(true)
      })
    })
  })

  describe('_cleanUpDoc', function() {
    beforeEach(function() {
      this.doc = {
        _id: ObjectId(),
        name: 'test.tex'
      }
      this.path = '/path/to/doc'
      this.ProjectEntityUpdateHandler.unsetRootDoc = sinon.stub().yields()
      this.ProjectEntityMongoUpdateHandler._insertDeletedDocReference = sinon
        .stub()
        .yields()
      this.DocumentUpdaterHandler.deleteDoc = sinon.stub().yields()
      this.DocstoreManager.deleteDoc = sinon.stub().yields()
      return (this.callback = sinon.stub())
    })

    describe('when the doc is the root doc', function() {
      beforeEach(function() {
        this.project.rootDoc_id = this.doc._id
        return this.ProjectEntityUpdateHandler._cleanUpDoc(
          this.project,
          this.doc,
          this.path,
          userId,
          this.callback
        )
      })

      it('should unset the root doc', function() {
        return this.ProjectEntityUpdateHandler.unsetRootDoc
          .calledWith(project_id)
          .should.equal(true)
      })

      it('should delete the doc in the doc updater', function() {
        return this.DocumentUpdaterHandler.deleteDoc.calledWith(
          project_id,
          this.doc._id.toString()
        )
      })

      it('should insert the doc into the deletedDocs array', function() {
        return this.ProjectEntityMongoUpdateHandler._insertDeletedDocReference
          .calledWith(this.project._id, this.doc)
          .should.equal(true)
      })

      it('should delete the doc in the doc store', function() {
        return this.DocstoreManager.deleteDoc
          .calledWith(project_id, this.doc._id.toString())
          .should.equal(true)
      })

      it('should call the callback', function() {
        return this.callback.called.should.equal(true)
      })
    })

    describe('when the doc is not the root doc', function() {
      beforeEach(function() {
        this.project.rootDoc_id = ObjectId()
        return this.ProjectEntityUpdateHandler._cleanUpDoc(
          this.project,
          this.doc,
          this.path,
          userId,
          this.callback
        )
      })

      it('should not unset the root doc', function() {
        return this.ProjectEntityUpdateHandler.unsetRootDoc.called.should.equal(
          false
        )
      })

      it('should call the callback', function() {
        return this.callback.called.should.equal(true)
      })
    })
  })
})
