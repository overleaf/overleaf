sinon = require('sinon')
chai = require('chai')
should = chai.should()
modulePath = "../../../../app/js/Features/Uploads/FileSystemImportManager.js"
SandboxedModule = require('sandboxed-module')

describe "FileSystemImportManager", ->
	beforeEach ->
		@project_id = "project-id-123"
		@folder_id = "folder-id-123"
		@name = "test-file.tex"
		@path_on_disk = "/path/to/file/#{@name}"
		@replace = "replace-boolean-flag-mock"
		@user_id = "mock-user-123"
		@callback = sinon.stub()
		@FileSystemImportManager = SandboxedModule.require modulePath, requires:
			"fs" : @fs = {}
			"../Editor/EditorController": @EditorController = {}
			"./FileTypeManager": @FileTypeManager = {}
			"../Project/ProjectLocator": @ProjectLocator = {}
			"logger-sharelatex":
				log:->
				err:->
	
	describe "addDoc", ->
		beforeEach ->
			@docContent = "one\ntwo\nthree"
			@docLines = @docContent.split("\n")
			@fs.readFile = sinon.stub().callsArgWith(2, null, @docContent)
			@FileSystemImportManager._isSafeOnFileSystem = sinon.stub().callsArgWith(1, null, true)


		describe "when path is symlink", ->
			beforeEach ->
				@FileSystemImportManager._isSafeOnFileSystem = sinon.stub().callsArgWith(1, null, false)
				@EditorController.addDoc = sinon.stub()
				@FileSystemImportManager.addDoc @user_id, @project_id, @folder_id, @name, @path_on_disk, false, @callback

			it "should not read the file from disk", ->
				@fs.readFile.called.should.equal false

			it "should not insert the doc", ->
				@EditorController.addDoc.called.should.equal false

		describe "with replace set to false", ->
			beforeEach ->
				@EditorController.addDoc = sinon.stub().callsArg(6)
				@FileSystemImportManager.addDoc @user_id, @project_id, @folder_id, @name, @path_on_disk, false, @callback

			it "should read the file from disk", ->
				@fs.readFile.calledWith(@path_on_disk, "utf8").should.equal true

			it "should insert the doc", ->
				@EditorController.addDoc.calledWith(@project_id, @folder_id, @name, @docLines, "upload", @user_id)
					.should.equal true

		describe "with windows line ending", ->
			beforeEach ->
				@docContent = "one\r\ntwo\r\nthree"
				@docLines = ["one", "two", "three"]
				@fs.readFile = sinon.stub().callsArgWith(2, null, @docContent)
				@EditorController.addDoc = sinon.stub().callsArg(6)
				@FileSystemImportManager.addDoc @user_id, @project_id, @folder_id, @name, @path_on_disk, false, @callback

			it "should strip the \\r characters before adding", ->
				@EditorController.addDoc.calledWith(@project_id, @folder_id, @name, @docLines, "upload", @user_id)
					.should.equal true
		
		describe "with replace set to true", ->
			beforeEach ->
				@EditorController.upsertDoc = sinon.stub().yields()
				@FileSystemImportManager.addDoc @user_id, @project_id, @folder_id, @name, @path_on_disk, true, @callback

			it "should upsert the doc", ->
				@EditorController.upsertDoc
					.calledWith(@project_id, @folder_id, @name, @docLines, "upload", @user_id)
					.should.equal true

	describe "addFile with replace set to false", ->
		beforeEach ->
			@EditorController.addFile = sinon.stub().callsArg(6)
			@FileSystemImportManager._isSafeOnFileSystem = sinon.stub().callsArgWith(1, null, true)
			@FileSystemImportManager.addFile @user_id, @project_id, @folder_id, @name, @path_on_disk, false, @callback

		it "should add the file", ->
			@EditorController.addFile.calledWith(@project_id, @folder_id, @name, @path_on_disk, "upload", @user_id)
				.should.equal true

	describe "addFile with symlink", ->
		beforeEach ->
			@EditorController.addFile = sinon.stub()
			@FileSystemImportManager._isSafeOnFileSystem = sinon.stub().callsArgWith(1, null, false)
			@EditorController.replaceFile = sinon.stub()
			@FileSystemImportManager.addFile @user_id, @project_id, @folder_id, @name, @path_on_disk, false, @callback

		it "should node add the file", ->
			@EditorController.addFile.called.should.equal false
			@EditorController.replaceFile.called.should.equal false

	describe "addFile with replace set to true", ->
		beforeEach ->
			@FileSystemImportManager._isSafeOnFileSystem = sinon.stub().callsArgWith(1, null, true)
			@EditorController.upsertFile = sinon.stub().yields()
			@FileSystemImportManager.addFile @user_id, @project_id, @folder_id, @name, @path_on_disk, true, @callback

		it "should add the file", ->
			@EditorController.upsertFile
				.calledWith(@project_id, @folder_id, @name, @path_on_disk, "upload", @user_id)
				.should.equal true

	describe "addFolder", ->

		beforeEach ->
			@new_folder_id = "new-folder-id"
			@EditorController.addFolder  = sinon.stub().callsArgWith(4, null, _id: @new_folder_id)
			@FileSystemImportManager.addFolderContents = sinon.stub().callsArg(5)

		describe "successfully", ->
			beforeEach ->
				@FileSystemImportManager._isSafeOnFileSystem = sinon.stub().callsArgWith(1, null, true)
				@FileSystemImportManager.addFolder @user_id, @project_id, @folder_id, @name, @path_on_disk, @replace, @callback

			it "should add a folder to the project", ->
				@EditorController.addFolder.calledWith(@project_id, @folder_id, @name, "upload")
					.should.equal true

			it "should add the folders contents", ->
				@FileSystemImportManager.addFolderContents.calledWith(@user_id, @project_id, @new_folder_id, @path_on_disk, @replace)
					.should.equal true

		describe "with symlink", ->
			beforeEach ->
				@FileSystemImportManager._isSafeOnFileSystem = sinon.stub().callsArgWith(1, null, false)
				@FileSystemImportManager.addFolder @user_id, @project_id, @folder_id, @name, @path_on_disk, @replace, @callback

			it "should not add a folder to the project", ->
				@EditorController.addFolder.called.should.equal false
				@FileSystemImportManager.addFolderContents.called.should.equal false
				
	describe "addFolderContents", ->
		beforeEach ->
			@folderEntries = ["path1", "path2", "path3"]
			@ignoredEntries = [".DS_Store"]
			@fs.readdir = sinon.stub().callsArgWith(1, null, @folderEntries.concat @ignoredEntries)
			@FileSystemImportManager.addEntity = sinon.stub().callsArg(6)
			@FileTypeManager.shouldIgnore = (path, callback) =>
				callback null, @ignoredEntries.indexOf(require("path").basename(path)) != -1
			@FileSystemImportManager._isSafeOnFileSystem = sinon.stub().callsArgWith(1, null, true)
			@FileSystemImportManager.addFolderContents @user_id, @project_id, @folder_id, @path_on_disk, @replace, @callback

		it "should call addEntity for each file in the folder which is not ignored", ->
			for name in @folderEntries
				@FileSystemImportManager.addEntity.calledWith(@user_id, @project_id, @folder_id, name, "#{@path_on_disk}/#{name}", @replace)
					.should.equal true

		it "should not call addEntity for the ignored files", ->
			for name in @ignoredEntries
				@FileSystemImportManager.addEntity.calledWith(@user_id, @project_id, @folder_id, name, "#{@path_on_disk}/#{name}", @replace)
					.should.equal false
	
		it "should look in the correct directory", ->
			@fs.readdir.calledWith(@path_on_disk).should.equal true

	describe "addEntity", ->
		describe "with directory", ->
			beforeEach ->
				@FileTypeManager.isDirectory = sinon.stub().callsArgWith(1, null, true)
				@FileSystemImportManager.addFolder = sinon.stub().callsArg(6)
				@FileSystemImportManager._isSafeOnFileSystem = sinon.stub().callsArgWith(1, null, true)
				@FileSystemImportManager.addEntity @user_id, @project_id, @folder_id, @name, @path_on_disk, @replace, @callback

			it "should call addFolder", ->
				@FileSystemImportManager.addFolder.calledWith(@user_id, @project_id, @folder_id, @name, @path_on_disk, @replace)
					.should.equal true

		describe "with binary file", ->
			beforeEach ->
				@FileTypeManager.isDirectory = sinon.stub().callsArgWith(1, null, false)
				@FileTypeManager.isBinary = sinon.stub().callsArgWith(2, null, true)
				@FileSystemImportManager._isSafeOnFileSystem = sinon.stub().callsArgWith(1, null, true)
				@FileSystemImportManager.addFile = sinon.stub().callsArg(6)
				@FileSystemImportManager.addEntity @user_id, @project_id, @folder_id, @name, @path_on_disk, @replace, @callback

			it "should call addFile", ->
				@FileSystemImportManager.addFile.calledWith(@user_id, @project_id, @folder_id, @name, @path_on_disk, @replace)
					.should.equal true

		describe "with text file", ->
			beforeEach ->
				@FileTypeManager.isDirectory = sinon.stub().callsArgWith(1, null, false)
				@FileTypeManager.isBinary = sinon.stub().callsArgWith(2, null, false)
				@FileSystemImportManager.addDoc = sinon.stub().callsArg(6)
				@FileSystemImportManager._isSafeOnFileSystem = sinon.stub().callsArgWith(1, null, true)
				@FileSystemImportManager.addEntity @user_id, @project_id, @folder_id, @name, @path_on_disk, @replace, @callback

			it "should call addFile", ->
				@FileSystemImportManager.addDoc.calledWith(@user_id, @project_id, @folder_id, @name, @path_on_disk, @replace)
					.should.equal true


