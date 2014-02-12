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
			@EditorController.addDoc = sinon.stub().callsArg(4)
			@FileSystemImportManager.addDoc @project_id, @folder_id, @name, @path_on_disk, false, @callback

		it "should read the file from disk", ->
			@fs.readFile.calledWith(@path_on_disk, "utf8").should.equal true

		it "should insert the doc", ->
			@EditorController.addDoc.calledWith(@project_id, @folder_id, @name, @docLines)
				.should.equal true

	describe "addDoc with windows line ending", ->
		beforeEach ->
			@docContent = "one\r\ntwo\r\nthree"
			@docLines = ["one", "two", "three"]
			@fs.readFile = sinon.stub().callsArgWith(2, null, @docContent)
			@EditorController.addDoc = sinon.stub().callsArg(4)
			@FileSystemImportManager.addDoc @project_id, @folder_id, @name, @path_on_disk, false, @callback

		it "should strip the \\r characters before adding", ->
			@EditorController.addDoc.calledWith(@project_id, @folder_id, @name, @docLines)
				.should.equal true

	describe "addFile with replace set to false", ->
		beforeEach ->
			@EditorController.addFile = sinon.stub().callsArg(4)
			@FileSystemImportManager.addFile @project_id, @folder_id, @name, @path_on_disk, false, @callback

		it "should add the file", ->
			@EditorController.addFile.calledWith(@project_id, @folder_id, @name, @path_on_disk)
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
				@EditorController.addFile = sinon.stub().callsArg(4)
				@FileSystemImportManager.addFile @project_id, @folder_id, @name, @path_on_disk, true, @callback

			it "should look up the folder", ->
				@ProjectLocator.findElement
					.calledWith(project_id: @project_id, element_id: @folder_id, type: "folder")
					.should.equal true

			it "should add the file", ->
				@EditorController.addFile.calledWith(@project_id, @folder_id, @name, @path_on_disk)
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
				@EditorController.replaceFile = sinon.stub().callsArg(3)
				@FileSystemImportManager.addFile @project_id, @folder_id, @name, @path_on_disk, true, @callback

			it "should look up the folder", ->
				@ProjectLocator.findElement
					.calledWith(project_id: @project_id, element_id: @folder_id, type: "folder")
					.should.equal true

			it "should replace the file", ->
				@EditorController.replaceFile.calledWith(@project_id, @file_id, @path_on_disk)
					.should.equal true

	describe "addFolder", ->
		beforeEach ->
			@new_folder_id = "new-folder-id"
			@EditorController.addFolder  = sinon.stub().callsArgWith(3, null, _id: @new_folder_id)
			@FileSystemImportManager.addFolderContents = sinon.stub().callsArg(4)
			@FileSystemImportManager.addFolder @project_id, @folder_id, @name, @path_on_disk, @replace, @callback

		it "should add a folder to the project", ->
			@EditorController.addFolder.calledWith(@project_id, @folder_id, @name)
				.should.equal true

		it "should add the folders contents", ->
			@FileSystemImportManager.addFolderContents.calledWith(@project_id, @new_folder_id, @path_on_disk, @replace)
				.should.equal true

	describe "addFolderContents", ->
		beforeEach ->
			@folderEntries = ["path1", "path2", "path3"]
			@ignoredEntries = [".DS_Store"]
			@fs.readdir = sinon.stub().callsArgWith(1, null, @folderEntries.concat @ignoredEntries)
			@FileSystemImportManager.addEntity = sinon.stub().callsArg(5)
			@FileTypeManager.shouldIgnore = (path, callback) =>
				callback null, @ignoredEntries.indexOf(require("path").basename(path)) != -1
			@FileSystemImportManager.addFolderContents @project_id, @folder_id, @path_on_disk, @replace, @callback

		it "should call addEntity for each file in the folder which is not ignored", ->
			for name in @folderEntries
				@FileSystemImportManager.addEntity.calledWith(@project_id, @folder_id, name, "#{@path_on_disk}/#{name}", @replace)
					.should.equal true

		it "should not call addEntity for the ignored files", ->
			for name in @ignoredEntries
				@FileSystemImportManager.addEntity.calledWith(@project_id, @folder_id, name, "#{@path_on_disk}/#{name}", @replace)
					.should.equal false
	
		it "should look in the correct directory", ->
			@fs.readdir.calledWith(@path_on_disk).should.equal true

	describe "addEntity", ->
		describe "with directory", ->
			beforeEach ->
				@FileTypeManager.isDirectory = sinon.stub().callsArgWith(1, null, true)
				@FileSystemImportManager.addFolder = sinon.stub().callsArg(5)
				@FileSystemImportManager.addEntity @project_id, @folder_id, @name, @path_on_disk, @replace, @callback

			it "should call addFolder", ->
				@FileSystemImportManager.addFolder.calledWith(@project_id, @folder_id, @name, @path_on_disk, @replace, @callback)
					.should.equal true

		describe "with binary file", ->
			beforeEach ->
				@FileTypeManager.isDirectory = sinon.stub().callsArgWith(1, null, false)
				@FileTypeManager.isBinary = sinon.stub().callsArgWith(1, null, true)
				@FileSystemImportManager.addFile = sinon.stub().callsArg(5)
				@FileSystemImportManager.addEntity @project_id, @folder_id, @name, @path_on_disk, @replace, @callback

			it "should call addFile", ->
				@FileSystemImportManager.addFile.calledWith(@project_id, @folder_id, @name, @path_on_disk, @replace, @callback)
					.should.equal true

		describe "with text file", ->
			beforeEach ->
				@FileTypeManager.isDirectory = sinon.stub().callsArgWith(1, null, false)
				@FileTypeManager.isBinary = sinon.stub().callsArgWith(1, null, false)
				@FileSystemImportManager.addDoc = sinon.stub().callsArg(5)
				@FileSystemImportManager.addEntity @project_id, @folder_id, @name, @path_on_disk, @replace, @callback

			it "should call addFile", ->
				@FileSystemImportManager.addDoc.calledWith(@project_id, @folder_id, @name, @path_on_disk, @replace, @callback)
					.should.equal true


