sinon = require('sinon')
chai = require('chai')
should = chai.should()
modulePath = "../../../../app/js/Features/Uploads/ProjectUploadManager.js"
SandboxedModule = require('sandboxed-module')

describe "ProjectUploadManager", ->
	beforeEach ->
		@project_id = "project-id-123"
		@folder_id = "folder-id-123"
		@callback = sinon.stub()
		@ProjectUploadManager = SandboxedModule.require modulePath, requires:
			"./FileSystemImportManager" : @FileSystemImportManager = {}
			"./ArchiveManager" : @ArchiveManager = {}
			"../Project/ProjectCreationHandler" : @ProjectCreationHandler = {}
			"../Project/ProjectRootDocManager" : @ProjectRootDocManager = {}
			"rimraf" : @rimraf = sinon.stub().callsArg(1)

	describe "createProjectFromZipArchive", ->
		beforeEach ->
			@source = "/path/to/zip/file-name.zip"
			@root_folder_id = @folder_id
			@owner_id = "owner-id-123"
			@name = "Project name"
			@project =
				_id: @project_id
				rootFolder: [ _id: @root_folder_id ]
			@ProjectCreationHandler.createBlankProject = sinon.stub().callsArgWith(2, null, @project)
			@ProjectUploadManager.insertZipArchiveIntoFolder = sinon.stub().callsArg(3)
			@ProjectRootDocManager.setRootDocAutomatically = sinon.stub().callsArg(1)
			@ProjectUploadManager.createProjectFromZipArchive @owner_id, @name, @source, @callback

		it "should create a project owned by the owner_id", ->
			@ProjectCreationHandler
				.createBlankProject
				.calledWith(@owner_id)
				.should.equal true

		it "should create a project with the correct name", ->
			@ProjectCreationHandler
				.createBlankProject
				.calledWith(sinon.match.any, @name)
				.should.equal true

		it "should insert the zip file contents into the root folder", ->
			@ProjectUploadManager
				.insertZipArchiveIntoFolder
				.calledWith(@project_id, @root_folder_id, @source)
				.should.equal true

		it "should automatically set the root doc", ->
			@ProjectRootDocManager
				.setRootDocAutomatically
				.calledWith(@project_id)
				.should.equal true

		it "should call the callback", ->
			@callback.calledWith(sinon.match.falsy, @project).should.equal true

	describe "insertZipArchiveIntoFolder", ->
		beforeEach ->
			@source = "/path/to/zile/file.zip"
			@destination = "/path/to/zile/file-extracted"
			@ProjectUploadManager._getDestinationDirectory = sinon.stub().returns @destination
			@ArchiveManager.extractZipArchive = sinon.stub().callsArg(2)
			@FileSystemImportManager.addFolderContents = sinon.stub().callsArg(4)

			@ProjectUploadManager.insertZipArchiveIntoFolder @project_id, @folder_id, @source, @callback

		it "should set up the directory to extract the archive to", ->
			@ProjectUploadManager._getDestinationDirectory.calledWith(@source).should.equal true

		it "should extract the archive", ->
			@ArchiveManager.extractZipArchive.calledWith(@source, @destination).should.equal true

		it "should insert the extracted archive into the folder", ->
			@FileSystemImportManager.addFolderContents.calledWith(@project_id, @folder_id, @destination, false)
				.should.equal true

		it "should return the callback", ->
			@callback.called.should.equal true

		it "should remove the desintation directory afterwards", ->
			@rimraf.calledWith(@destination).should.equal true

	describe "_getDestinationDirectory", ->
		it "should return the path with the time appended", ->
			date = Date.now()
			sinon.stub Date, "now", () -> date
			@ProjectUploadManager
				._getDestinationDirectory("/path/to/zip/file.zip")
				.should.equal "/path/to/zip/file-#{date}"
			Date.now.restore()

