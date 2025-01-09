const { expect } = require('chai')
const sinon = require('sinon')
const SandboxedModule = require('sandboxed-module')
const { ObjectId } = require('mongodb-legacy')

const MODULE_PATH = '../../../../app/src/Features/Project/ProjectDuplicator.js'

describe('ProjectDuplicator', function () {
  beforeEach(function () {
    this.doc0 = { _id: 'doc0_id', name: 'rootDocHere' }
    this.doc1 = { _id: 'doc1_id', name: 'level1folderDocName' }
    this.doc2 = { _id: 'doc2_id', name: 'level2folderDocName' }
    this.doc0Lines = ['zero']
    this.doc1Lines = ['one']
    this.doc2Lines = ['two']
    this.file0 = { name: 'file0', _id: 'file0', hash: 'abcde' }
    this.file1 = { name: 'file1', _id: 'file1' }
    this.file2 = {
      name: 'file2',
      _id: 'file2',
      created: '2024-07-05T14:18:31.401+00:00',
      linkedFileData: { provider: 'url' },
      hash: '123456',
    }
    this.level2folder = {
      name: 'level2folderName',
      _id: 'level2folderId',
      docs: [this.doc2, undefined],
      folders: [],
      fileRefs: [this.file2],
    }
    this.level1folder = {
      name: 'level1folder',
      _id: 'level1folderId',
      docs: [this.doc1],
      folders: [this.level2folder],
      fileRefs: [this.file1, null], // the null is intentional to test null docs/files
    }
    this.rootFolder = {
      name: 'rootFolder',
      _id: 'rootFolderId',
      docs: [this.doc0],
      folders: [this.level1folder, {}],
      fileRefs: [this.file0],
    }
    this.project = {
      _id: 'this_is_the_old_project_id',
      rootDoc_id: this.doc0._id,
      rootFolder: [this.rootFolder],
      compiler: 'this_is_a_Compiler',
      overleaf: { history: { id: 123456 } },
    }
    this.doc0Path = '/rootDocHere'
    this.doc1Path = '/level1folder/level1folderDocName'
    this.doc2Path = '/level1folder/level2folderName/level2folderDocName'
    this.file0Path = '/file0'
    this.file1Path = '/level1folder/file1'
    this.file2Path = '/level1folder/level2folderName/file2'

    this.docContents = [
      { _id: this.doc0._id, lines: this.doc0Lines },
      { _id: this.doc1._id, lines: this.doc1Lines },
      { _id: this.doc2._id, lines: this.doc2Lines },
    ]

    this.rootDoc = this.doc0
    this.rootDocPath = '/rootDocHere'
    this.owner = { _id: 'this_is_the_owner' }
    this.newBlankProject = {
      _id: 'new_project_id',
      overleaf: { history: { id: 339123 } },
      readOnly_refs: [],
      collaberator_refs: [],
      rootFolder: [{ _id: 'new_root_folder_id' }],
    }
    this.newFolder = { _id: 'newFolderId' }
    this.filestoreUrl = 'filestore-url'
    this.newProjectVersion = 2

    this.newDocId = new ObjectId()
    this.newFileId = new ObjectId()
    this.newDoc0 = { ...this.doc0, _id: this.newDocId }
    this.newDoc1 = { ...this.doc1, _id: this.newDocId }
    this.newDoc2 = { ...this.doc2, _id: this.newDocId }
    this.newFile0 = { ...this.file0, _id: this.newFileId }
    this.newFile1 = { ...this.file1, _id: this.newFileId }
    this.newFile2 = { ...this.file2, _id: this.newFileId }

    this.docEntries = [
      {
        path: this.doc0Path,
        doc: this.newDoc0,
        docLines: this.doc0Lines.join('\n'),
      },
      {
        path: this.doc1Path,
        doc: this.newDoc1,
        docLines: this.doc1Lines.join('\n'),
      },
      {
        path: this.doc2Path,
        doc: this.newDoc2,
        docLines: this.doc2Lines.join('\n'),
      },
    ]
    this.fileEntries = [
      {
        createdBlob: false,
        path: this.file0Path,
        file: this.newFile0,
        url: this.filestoreUrl,
      },
      {
        createdBlob: false,
        path: this.file1Path,
        file: this.newFile1,
        url: this.filestoreUrl,
      },
      {
        createdBlob: true,
        path: this.file2Path,
        file: this.newFile2,
        url: null,
      },
    ]

    this.Doc = sinon
      .stub()
      .callsFake(props => ({ _id: this.newDocId, ...props }))
    this.File = sinon
      .stub()
      .callsFake(props => ({ _id: this.newFileId, ...props }))

    this.DocstoreManager = {
      promises: {
        updateDoc: sinon.stub().resolves(),
        getAllDocs: sinon.stub().resolves(this.docContents),
      },
    }
    this.DocumentUpdaterHandler = {
      promises: {
        flushProjectToMongo: sinon.stub().resolves(),
        updateProjectStructure: sinon.stub().resolves(),
      },
    }
    this.FileStoreHandler = {
      promises: {
        copyFile: sinon.stub().resolves(this.filestoreUrl),
      },
    }
    this.HistoryManager = {
      promises: {
        copyBlob: sinon.stub().callsFake((historyId, newHistoryId, hash) => {
          if (hash === 'abcde') {
            return Promise.reject(new Error('copy blob error'))
          }
          return Promise.resolve()
        }),
      },
    }
    this.TagsHandler = {
      promises: {
        addProjectToTags: sinon.stub().resolves({
          _id: 'project-1',
        }),
        countTagsForProject: sinon.stub().resolves(1),
      },
    }
    this.ProjectCreationHandler = {
      promises: {
        createBlankProject: sinon.stub().resolves(this.newBlankProject),
      },
    }
    this.ProjectDeleter = {
      promises: {
        deleteProject: sinon.stub().resolves(),
      },
    }
    this.ProjectEntityMongoUpdateHandler = {
      promises: {
        createNewFolderStructure: sinon.stub().resolves(this.newProjectVersion),
      },
    }
    this.ProjectEntityUpdateHandler = {
      isPathValidForRootDoc: sinon.stub().returns(true),
      promises: {
        setRootDoc: sinon.stub().resolves(),
      },
    }
    this.ProjectGetter = {
      promises: {
        getProject: sinon
          .stub()
          .withArgs(this.project._id)
          .resolves(this.project),
      },
    }
    this.ProjectLocator = {
      promises: {
        findRootDoc: sinon.stub().resolves({
          element: this.rootDoc,
          path: { fileSystem: this.rootDocPath },
        }),
        findElementByPath: sinon
          .stub()
          .withArgs({
            project_id: this.newBlankProject._id,
            path: this.rootDocPath,
            exactCaseMatch: true,
          })
          .resolves({ element: this.doc0 }),
      },
    }
    this.ProjectOptionsHandler = {
      promises: {
        setCompiler: sinon.stub().resolves(),
      },
    }
    this.TpdsProjectFlusher = {
      promises: {
        flushProjectToTpds: sinon.stub().resolves(),
      },
    }
    this.Features = {
      hasFeature: sinon.stub().withArgs('project-history-blobs').returns(true),
    }

    this.ProjectDuplicator = SandboxedModule.require(MODULE_PATH, {
      requires: {
        '../../models/Doc': { Doc: this.Doc },
        '../../models/File': { File: this.File },
        '../Docstore/DocstoreManager': this.DocstoreManager,
        '../DocumentUpdater/DocumentUpdaterHandler':
          this.DocumentUpdaterHandler,
        '../FileStore/FileStoreHandler': this.FileStoreHandler,
        './ProjectCreationHandler': this.ProjectCreationHandler,
        './ProjectDeleter': this.ProjectDeleter,
        './ProjectEntityMongoUpdateHandler':
          this.ProjectEntityMongoUpdateHandler,
        './ProjectEntityUpdateHandler': this.ProjectEntityUpdateHandler,
        './ProjectGetter': this.ProjectGetter,
        './ProjectLocator': this.ProjectLocator,
        './ProjectOptionsHandler': this.ProjectOptionsHandler,
        '../ThirdPartyDataStore/TpdsProjectFlusher': this.TpdsProjectFlusher,
        '../Tags/TagsHandler': this.TagsHandler,
        '../History/HistoryManager': this.HistoryManager,
        '../../infrastructure/Features': this.Features,
      },
    })
  })

  describe('when the copy succeeds', function () {
    beforeEach(async function () {
      this.newProjectName = 'New project name'
      this.newProject = await this.ProjectDuplicator.promises.duplicate(
        this.owner,
        this.project._id,
        this.newProjectName
      )
    })

    it('should flush the original project to mongo', function () {
      this.DocumentUpdaterHandler.promises.flushProjectToMongo.should.have.been.calledWith(
        this.project._id
      )
    })

    it('should copy docs to docstore', function () {
      for (const docLines of [this.doc0Lines, this.doc1Lines, this.doc2Lines]) {
        this.DocstoreManager.promises.updateDoc.should.have.been.calledWith(
          this.newProject._id.toString(),
          this.newDocId.toString(),
          docLines,
          0,
          {}
        )
      }
    })

    it('should duplicate the files with hashes by copying the blobs in history v1', function () {
      for (const file of [this.file0, this.file2]) {
        this.HistoryManager.promises.copyBlob.should.have.been.calledWith(
          this.project.overleaf.history.id,
          this.newProject.overleaf.history.id,
          file.hash
        )
      }
    })

    it('should ignore any errors when copying the blobs in history v1', async function () {
      await expect(
        this.HistoryManager.promises.copyBlob(
          this.project.overleaf.history.id,
          this.newProject.overleaf.history.id,
          this.file0.hash
        )
      ).to.be.rejectedWith('copy blob error')
    })

    it('should not try to copy the blobs for any files without hashes', function () {
      for (const file of [this.file1]) {
        this.HistoryManager.promises.copyBlob.should.not.have.been.calledWith(
          this.project.overleaf.history.id,
          this.newProject.overleaf.history.id,
          file.hash
        )
      }
    })

    it('should copy files to the filestore', function () {
      for (const file of [this.file0, this.file1]) {
        this.FileStoreHandler.promises.copyFile.should.have.been.calledWith(
          this.project._id,
          file._id,
          this.newProject._id,
          this.newFileId
        )
      }
    })

    it('should not copy files that have been sent to history-v1 to the filestore', function () {
      this.FileStoreHandler.promises.copyFile.should.not.have.been.calledWith(
        this.project._id,
        this.file2._id,
        this.newProject._id,
        this.newFileId
      )
    })

    it('should create a blank project', function () {
      this.ProjectCreationHandler.promises.createBlankProject.should.have.been.calledWith(
        this.owner._id,
        this.newProjectName
      )
      this.newProject._id.should.equal(this.newBlankProject._id)
    })

    it('should use the same compiler', function () {
      this.ProjectOptionsHandler.promises.setCompiler.should.have.been.calledWith(
        this.newProject._id,
        this.project.compiler
      )
    })

    it('should use the same root doc', function () {
      this.ProjectEntityUpdateHandler.promises.setRootDoc.should.have.been.calledWith(
        this.newProject._id,
        this.rootFolder.docs[0]._id
      )
    })

    it('should not copy the collaborators or read only refs', function () {
      this.newProject.collaberator_refs.length.should.equal(0)
      this.newProject.readOnly_refs.length.should.equal(0)
    })

    it('should copy all documents and files', function () {
      this.ProjectEntityMongoUpdateHandler.promises.createNewFolderStructure.should.have.been.calledWith(
        this.newProject._id,
        this.docEntries,
        this.fileEntries
      )
    })

    it('should notify document updater of changes', function () {
      this.DocumentUpdaterHandler.promises.updateProjectStructure.should.have.been.calledWith(
        this.newProject._id,
        this.newProject.overleaf.history.id,
        this.owner._id,
        {
          newDocs: this.docEntries,
          newFiles: this.fileEntries,
          newProject: { version: this.newProjectVersion },
        },
        null
      )
    })

    it('should flush the project to TPDS', function () {
      this.TpdsProjectFlusher.promises.flushProjectToTpds.should.have.been.calledWith(
        this.newProject._id
      )
    })
  })

  describe('without a root doc', function () {
    beforeEach(async function () {
      this.ProjectLocator.promises.findRootDoc.resolves({
        element: null,
        path: null,
      })
      this.newProject = await this.ProjectDuplicator.promises.duplicate(
        this.owner,
        this.project._id,
        'Copy of project'
      )
    })

    it('should not set the root doc on the copy', function () {
      this.ProjectEntityUpdateHandler.promises.setRootDoc.should.not.have.been
        .called
    })
  })

  describe('with an invalid root doc', function () {
    beforeEach(async function () {
      this.ProjectEntityUpdateHandler.isPathValidForRootDoc.returns(false)
      this.newProject = await this.ProjectDuplicator.promises.duplicate(
        this.owner,
        this.project._id,
        'Copy of project'
      )
    })

    it('should not set the root doc on the copy', function () {
      this.ProjectEntityUpdateHandler.promises.setRootDoc.should.not.have.been
        .called
    })
  })

  describe('when there is an error', function () {
    beforeEach(async function () {
      this.ProjectEntityMongoUpdateHandler.promises.createNewFolderStructure.rejects()
      await expect(
        this.ProjectDuplicator.promises.duplicate(
          this.owner,
          this.project._id,
          ''
        )
      ).to.be.rejected
    })

    it('should delete the broken cloned project', function () {
      this.ProjectDeleter.promises.deleteProject.should.have.been.calledWith(
        this.newBlankProject._id
      )
    })

    it('should not delete the original project', function () {
      this.ProjectDeleter.promises.deleteProject.should.not.have.been.calledWith(
        this.project._id
      )
    })
  })
})
