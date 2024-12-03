const sinon = require('sinon')
const { expect } = require('chai')
const timekeeper = require('timekeeper')
const SandboxedModule = require('sandboxed-module')
const { ObjectId } = require('mongodb-legacy')

const MODULE_PATH =
  '../../../../app/src/Features/Uploads/ProjectUploadManager.js'

describe('ProjectUploadManager', function () {
  beforeEach(function () {
    this.now = Date.now()
    timekeeper.freeze(this.now)
    this.rootFolderId = new ObjectId()
    this.ownerId = new ObjectId()
    this.zipPath = '/path/to/zip/file-name.zip'
    this.extractedZipPath = `/path/to/zip/file-name-${this.now}`
    this.mainContent = 'Contents of main.tex'
    this.projectName = 'My project*'
    this.fixedProjectName = 'My project'
    this.uniqueProjectName = 'My project (1)'
    this.project = {
      _id: new ObjectId(),
      rootFolder: [{ _id: this.rootFolderId }],
      overleaf: { history: { id: 12345 } },
    }
    this.doc = {
      _id: new ObjectId(),
      name: 'main.tex',
    }
    this.docFsPath = '/path/to/doc'
    this.docLines = ['My thesis', 'by A. U. Thor']
    this.file = {
      _id: new ObjectId(),
      name: 'image.png',
    }
    this.fileFsPath = '/path/to/file'

    this.topLevelDestination = '/path/to/zip/file-extracted/nested'
    this.newProjectVersion = 123
    this.importEntries = [
      {
        type: 'doc',
        projectPath: '/main.tex',
        lines: this.docLines,
      },
      {
        type: 'file',
        projectPath: `/${this.file.name}`,
        fsPath: this.fileFsPath,
      },
    ]
    this.docEntries = [
      {
        doc: this.doc,
        path: `/${this.doc.name}`,
        docLines: this.docLines.join('\n'),
      },
    ]
    this.fileEntries = [
      {
        file: this.file,
        path: `/${this.file.name}`,
        url: this.fileStoreUrl,
        createdBlob: true,
      },
    ]

    this.fs = {
      promises: {
        rm: sinon.stub().resolves(),
      },
    }
    this.ArchiveManager = {
      promises: {
        extractZipArchive: sinon.stub().resolves(),
        findTopLevelDirectory: sinon
          .stub()
          .withArgs(this.extractedZipPath)
          .resolves(this.topLevelDestination),
      },
    }
    this.Doc = sinon.stub().returns(this.doc)
    this.DocstoreManager = {
      promises: {
        updateDoc: sinon.stub().resolves(),
      },
    }
    this.DocumentHelper = {
      getTitleFromTexContent: sinon
        .stub()
        .withArgs(this.mainContent)
        .returns(this.projectName),
    }
    this.DocumentUpdaterHandler = {
      promises: {
        updateProjectStructure: sinon.stub().resolves(),
      },
    }
    this.FileStoreHandler = {
      promises: {
        uploadFileFromDiskWithHistoryId: sinon.stub().resolves({
          fileRef: this.file,
          url: this.fileStoreUrl,
          createdBlob: true,
        }),
      },
    }
    this.FileSystemImportManager = {
      promises: {
        importDir: sinon
          .stub()
          .withArgs(this.topLevelDestination)
          .resolves(this.importEntries),
      },
    }
    this.ProjectCreationHandler = {
      promises: {
        createBlankProject: sinon.stub().resolves(this.project),
      },
    }
    this.ProjectEntityMongoUpdateHandler = {
      promises: {
        createNewFolderStructure: sinon.stub().resolves(this.newProjectVersion),
      },
    }
    this.ProjectRootDocManager = {
      promises: {
        setRootDocAutomatically: sinon.stub().resolves(),
        findRootDocFileFromDirectory: sinon
          .stub()
          .resolves({ path: 'main.tex', content: this.mainContent }),
        setRootDocFromName: sinon.stub().resolves(),
      },
    }
    this.ProjectDetailsHandler = {
      fixProjectName: sinon
        .stub()
        .withArgs(this.projectName)
        .returns(this.fixedProjectName),
      promises: {
        generateUniqueName: sinon.stub().resolves(this.uniqueProjectName),
      },
    }
    this.ProjectDeleter = {
      promises: {
        deleteProject: sinon.stub().resolves(),
      },
    }
    this.TpdsProjectFlusher = {
      promises: {
        flushProjectToTpds: sinon.stub().resolves(),
      },
    }

    this.ProjectUploadManager = SandboxedModule.require(MODULE_PATH, {
      requires: {
        fs: this.fs,
        './ArchiveManager': this.ArchiveManager,
        '../../models/Doc': { Doc: this.Doc },
        '../Docstore/DocstoreManager': this.DocstoreManager,
        '../Documents/DocumentHelper': this.DocumentHelper,
        '../DocumentUpdater/DocumentUpdaterHandler':
          this.DocumentUpdaterHandler,
        '../FileStore/FileStoreHandler': this.FileStoreHandler,
        './FileSystemImportManager': this.FileSystemImportManager,
        '../Project/ProjectCreationHandler': this.ProjectCreationHandler,
        '../Project/ProjectEntityMongoUpdateHandler':
          this.ProjectEntityMongoUpdateHandler,
        '../Project/ProjectRootDocManager': this.ProjectRootDocManager,
        '../Project/ProjectDetailsHandler': this.ProjectDetailsHandler,
        '../Project/ProjectDeleter': this.ProjectDeleter,
        '../ThirdPartyDataStore/TpdsProjectFlusher': this.TpdsProjectFlusher,
      },
    })
  })

  afterEach(function () {
    timekeeper.reset()
  })

  describe('createProjectFromZipArchive', function () {
    describe('when the title can be read from the root document', function () {
      beforeEach(async function () {
        await this.ProjectUploadManager.promises.createProjectFromZipArchive(
          this.ownerId,
          this.projectName,
          this.zipPath
        )
      })

      it('should extract the archive', function () {
        this.ArchiveManager.promises.extractZipArchive.should.have.been.calledWith(
          this.zipPath,
          this.extractedZipPath
        )
      })

      it('should create a project', function () {
        this.ProjectCreationHandler.promises.createBlankProject.should.have.been.calledWith(
          this.ownerId,
          this.uniqueProjectName
        )
      })

      it('should initialize the file tree', function () {
        this.ProjectEntityMongoUpdateHandler.promises.createNewFolderStructure.should.have.been.calledWith(
          this.project._id,
          this.docEntries,
          this.fileEntries
        )
      })

      it('should notify document updater', function () {
        this.DocumentUpdaterHandler.promises.updateProjectStructure.should.have.been.calledWith(
          this.project._id,
          this.project.overleaf.history.id,
          this.ownerId,
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
          this.project._id
        )
      })

      it('should set the root document', function () {
        this.ProjectRootDocManager.promises.setRootDocFromName.should.have.been.calledWith(
          this.project._id,
          'main.tex'
        )
      })

      it('should remove the destination directory afterwards', function () {
        this.fs.promises.rm.should.have.been.calledWith(this.extractedZipPath, {
          recursive: true,
          force: true,
        })
      })
    })

    describe("when the root document can't be determined", function () {
      beforeEach(async function () {
        this.ProjectRootDocManager.promises.findRootDocFileFromDirectory.resolves(
          {}
        )
        await this.ProjectUploadManager.promises.createProjectFromZipArchive(
          this.ownerId,
          this.projectName,
          this.zipPath
        )
      })

      it('should not try to set the root doc', function () {
        this.ProjectRootDocManager.promises.setRootDocFromName.should.not.have
          .been.called
      })
    })
  })

  describe('createProjectFromZipArchiveWithName', function () {
    beforeEach(async function () {
      await this.ProjectUploadManager.promises.createProjectFromZipArchiveWithName(
        this.ownerId,
        this.projectName,
        this.zipPath
      )
    })

    it('should extract the archive', function () {
      this.ArchiveManager.promises.extractZipArchive.should.have.been.calledWith(
        this.zipPath,
        this.extractedZipPath
      )
    })

    it('should create a project owned by the owner_id', function () {
      this.ProjectCreationHandler.promises.createBlankProject.should.have.been.calledWith(
        this.ownerId,
        this.uniqueProjectName
      )
    })

    it('should automatically set the root doc', function () {
      this.ProjectRootDocManager.promises.setRootDocAutomatically.should.have.been.calledWith(
        this.project._id
      )
    })

    it('should initialize the file tree', function () {
      this.ProjectEntityMongoUpdateHandler.promises.createNewFolderStructure.should.have.been.calledWith(
        this.project._id,
        this.docEntries,
        this.fileEntries
      )
    })

    it('should notify document updater', function () {
      this.DocumentUpdaterHandler.promises.updateProjectStructure.should.have.been.calledWith(
        this.project._id,
        this.project.overleaf.history.id,
        this.ownerId,
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
        this.project._id
      )
    })

    it('should remove the destination directory afterwards', function () {
      this.fs.promises.rm.should.have.been.calledWith(this.extractedZipPath, {
        recursive: true,
        force: true,
      })
    })

    describe('when initializing the folder structure fails', function () {
      beforeEach(async function () {
        this.ProjectEntityMongoUpdateHandler.promises.createNewFolderStructure.rejects()
        await expect(
          this.ProjectUploadManager.promises.createProjectFromZipArchiveWithName(
            this.ownerId,
            this.projectName,
            this.zipPath
          )
        ).to.be.rejected
      })

      it('should cleanup the blank project created', async function () {
        this.ProjectDeleter.promises.deleteProject.should.have.been.calledWith(
          this.project._id
        )
      })
    })

    describe('when setting automatically the root doc fails', function () {
      beforeEach(async function () {
        this.ProjectRootDocManager.promises.setRootDocAutomatically.rejects()
        await expect(
          this.ProjectUploadManager.promises.createProjectFromZipArchiveWithName(
            this.ownerId,
            this.projectName,
            this.zipPath
          )
        ).to.be.rejected
      })

      it('should cleanup the blank project created', function () {
        this.ProjectDeleter.promises.deleteProject.should.have.been.calledWith(
          this.project._id
        )
      })
    })
  })
})
