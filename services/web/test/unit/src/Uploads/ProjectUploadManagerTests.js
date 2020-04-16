const sinon = require('sinon')
const { expect } = require('chai')
const timekeeper = require('timekeeper')
const SandboxedModule = require('sandboxed-module')

const MODULE_PATH =
  '../../../../app/src/Features/Uploads/ProjectUploadManager.js'

describe('ProjectUploadManager', function() {
  beforeEach(function() {
    this.now = Date.now()
    timekeeper.freeze(this.now)
    this.project_id = 'project-id-123'
    this.folder_id = 'folder-id-123'
    this.owner_id = 'owner-id-123'
    this.source = '/path/to/zip/file-name.zip'
    this.destination = `/path/to/zip/file-name-${this.now}`
    this.root_folder_id = this.folder_id
    this.owner_id = 'owner-id-123'
    this.name = 'Project name'
    this.othername = 'Other name'
    this.project = {
      _id: this.project_id,
      rootFolder: [{ _id: this.root_folder_id }]
    }
    this.topLevelDestination = '/path/to/zip/file-extracted/nested'

    this.fs = {
      remove: sinon.stub().resolves()
    }
    this.ArchiveManager = {
      promises: {
        extractZipArchive: sinon.stub().resolves(),
        findTopLevelDirectory: sinon.stub().resolves(this.topLevelDestination)
      }
    }
    this.FileSystemImportManager = {
      promises: {
        addFolderContents: sinon.stub().resolves()
      }
    }
    this.ProjectCreationHandler = {
      promises: {
        createBlankProject: sinon.stub().resolves(this.project)
      }
    }
    this.ProjectRootDocManager = {
      promises: {
        setRootDocAutomatically: sinon.stub().resolves(),
        findRootDocFileFromDirectory: sinon
          .stub()
          .resolves({ path: 'main.tex', content: this.othername }),
        setRootDocFromName: sinon.stub().resolves()
      }
    }
    this.ProjectDetailsHandler = {
      fixProjectName: sinon.stub().returnsArg(0),
      promises: {
        generateUniqueName: sinon.stub().resolves(this.othername)
      }
    }
    this.ProjectDeleter = {
      promises: {
        deleteProject: sinon.stub().resolves()
      }
    }
    this.DocumentHelper = {
      getTitleFromTexContent: sinon.stub().returns(this.othername)
    }

    this.ProjectUploadManager = SandboxedModule.require(MODULE_PATH, {
      globals: {
        console: console
      },
      requires: {
        'fs-extra': this.fs,
        './FileSystemImportManager': this.FileSystemImportManager,
        './ArchiveManager': this.ArchiveManager,
        '../Project/ProjectCreationHandler': this.ProjectCreationHandler,
        '../Project/ProjectRootDocManager': this.ProjectRootDocManager,
        '../Project/ProjectDetailsHandler': this.ProjectDetailsHandler,
        '../Project/ProjectDeleter': this.ProjectDeleter,
        '../Documents/DocumentHelper': this.DocumentHelper
      }
    })
  })

  afterEach(function() {
    timekeeper.reset()
  })

  describe('createProjectFromZipArchive', function() {
    describe('when the title can be read from the root document', function() {
      beforeEach(async function() {
        await this.ProjectUploadManager.promises.createProjectFromZipArchive(
          this.owner_id,
          this.name,
          this.source
        )
      })

      it('should extract the archive', function() {
        this.ArchiveManager.promises.extractZipArchive.should.have.been.calledWith(
          this.source,
          this.destination
        )
      })

      it('should find the top level directory', function() {
        this.ArchiveManager.promises.findTopLevelDirectory.should.have.been.calledWith(
          this.destination
        )
      })

      it('should insert the extracted archive into the folder', function() {
        this.FileSystemImportManager.promises.addFolderContents.should.have.been.calledWith(
          this.owner_id,
          this.project_id,
          this.folder_id,
          this.topLevelDestination,
          false
        )
      })

      it('should create a project owned by the owner_id', function() {
        this.ProjectCreationHandler.promises.createBlankProject.should.have.been.calledWith(
          this.owner_id
        )
      })

      it('should create a project with the correct name', function() {
        this.ProjectCreationHandler.promises.createBlankProject.should.have.been.calledWith(
          sinon.match.any,
          this.othername
        )
      })

      it('should read the title from the tex contents', function() {
        this.DocumentHelper.getTitleFromTexContent.should.have.been.called
      })

      it('should set the root document', function() {
        this.ProjectRootDocManager.promises.setRootDocFromName.should.have.been.calledWith(
          this.project_id,
          'main.tex'
        )
      })

      it('should ensure the name is valid', function() {
        this.ProjectDetailsHandler.fixProjectName.should.have.been.called
      })
    })

    describe("when the root document can't be determined", function() {
      beforeEach(async function() {
        this.ProjectRootDocManager.promises.findRootDocFileFromDirectory.resolves(
          {}
        )
        await this.ProjectUploadManager.promises.createProjectFromZipArchive(
          this.owner_id,
          this.name,
          this.source
        )
      })

      it('should not try to set the root doc', function() {
        this.ProjectRootDocManager.promises.setRootDocFromName.should.not.have
          .been.called
      })
    })
  })

  describe('createProjectFromZipArchiveWithName', function() {
    beforeEach(async function() {
      await this.ProjectUploadManager.promises.createProjectFromZipArchiveWithName(
        this.owner_id,
        this.name,
        this.source
      )
    })

    it('should create a project owned by the owner_id', function() {
      this.ProjectCreationHandler.promises.createBlankProject.should.have.been.calledWith(
        this.owner_id
      )
    })

    it('should create a project with the correct name', function() {
      this.ProjectCreationHandler.promises.createBlankProject.should.have.been.calledWith(
        sinon.match.any,
        this.othername
      )
    })

    it('should automatically set the root doc', function() {
      this.ProjectRootDocManager.promises.setRootDocAutomatically.should.have.been.calledWith(
        this.project_id
      )
    })

    it('should extract the archive', function() {
      this.ArchiveManager.promises.extractZipArchive.should.have.been.calledWith(
        this.source,
        this.destination
      )
    })

    it('should find the top level directory', function() {
      this.ArchiveManager.promises.findTopLevelDirectory.should.have.been.calledWith(
        this.destination
      )
    })

    it('should insert the extracted archive into the folder', function() {
      this.FileSystemImportManager.promises.addFolderContents.should.have.been.calledWith(
        this.owner_id,
        this.project_id,
        this.folder_id,
        this.topLevelDestination,
        false
      )
    })

    it('should remove the destination directory afterwards', function() {
      this.fs.remove.should.have.been.calledWith(this.destination)
    })

    describe('when inserting the zip file contents into the root folder fails', function() {
      beforeEach(async function() {
        this.FileSystemImportManager.promises.addFolderContents.rejects()
        await expect(
          this.ProjectUploadManager.promises.createProjectFromZipArchiveWithName(
            this.owner_id,
            this.name,
            this.source
          )
        ).to.be.rejected
      })

      it('should cleanup the blank project created', async function() {
        this.ProjectDeleter.promises.deleteProject.should.have.been.calledWith(
          this.project_id
        )
      })
    })

    describe('when setting automatically the root doc fails', function() {
      beforeEach(async function() {
        this.ProjectRootDocManager.promises.setRootDocAutomatically.rejects()
        await expect(
          this.ProjectUploadManager.promises.createProjectFromZipArchiveWithName(
            this.owner_id,
            this.name,
            this.source
          )
        ).to.be.rejected
      })

      it('should cleanup the blank project created', function() {
        this.ProjectDeleter.promises.deleteProject.should.have.been.calledWith(
          this.project_id
        )
      })
    })
  })
})
