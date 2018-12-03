sinon = require('sinon')
chai = require('chai')
should = chai.should()
modulePath = "../../../../app/js/Features/Uploads/ProjectUploadManager.js"
SandboxedModule = require('sandboxed-module')

describe "ProjectUploadManager", ->
	beforeEach ->
		@project_id = "project-id-123"
		@folder_id = "folder-id-123"
		@owner_id = "onwer-id-123"
		@callback = sinon.stub()
		@source = "/path/to/zip/file-name.zip"
		@destination = "/path/to/zile/file-extracted"
		@root_folder_id = @folder_id
		@owner_id = "owner-id-123"
		@name = "Project name"
		@othername = "Other name"
		@project =
			_id: @project_id
			rootFolder: [ _id: @root_folder_id ]
		@ProjectUploadManager = SandboxedModule.require modulePath, requires:
			"./FileSystemImportManager" : @FileSystemImportManager = {}
			"./ArchiveManager" : @ArchiveManager = {}
			"../Project/ProjectCreationHandler" : @ProjectCreationHandler = {}
			"../Project/ProjectRootDocManager" : @ProjectRootDocManager = {}
			"../Project/ProjectDetailsHandler" : @ProjectDetailsHandler = {}
			"../Documents/DocumentHelper" : @DocumentHelper = {}
			"rimraf" : @rimraf = sinon.stub().callsArg(1)

		@ArchiveManager.extractZipArchive = sinon.stub().callsArg(2)
		@ArchiveManager.findTopLevelDirectory = sinon.stub().callsArgWith(1, null, @topLevelDestination = "/path/to/zip/file-extracted/nested")
		@ProjectCreationHandler.createBlankProject = sinon.stub().callsArgWith(2, null, @project)
		@ProjectRootDocManager.setRootDocAutomatically = sinon.stub().callsArg(1)
		@FileSystemImportManager.addFolderContents = sinon.stub().callsArg(5)
		@ProjectRootDocManager.findRootDocFileFromDirectory = sinon.stub().callsArgWith(1, null, 'main.tex', @othername)
		@ProjectRootDocManager.setRootDocFromName = sinon.stub().callsArg(2)
		@DocumentHelper.getTitleFromTexContent = sinon.stub().returns(@othername)

	describe "createProjectFromZipArchive", ->
		describe "when the title can be read from the root document", ->
			beforeEach (done) ->
				@ProjectUploadManager._getDestinationDirectory = sinon.stub().returns @destination
				@ProjectDetailsHandler.generateUniqueName = sinon.stub().callsArgWith(2, null, @othername)
				@ProjectUploadManager.createProjectFromZipArchive @owner_id, @name, @source, (err, project) =>
					@callback(err, project)
					done()

			it "should set up the directory to extract the archive to", ->
				@ProjectUploadManager._getDestinationDirectory.calledWith(@source).should.equal true

			it "should extract the archive", ->
				@ArchiveManager.extractZipArchive.calledWith(@source, @destination).should.equal true

			it "should find the top level directory", ->
				@ArchiveManager.findTopLevelDirectory.calledWith(@destination).should.equal true

			it "should insert the extracted archive into the folder", ->
				@FileSystemImportManager.addFolderContents.calledWith(@owner_id, @project_id, @folder_id, @topLevelDestination, false)
					.should.equal true

			it "should create a project owned by the owner_id", ->
				@ProjectCreationHandler
					.createBlankProject
					.calledWith(@owner_id)
					.should.equal true

			it "should create a project with the correct name", ->
				@ProjectCreationHandler
					.createBlankProject
					.calledWith(sinon.match.any, @othername)
					.should.equal true

			it "should read the title from the tex contents", ->
				@DocumentHelper.getTitleFromTexContent.called.should.equal true

			it "should set the root document", ->
				@ProjectRootDocManager.setRootDocFromName.calledWith(@project_id, 'main.tex').should.equal true

			it "should call the callback", ->
				@callback.calledWith(sinon.match.falsy, @project).should.equal true

		describe "when the root document can't be determined", ->
			beforeEach (done) ->
				@ProjectRootDocManager.findRootDocFileFromDirectory = sinon.stub().callsArg(1)
				@ProjectUploadManager._getDestinationDirectory = sinon.stub().returns @destination
				@ProjectDetailsHandler.generateUniqueName = sinon.stub().callsArgWith(2, null, @name)
				@ProjectUploadManager.createProjectFromZipArchive @owner_id, @name, @source, (err, project) =>
					@callback(err, project)
					done()

			it "should not try to set the root doc", ->
				@ProjectRootDocManager.setRootDocFromName.called.should.equal false

	describe "createProjectFromZipArchiveWithName", ->
		beforeEach (done) ->
			@ProjectDetailsHandler.generateUniqueName = sinon.stub().callsArgWith(2, null, @name)
			@ProjectUploadManager.insertZipArchiveIntoFolder = sinon.stub().callsArg(4)
			@ProjectUploadManager.createProjectFromZipArchiveWithName @owner_id, @name, @source, (err, project) =>
				@callback(err, project)
				done()

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
				.calledWith(@owner_id, @project_id, @root_folder_id, @source)
				.should.equal true

		it "should automatically set the root doc", ->
			@ProjectRootDocManager
				.setRootDocAutomatically
				.calledWith(@project_id)
				.should.equal true

		it "should call the callback", ->
			@callback.calledWith(sinon.match.falsy, @project).should.equal true

	describe "insertZipArchiveIntoFolder", ->
		beforeEach (done) ->
			@ProjectUploadManager._getDestinationDirectory = sinon.stub().returns @destination
			@ProjectUploadManager.insertZipArchiveIntoFolder @owner_id, @project_id, @folder_id, @source, (err) =>
				@callback(err)
				done()

		it "should set up the directory to extract the archive to", ->
			@ProjectUploadManager._getDestinationDirectory.calledWith(@source).should.equal true

		it "should extract the archive", ->
			@ArchiveManager.extractZipArchive.calledWith(@source, @destination).should.equal true

		it "should find the top level directory", ->
			@ArchiveManager.findTopLevelDirectory.calledWith(@destination).should.equal true

		it "should insert the extracted archive into the folder", ->
			@FileSystemImportManager.addFolderContents.calledWith(@owner_id, @project_id, @folder_id, @topLevelDestination, false)
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

