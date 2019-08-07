/* eslint-disable
    max-len,
    no-return-assign,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const sinon = require('sinon')
const chai = require('chai')
const should = chai.should()
const modulePath =
  '../../../../app/src/Features/Uploads/ProjectUploadManager.js'
const SandboxedModule = require('sandboxed-module')

const promiseStub = val => new Promise(resolve => resolve(val))
const failedPromiseStub = err => new Promise((resolve, reject) => reject(err))

describe('ProjectUploadManager', function() {
  beforeEach(function() {
    this.project_id = 'project-id-123'
    this.folder_id = 'folder-id-123'
    this.owner_id = 'owner-id-123'
    this.callback = sinon.stub()
    this.source = '/path/to/zip/file-name.zip'
    this.destination = '/path/to/zile/file-extracted'
    this.root_folder_id = this.folder_id
    this.owner_id = 'owner-id-123'
    this.name = 'Project name'
    this.othername = 'Other name'
    this.project = {
      _id: this.project_id,
      rootFolder: [{ _id: this.root_folder_id }]
    }
    this.ProjectUploadManager = SandboxedModule.require(modulePath, {
      globals: {
        console: console
      },
      requires: {
        './FileSystemImportManager': (this.FileSystemImportManager = {}),
        './ArchiveManager': (this.ArchiveManager = { promises: {} }),
        '../Project/ProjectCreationHandler': (this.ProjectCreationHandler = {
          promises: {}
        }),
        '../Project/ProjectRootDocManager': (this.ProjectRootDocManager = {
          promises: {}
        }),
        '../Project/ProjectDetailsHandler': (this.ProjectDetailsHandler = {
          promises: {}
        }),
        '../Project/ProjectDeleter': (this.ProjectDeleter = {
          promises: {}
        }),
        '../Documents/DocumentHelper': (this.DocumentHelper = {}),
        rimraf: (this.rimraf = sinon.stub().callsArg(1))
      }
    })

    this.ArchiveManager.extractZipArchive = sinon.stub().callsArg(2)
    this.ArchiveManager.promises.extractZipArchive = sinon
      .stub()
      .returns(promiseStub())
    this.ArchiveManager.findTopLevelDirectory = sinon
      .stub()
      .callsArgWith(
        1,
        null,
        (this.topLevelDestination = '/path/to/zip/file-extracted/nested')
      )
    this.ProjectCreationHandler.promises.createBlankProject = sinon
      .stub()
      .returns(promiseStub(this.project))
    this.ProjectRootDocManager.promises.setRootDocAutomatically = sinon
      .stub()
      .returns(promiseStub())
    this.FileSystemImportManager.addFolderContents = sinon.stub().callsArg(5)
    this.ProjectRootDocManager.promises.findRootDocFileFromDirectory = sinon
      .stub()
      .returns(promiseStub({ path: 'main.tex', content: this.othername }))
    this.ProjectRootDocManager.promises.setRootDocFromName = sinon
      .stub()
      .returns(promiseStub())
    this.DocumentHelper.getTitleFromTexContent = sinon
      .stub()
      .returns(this.othername)
    return (this.ProjectDetailsHandler.fixProjectName = sinon
      .stub()
      .returnsArg(0))
  })

  describe('createProjectFromZipArchive', function() {
    describe('when the title can be read from the root document', function() {
      beforeEach(function(done) {
        this.ProjectUploadManager._getDestinationDirectory = sinon
          .stub()
          .returns(this.destination)
        this.ProjectDetailsHandler.promises.generateUniqueName = sinon
          .stub()
          .returns(promiseStub(this.othername))
        return this.ProjectUploadManager.createProjectFromZipArchive(
          this.owner_id,
          this.name,
          this.source,
          (err, project) => {
            this.callback(err, project)
            return done()
          }
        )
      })

      it('should set up the directory to extract the archive to', function() {
        this.ProjectUploadManager._getDestinationDirectory
          .calledWith(this.source)
          .should.equal(true)
      })

      it('should extract the archive', function() {
        this.ArchiveManager.promises.extractZipArchive
          .calledWith(this.source, this.destination)
          .should.equal(true)
      })

      it('should find the top level directory', function() {
        this.ArchiveManager.findTopLevelDirectory
          .calledWith(this.destination)
          .should.equal(true)
      })

      it('should insert the extracted archive into the folder', function() {
        this.FileSystemImportManager.addFolderContents
          .calledWith(
            this.owner_id,
            this.project_id,
            this.folder_id,
            this.topLevelDestination,
            false
          )
          .should.equal(true)
      })

      it('should create a project owned by the owner_id', function() {
        this.ProjectCreationHandler.promises.createBlankProject
          .calledWith(this.owner_id)
          .should.equal(true)
      })

      it('should create a project with the correct name', function() {
        this.ProjectCreationHandler.promises.createBlankProject
          .calledWith(sinon.match.any, this.othername)
          .should.equal(true)
      })

      it('should read the title from the tex contents', function() {
        this.DocumentHelper.getTitleFromTexContent.called.should.equal(true)
      })

      it('should set the root document', function() {
        this.ProjectRootDocManager.promises.setRootDocFromName
          .calledWith(this.project_id, 'main.tex')
          .should.equal(true)
      })

      it('should call the callback', function() {
        this.callback
          .calledWith(sinon.match.falsy, this.project)
          .should.equal(true)
      })

      it('should ensure the name is valid', function() {
        return this.ProjectDetailsHandler.fixProjectName.called.should.equal(
          true
        )
      })
    })

    describe("when the root document can't be determined", function() {
      beforeEach(function(done) {
        this.ProjectRootDocManager.promises.findRootDocFileFromDirectory = sinon
          .stub()
          .returns(promiseStub())
        this.ProjectUploadManager._getDestinationDirectory = sinon
          .stub()
          .returns(this.destination)
        this.ProjectDetailsHandler.promises.generateUniqueName = sinon
          .stub()
          .returns(promiseStub(this.name))

        return this.ProjectUploadManager.createProjectFromZipArchive(
          this.owner_id,
          this.name,
          this.source,
          (err, project) => {
            this.callback(err, project)
            return done()
          }
        )
      })

      it('should not try to set the root doc', function() {
        this.ProjectRootDocManager.promises.setRootDocFromName.called.should.equal(
          false
        )
      })
    })
  })

  describe('createProjectFromZipArchiveWithName', function() {
    beforeEach(function(done) {
      this.ProjectDetailsHandler.promises.generateUniqueName = sinon
        .stub()
        .returns(promiseStub(this.name))
      this.ProjectCreationHandler.promises.createBlankProject = sinon
        .stub()
        .returns(promiseStub(this.project))
      this.ProjectUploadManager.promises.insertZipArchiveIntoFolder = sinon
        .stub()
        .returns(promiseStub())
      this.ProjectUploadManager.createProjectFromZipArchiveWithName(
        this.owner_id,
        this.name,
        this.source,
        (err, project) => {
          this.callback(err, project)
          return done()
        }
      )
    })

    it('should create a project owned by the owner_id', function() {
      this.ProjectCreationHandler.promises.createBlankProject
        .calledWith(this.owner_id)
        .should.equal(true)
    })

    it('should create a project with the correct name', function() {
      this.ProjectCreationHandler.promises.createBlankProject
        .calledWith(sinon.match.any, this.name)
        .should.equal(true)
    })

    it('should insert the zip file contents into the root folder', function() {
      this.ProjectUploadManager.promises.insertZipArchiveIntoFolder
        .calledWith(
          this.owner_id,
          this.project_id,
          this.root_folder_id,
          this.source
        )
        .should.equal(true)
    })

    it('should automatically set the root doc', function() {
      this.ProjectRootDocManager.promises.setRootDocAutomatically
        .calledWith(this.project_id)
        .should.equal(true)
    })

    it('should call the callback', function() {
      return this.callback
        .calledWith(sinon.match.falsy, this.project)
        .should.equal(true)
    })
    describe('when inserting the zip file contents into the root folder fails', function() {
      beforeEach(function(done) {
        this.callback = sinon.stub()
        this.ProjectUploadManager.promises.insertZipArchiveIntoFolder = sinon
          .stub()
          .returns(failedPromiseStub('insert-zip-error'))
        this.ProjectDeleter.promises.deleteProject = sinon
          .stub()
          .returns(promiseStub())
        this.ProjectUploadManager.createProjectFromZipArchiveWithName(
          this.owner_id,
          this.name,
          this.source,
          (err, project) => {
            this.callback(err, project)
            return done()
          }
        )
      })

      it('should pass an error to the callback', function() {
        return this.callback
          .calledWith('insert-zip-error', sinon.match.falsy)
          .should.equal(true)
      })

      it('should cleanup the blank project created', function() {
        return this.ProjectDeleter.promises.deleteProject
          .calledWith(this.project_id)
          .should.equal(true)
      })
    })

    describe('when setting automatically the root doc fails', function() {
      beforeEach(function(done) {
        this.callback = sinon.stub()
        this.ProjectRootDocManager.promises.setRootDocAutomatically = sinon
          .stub()
          .returns(failedPromiseStub('set-root-auto-error'))
        this.ProjectDeleter.promises.deleteProject = sinon
          .stub()
          .returns(promiseStub())
        this.ProjectUploadManager.createProjectFromZipArchiveWithName(
          this.owner_id,
          this.name,
          this.source,
          (err, project) => {
            this.callback(err, project)
            return done()
          }
        )
      })

      it('should pass an error to the callback', function() {
        return this.callback
          .calledWith('set-root-auto-error', sinon.match.falsy)
          .should.equal(true)
      })

      it('should cleanup the blank project created', function() {
        return this.ProjectDeleter.promises.deleteProject
          .calledWith(this.project_id)
          .should.equal(true)
      })
    })
  })

  describe('insertZipArchiveIntoFolder', function() {
    beforeEach(function(done) {
      this.ProjectUploadManager._getDestinationDirectory = sinon
        .stub()
        .returns(this.destination)
      return this.ProjectUploadManager.insertZipArchiveIntoFolder(
        this.owner_id,
        this.project_id,
        this.folder_id,
        this.source,
        err => {
          this.callback(err)
          return done()
        }
      )
    })

    it('should set up the directory to extract the archive to', function() {
      this.ProjectUploadManager._getDestinationDirectory
        .calledWith(this.source)
        .should.equal(true)
    })

    it('should extract the archive', function() {
      this.ArchiveManager.extractZipArchive
        .calledWith(this.source, this.destination)
        .should.equal(true)
    })

    it('should find the top level directory', function() {
      this.ArchiveManager.findTopLevelDirectory
        .calledWith(this.destination)
        .should.equal(true)
    })

    it('should insert the extracted archive into the folder', function() {
      this.FileSystemImportManager.addFolderContents
        .calledWith(
          this.owner_id,
          this.project_id,
          this.folder_id,
          this.topLevelDestination,
          false
        )
        .should.equal(true)
    })

    it('should return the callback', function() {
      this.callback.called.should.equal(true)
    })

    it('should remove the desintation directory afterwards', function() {
      this.rimraf.calledWith(this.destination).should.equal(true)
    })
  })

  describe('_getDestinationDirectory', function() {
    it('should return the path with the time appended', function() {
      const date = Date.now()
      sinon.stub(Date, 'now', () => date)
      this.ProjectUploadManager._getDestinationDirectory(
        '/path/to/zip/file.zip'
      ).should.equal(`/path/to/zip/file-${date}`)
      Date.now.restore()
    })
  })
})
