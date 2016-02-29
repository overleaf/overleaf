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
	
	describe "addDoc", ->
		beforeEach ->
			@docContent = "one\ntwo\nthree"
			@docLines = @docContent.split("\n")
			@fs.readFile = sinon.stub().callsArgWith(2, null, @docContent)

		describe "with replace set to false", ->
			beforeEach ->
				@EditorController.addDocWithoutLock = sinon.stub().callsArg(5)
				@FileSystemImportManager.addDoc @user_id, @project_id, @folder_id, @name, @path_on_disk, false, @callback

			it "should read the file from disk", ->
				@fs.readFile.calledWith(@path_on_disk, "utf8").should.equal true

			it "should insert the doc", ->
				@EditorController.addDocWithoutLock.calledWith(@project_id, @folder_id, @name, @docLines, "upload")
					.should.equal true

		describe "with windows line ending", ->
			beforeEach ->
				@docContent = "one\r\ntwo\r\nthree"
				@docLines = ["one", "two", "three"]
				@fs.readFile = sinon.stub().callsArgWith(2, null, @docContent)
				@EditorController.addDocWithoutLock = sinon.stub().callsArg(5)
				@FileSystemImportManager.addDoc @user_id, @project_id, @folder_id, @name, @path_on_disk, false, @callback

			it "should strip the \\r characters before adding", ->
				@EditorController.addDocWithoutLock.calledWith(@project_id, @folder_id, @name, @docLines, "upload")
					.should.equal true
		
		describe "with replace set to true", ->
			describe "when the doc doesn't exist", ->
				beforeEach ->
					@folder = {
						docs: [{
							_id: "doc-id-2"
							name: "not-the-right-file.tex"
						}]
					}
					@ProjectLocator.findElement = sinon.stub().callsArgWith(1, null, @folder)
					@EditorController.addDocWithoutLock = sinon.stub().callsArg(5)
					@FileSystemImportManager.addDoc @user_id, @project_id, @folder_id, @name, @path_on_disk, true, @callback

				it "should look up the folder", ->
					@ProjectLocator.findElement
						.calledWith(project_id: @project_id, element_id: @folder_id, type: "folder")
						.should.equal true

				it "should insert the doc", ->
					@EditorController.addDocWithoutLock.calledWith(@project_id, @folder_id, @name, @docLines, "upload")
						.should.equal true

			describe "when the doc does exist", ->
				beforeEach ->
					@folder = {
						docs: [{
							_id: @doc_id = "doc-id-1"
							name: @name
						}, {
							_id: "doc-id-2"
							name: "not-the-right-file.tex"
						}]
					}
					@ProjectLocator.findElement = sinon.stub().callsArgWith(1, null, @folder)
					@EditorController.setDoc = sinon.stub().callsArg(5)
					@FileSystemImportManager.addDoc @user_id, @project_id, @folder_id, @name, @path_on_disk, true, @callback

				it "should look up the folder", ->
					@ProjectLocator.findElement
						.calledWith(project_id: @project_id, element_id: @folder_id, type: "folder")
						.should.equal true

				it "should set the doc with the new doc lines", ->
					@EditorController.setDoc.calledWith(@project_id, @doc_id, @user_id, @docLines, "upload")
						.should.equal true

	describe "addFile with replace set to false", ->
		beforeEach ->
			@EditorController.addFileWithoutLock = sinon.stub().callsArg(5)
			@FileSystemImportManager.addFile @user_id, @project_id, @folder_id, @name, @path_on_disk, false, @callback

		it "should add the file", ->
			@EditorController.addFileWithoutLock.calledWith(@project_id, @folder_id, @name, @path_on_disk, "upload")
				.should.equal true

	describe "addFile with replace set to true", ->
		describe "when the file doesn't exist", ->
			beforeEach ->
				@folder = {
					fileRefs: [{
						_id: "file-id-2"
						name: "not-the-right-file.tex"
					}]
				}
				@ProjectLocator.findElement = sinon.stub().callsArgWith(1, null, @folder)
				@EditorController.addFileWithoutLock = sinon.stub().callsArg(5)
				@FileSystemImportManager.addFile @user_id, @project_id, @folder_id, @name, @path_on_disk, true, @callback

			it "should look up the folder", ->
				@ProjectLocator.findElement
					.calledWith(project_id: @project_id, element_id: @folder_id, type: "folder")
					.should.equal true

			it "should add the file", ->
				@EditorController.addFileWithoutLock.calledWith(@project_id, @folder_id, @name, @path_on_disk, "upload")
					.should.equal true

		describe "when the file does exist", ->
			beforeEach ->
				@folder = {
					fileRefs: [{
						_id: @file_id = "file-id-1"
						name: @name
					}, {
						_id: "file-id-2"
						name: "not-the-right-file.tex"
					}]
				}
				@ProjectLocator.findElement = sinon.stub().callsArgWith(1, null, @folder)
				@EditorController.replaceFile = sinon.stub().callsArg(4)
				@FileSystemImportManager.addFile @user_id, @project_id, @folder_id, @name, @path_on_disk, true, @callback

			it "should look up the folder", ->
				@ProjectLocator.findElement
					.calledWith(project_id: @project_id, element_id: @folder_id, type: "folder")
					.should.equal true

			it "should replace the file", ->
				@EditorController.replaceFile.calledWith(@project_id, @file_id, @path_on_disk, "upload")
					.should.equal true

	describe "addFolder", ->
		beforeEach ->
			@new_folder_id = "new-folder-id"
			@EditorController.addFolderWithoutLock  = sinon.stub().callsArgWith(4, null, _id: @new_folder_id)
			@FileSystemImportManager.addFolderContents = sinon.stub().callsArg(5)
			@FileSystemImportManager.addFolder @user_id, @project_id, @folder_id, @name, @path_on_disk, @replace, @callback

		it "should add a folder to the project", ->
			@EditorController.addFolderWithoutLock.calledWith(@project_id, @folder_id, @name, "upload")
				.should.equal true

		it "should add the folders contents", ->
			@FileSystemImportManager.addFolderContents.calledWith(@user_id, @project_id, @new_folder_id, @path_on_disk, @replace)
				.should.equal true

	describe "addFolderContents", ->
		beforeEach ->
			@folderEntries = ["path1", "path2", "path3"]
			@ignoredEntries = [".DS_Store"]
			@fs.readdir = sinon.stub().callsArgWith(1, null, @folderEntries.concat @ignoredEntries)
			@FileSystemImportManager.addEntity = sinon.stub().callsArg(6)
			@FileTypeManager.shouldIgnore = (path, callback) =>
				callback null, @ignoredEntries.indexOf(require("path").basename(path)) != -1
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
				@FileSystemImportManager.addEntity @user_id, @project_id, @folder_id, @name, @path_on_disk, @replace, @callback

			it "should call addFolder", ->
				@FileSystemImportManager.addFolder.calledWith(@user_id, @project_id, @folder_id, @name, @path_on_disk, @replace)
					.should.equal true

		describe "with binary file", ->
			beforeEach ->
				@FileTypeManager.isDirectory = sinon.stub().callsArgWith(1, null, false)
				@FileTypeManager.isBinary = sinon.stub().callsArgWith(2, null, true)
				@FileSystemImportManager.addFile = sinon.stub().callsArg(6)
				@FileSystemImportManager.addEntity @user_id, @project_id, @folder_id, @name, @path_on_disk, @replace, @callback

			it "should call addFile", ->
				@FileSystemImportManager.addFile.calledWith(@user_id, @project_id, @folder_id, @name, @path_on_disk, @replace, @callback)
					.should.equal true

		describe "with text file", ->
			beforeEach ->
				@FileTypeManager.isDirectory = sinon.stub().callsArgWith(1, null, false)
				@FileTypeManager.isBinary = sinon.stub().callsArgWith(2, null, false)
				@FileSystemImportManager.addDoc = sinon.stub().callsArg(6)
				@FileSystemImportManager.addEntity @user_id, @project_id, @folder_id, @name, @path_on_disk, @replace, @callback

			it "should call addFile", ->
				@FileSystemImportManager.addDoc.calledWith(@user_id, @project_id, @folder_id, @name, @path_on_disk, @replace, @callback)
					.should.equal true


