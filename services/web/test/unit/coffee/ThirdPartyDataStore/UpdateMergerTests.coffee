Stream = require('stream')
SandboxedModule = require('sandboxed-module')
sinon = require('sinon')
require('chai').should()
modulePath = require('path').join __dirname, '../../../../app/js/Features/ThirdPartyDataStore/UpdateMerger.js'
BufferedStream = require('bufferedstream')

describe 'UpdateMerger :', ->
	beforeEach ->
		@editorController = {}
		@updateReciver = {}
		@projectLocator = {}
		@projectEntityHandler = {}
		@fs =
			unlink:sinon.stub().callsArgWith(1)
		@FileTypeManager = {}
		@LockManager =
			runWithLock : sinon.spy((key, runner, callback) -> runner(callback))
		@updateMerger = SandboxedModule.require modulePath, requires:
			'../Editor/EditorController': @editorController
			'../Project/ProjectLocator': @projectLocator
			'../Project/ProjectEntityHandler': @projectEntityHandler
			'fs': @fs
			'../Uploads/FileTypeManager':@FileTypeManager
			'settings-sharelatex':{path:{dumpPath:"dump_here"}}
			'logger-sharelatex':
				log: ->
				err: ->
			"metrics-sharelatex":
				Timer:->
					done:->
			"../../infrastructure/LockManager":@LockManager
		@project_id = "project_id_here"
		@user_id = "mock-user-id"
		@source = "dropbox"
		@update = new BufferedStream()
		@update.headers = {}

	describe 'mergeUpdate', ->
		beforeEach ->
			@path = "/doc1"
			@fsPath = "file/system/path.tex"
			@updateMerger.p.writeStreamToDisk = sinon.stub().callsArgWith(2, null, @fsPath)
			@FileTypeManager.isBinary = sinon.stub()

		describe "doc updates", () ->
			beforeEach ->
				@doc_id = "231312s"
				@FileTypeManager.isBinary.callsArgWith(2, null, false)
				@projectLocator.findElementByPath = sinon.stub().callsArgWith(2, null, _id: @doc_id)
				@updateMerger.p.processDoc = sinon.stub().callsArgWith(6)
				@filePath = "/folder/doc.tex"

			it 'should get the element id', (done)->
				@updateMerger.mergeUpdate @user_id, @project_id, @path, @update, @source, =>
					@projectLocator.findElementByPath.calledWith(@project_id, @path).should.equal true
					done()

			it 'should take a project lock', (done)->
				@updateMerger.mergeUpdate @user_id, @project_id, @path, @update, @source, =>
					@LockManager.runWithLock.calledWith(@project_id).should.equal true
					done()

			it 'should process update as doc', (done)->
				@updateMerger.mergeUpdate @user_id, @project_id, @filePath, @update, @source, =>
					@FileTypeManager.isBinary.calledWith(@filePath, @fsPath).should.equal true
					@updateMerger.p.processDoc.calledWith(@project_id, @doc_id, @user_id, @fsPath, @filePath, @source).should.equal true
					@fs.unlink.calledWith(@fsPath).should.equal true
					done()

		describe "file updates", () ->
			beforeEach ->
				@file_id = "1231"
				@projectLocator.findElementByPath = sinon.stub().callsArgWith(2, null, _id: @file_id)
				@FileTypeManager.isBinary.callsArgWith(2, null, true)
				@updateMerger.p.processFile = sinon.stub().callsArgWith(6)
				@filePath = "/folder/file1.png"

			it 'should process update as file when it is not a doc', (done)->
				@updateMerger.mergeUpdate @user_id, @project_id, @filePath, @update, @source, =>
					@updateMerger.p.processFile.calledWith(@project_id, @file_id, @fsPath, @filePath, @source, @user_id).should.equal true
					@FileTypeManager.isBinary.calledWith(@filePath, @fsPath).should.equal true
					@fs.unlink.calledWith(@fsPath).should.equal true
					done()

	describe 'deleteUpdate', (done)->
		beforeEach ->
			@path = "folder/doc1"
			@type = "mock-type"
			@editorController.deleteEntityWithoutLock = ->
			@entity_id = "entity_id_here"
			@entity = _id:@entity_id
			@projectLocator.findElementByPath = sinon.stub().callsArgWith(2, null, @entity, @type)
			@editorController.deleteEntityWithoutLock = sinon.stub().callsArg(5)

		it 'should get the element id', (done)->
			@updateMerger.deleteUpdate @user_id, @project_id, @path, @source, =>
				@projectLocator.findElementByPath.calledWith(@project_id, @path).should.equal true
				done()

		it 'should take a project lock', (done)->
			@updateMerger.deleteUpdate @user_id, @project_id, @path, @source, =>
				@LockManager.runWithLock.calledWith(@project_id).should.equal true
				done()

		it 'should delete the entity in the editor controller with the correct type', (done)->
			@entity.lines = []
			@updateMerger.deleteUpdate @user_id, @project_id, @path, @source, =>
				@editorController.deleteEntityWithoutLock
					.calledWith(@project_id, @entity_id, @type, @source, @user_id)
					.should.equal true
				done()

	describe 'private methods', () ->
		describe 'processDoc', (done)->
			beforeEach ->
				@doc_id = "312312klnkld"
				@docLines = "\\documentclass{article}\n\\usepackage[utf8]{inputenc}\n\n\\title{42}\n\\author{Jane Doe}\n\\date{June 2011}"
				@splitDocLines = @docLines.split("\n")
				@fs.readFile = sinon.stub().callsArgWith(2, null, @docLines)

				@editorController.setDoc = sinon.stub().callsArg(5)

				@update.write(@docLines)
				@update.end()

			it 'should set the doc text in the editor controller', (done)->
				@updateMerger.p.processDoc @project_id, @doc_id, @user_id, @update, "path", @source, =>
					@editorController.setDoc
						.calledWith(@project_id, @doc_id, @user_id, @splitDocLines, @source)
						.should.equal true
					done()

			it 'should create a new doc when it doesnt exist', (done)->
				folder = {_id:"adslkjioj"}
				docName = "main.tex"
				path = "folder1/folder2/#{docName}"
				@editorController.mkdirpWithoutLock = sinon.stub().callsArgWith(2, null, [folder], folder)
				@editorController.addDocWithoutLock = sinon.stub().callsArg(6)

				@updateMerger.p.processDoc @project_id, undefined, @user_id, @update, path, @source, =>
					@editorController.mkdirpWithoutLock
						.calledWith(@project_id)
						.should.equal true
					@editorController.addDocWithoutLock
						.calledWith(@project_id, folder._id, docName, @splitDocLines, @source, @user_id)
						.should.equal true
					done()

		describe 'processFile', (done)->
			beforeEach ->
				@file_id = "file_id_here"
				@folder_id = "folder_id_here"
				@path = "folder/file.png"
				@folder = _id: @folder_id
				@fileName = "file.png"
				@fsPath = "fs/path.tex"
				@editorController.addFileWithoutLock = sinon.stub().callsArg(6)
				@editorController.replaceFileWithoutLock = sinon.stub().callsArg(5)
				@editorController.deleteEntityWithoutLock = sinon.stub()
				@editorController.mkdirpWithoutLock = sinon.stub().withArgs(@project_id).callsArgWith(2, null, [@folder], @folder)

			it 'should replace file if the file already exists', (done)->
				@updateMerger.p.processFile @project_id, @file_id, @fsPath, @path, @source, @user_id, =>
					@editorController.addFileWithoutLock.called.should.equal false
					@editorController.replaceFileWithoutLock.calledWith(@project_id, @file_id, @fsPath, @source, @user_id).should.equal true
					done()

			it 'should call add file if the file does not exist', (done)->
				@updateMerger.p.processFile @project_id, undefined, @fsPath, @path, @source, @user_id, =>
					@editorController.mkdirpWithoutLock.calledWith(@project_id, "folder/").should.equal true
					@editorController.addFileWithoutLock.calledWith(@project_id, @folder_id, @fileName, @fsPath, @source, @user_id).should.equal true
					@editorController.replaceFileWithoutLock.called.should.equal false
					done()
