/* eslint-disable
    max-len,
    no-return-assign,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const sinon = require('sinon')
const chai = require('chai')
const should = chai.should()
const modulePath =
  '../../../../app/src/Features/Uploads/ProjectUploadManager.js'
const SandboxedModule = require('sandboxed-module')

describe('ProjectUploadManager', function() {
  beforeEach(function() {
    this.project_id = 'project-id-123'
    this.folder_id = 'folder-id-123'
    this.owner_id = 'onwer-id-123'
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
      requires: {
        './FileSystemImportManager': (this.FileSystemImportManager = {}),
        './ArchiveManager': (this.ArchiveManager = {}),
        '../Project/ProjectCreationHandler': (this.ProjectCreationHandler = {}),
        '../Project/ProjectRootDocManager': (this.ProjectRootDocManager = {}),
        '../Project/ProjectDetailsHandler': (this.ProjectDetailsHandler = {}),
        '../Documents/DocumentHelper': (this.DocumentHelper = {}),
        rimraf: (this.rimraf = sinon.stub().callsArg(1))
      }
    })

    this.ArchiveManager.extractZipArchive = sinon.stub().callsArg(2)
    this.ArchiveManager.findTopLevelDirectory = sinon
      .stub()
      .callsArgWith(
        1,
        null,
        (this.topLevelDestination = '/path/to/zip/file-extracted/nested')
      )
    this.ProjectCreationHandler.createBlankProject = sinon
      .stub()
      .callsArgWith(2, null, this.project)
    this.ProjectRootDocManager.setRootDocAutomatically = sinon
      .stub()
      .callsArg(1)
    this.FileSystemImportManager.addFolderContents = sinon.stub().callsArg(5)
    this.ProjectRootDocManager.findRootDocFileFromDirectory = sinon
      .stub()
      .callsArgWith(1, null, 'main.tex', this.othername)
    this.ProjectRootDocManager.setRootDocFromName = sinon.stub().callsArg(2)
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
        this.ProjectDetailsHandler.generateUniqueName = sinon
          .stub()
          .callsArgWith(2, null, this.othername)
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
        return this.ProjectUploadManager._getDestinationDirectory
          .calledWith(this.source)
          .should.equal(true)
      })

      it('should extract the archive', function() {
        return this.ArchiveManager.extractZipArchive
          .calledWith(this.source, this.destination)
          .should.equal(true)
      })

      it('should find the top level directory', function() {
        return this.ArchiveManager.findTopLevelDirectory
          .calledWith(this.destination)
          .should.equal(true)
      })

      it('should insert the extracted archive into the folder', function() {
        return this.FileSystemImportManager.addFolderContents
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
        return this.ProjectCreationHandler.createBlankProject
          .calledWith(this.owner_id)
          .should.equal(true)
      })

      it('should create a project with the correct name', function() {
        return this.ProjectCreationHandler.createBlankProject
          .calledWith(sinon.match.any, this.othername)
          .should.equal(true)
      })

      it('should read the title from the tex contents', function() {
        return this.DocumentHelper.getTitleFromTexContent.called.should.equal(
          true
        )
      })

      it('should set the root document', function() {
        return this.ProjectRootDocManager.setRootDocFromName
          .calledWith(this.project_id, 'main.tex')
          .should.equal(true)
      })

      it('should call the callback', function() {
        return this.callback
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
        this.ProjectRootDocManager.findRootDocFileFromDirectory = sinon
          .stub()
          .callsArg(1)
        this.ProjectUploadManager._getDestinationDirectory = sinon
          .stub()
          .returns(this.destination)
        this.ProjectDetailsHandler.generateUniqueName = sinon
          .stub()
          .callsArgWith(2, null, this.name)
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
        return this.ProjectRootDocManager.setRootDocFromName.called.should.equal(
          false
        )
      })
    })
  })

  describe('createProjectFromZipArchiveWithName', function() {
    beforeEach(function(done) {
      this.ProjectDetailsHandler.generateUniqueName = sinon
        .stub()
        .callsArgWith(2, null, this.name)
      // createBlankProject allows taking optional attributes and will callback the last arg
      this.ProjectCreationHandler.createBlankProject = sinon
        .stub()
        .callsArgWith(3, null, this.project)
      this.ProjectUploadManager.insertZipArchiveIntoFolder = sinon
        .stub()
        .callsArg(4)
      return this.ProjectUploadManager.createProjectFromZipArchiveWithName(
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
      return this.ProjectCreationHandler.createBlankProject
        .calledWith(this.owner_id)
        .should.equal(true)
    })

    it('should create a project with the correct name', function() {
      return this.ProjectCreationHandler.createBlankProject
        .calledWith(sinon.match.any, this.name)
        .should.equal(true)
    })

    it('should insert the zip file contents into the root folder', function() {
      return this.ProjectUploadManager.insertZipArchiveIntoFolder
        .calledWith(
          this.owner_id,
          this.project_id,
          this.root_folder_id,
          this.source
        )
        .should.equal(true)
    })

    it('should automatically set the root doc', function() {
      return this.ProjectRootDocManager.setRootDocAutomatically
        .calledWith(this.project_id)
        .should.equal(true)
    })

    it('should call the callback', function() {
      return this.callback
        .calledWith(sinon.match.falsy, this.project)
        .should.equal(true)
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
      return this.ProjectUploadManager._getDestinationDirectory
        .calledWith(this.source)
        .should.equal(true)
    })

    it('should extract the archive', function() {
      return this.ArchiveManager.extractZipArchive
        .calledWith(this.source, this.destination)
        .should.equal(true)
    })

    it('should find the top level directory', function() {
      return this.ArchiveManager.findTopLevelDirectory
        .calledWith(this.destination)
        .should.equal(true)
    })

    it('should insert the extracted archive into the folder', function() {
      return this.FileSystemImportManager.addFolderContents
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
      return this.callback.called.should.equal(true)
    })

    it('should remove the desintation directory afterwards', function() {
      return this.rimraf.calledWith(this.destination).should.equal(true)
    })
  })

  describe('_getDestinationDirectory', () =>
    it('should return the path with the time appended', function() {
      const date = Date.now()
      sinon.stub(Date, 'now', () => date)
      this.ProjectUploadManager._getDestinationDirectory(
        '/path/to/zip/file.zip'
      ).should.equal(`/path/to/zip/file-${date}`)
      return Date.now.restore()
    }))
})
