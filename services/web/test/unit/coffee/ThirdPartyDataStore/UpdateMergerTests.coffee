Stream = require('stream')
SandboxedModule = require('sandboxed-module')
sinon = require('sinon')
require('chai').should()
modulePath = require('path').join __dirname, '../../../../app/js/Features/ThirdPartyDataStore/UpdateMerger.js'
BufferedStream = require('bufferedstream')

describe 'UpdateMerger :', ->
	beforeEach ->
		@updateMerger = SandboxedModule.require modulePath, requires:
			'fs': @fs =
				unlink:sinon.stub().callsArgWith(1)
			'logger-sharelatex':
				log: ->
				err: ->
			'../Editor/EditorController': @EditorController = {}
			'../Uploads/FileTypeManager':@FileTypeManager = {}
			'../../infrastructure/FileWriter': @FileWriter = {}
			'../Project/ProjectEntityHandler': @ProjectEntityHandler = {}
			'settings-sharelatex':{path:{dumpPath:"dump_here"}}
		@project_id = "project_id_here"
		@user_id = "mock-user-id"

		@docPath = @newDocPath = "/folder/doc.tex"
		@filePath = @newFilePath = "/folder/file.png"

		@existingDocPath = '/folder/other.tex'
		@existingFilePath = '/folder/fig1.pdf'
		
		@linkedFileData = {provider: 'url'}

		@existingDocs = [ 
			{path: '/main.tex'}
			{path: '/folder/other.tex'}
		]
		@existingFiles = [
			{path: '/figure.pdf'}
			{path: '/folder/fig1.pdf'}
		]
		@ProjectEntityHandler.getAllEntities = sinon.stub().callsArgWith(1, null, @existingDocs, @existingFiles)

		@fsPath = "/tmp/file/path"
		@source = "dropbox"
		@updateRequest = new BufferedStream()
		@FileWriter.writeStreamToDisk = sinon.stub().yields(null, @fsPath)
		@callback = sinon.stub()

	describe 'mergeUpdate', ->
	
		describe "doc updates for a new doc", ->

			beforeEach ->
				@FileTypeManager.getType = sinon.stub().yields(null, false)
				@updateMerger.p.processDoc = sinon.stub().yields()
				@updateMerger.mergeUpdate @user_id, @project_id, @docPath, @updateRequest, @source, @callback

			it 'should look at the file contents', ->
				@FileTypeManager.getType.called.should.equal true

			it 'should process update as doc', ->
				@updateMerger.p.processDoc
					.calledWith(@project_id, @user_id, @fsPath, @docPath, @source)
					.should.equal true

			it 'removes the temp file from disk', ->
				@fs.unlink.calledWith(@fsPath).should.equal true

		describe "file updates for a new file ", ->
			beforeEach ->
				@FileTypeManager.getType = sinon.stub().yields(null, true)
				@updateMerger.p.processFile = sinon.stub().yields()
				@updateMerger.mergeUpdate @user_id, @project_id, @filePath, @updateRequest, @source, @callback

			it 'should look at the file contents', ->
				@FileTypeManager.getType.called.should.equal true

			it 'should process update as file', ->
				@updateMerger.p.processFile
					.calledWith(@project_id, @fsPath, @filePath, @source, @user_id)
					.should.equal true

			it 'removes the temp file from disk', ->
				@fs.unlink.calledWith(@fsPath).should.equal true

		describe "doc updates for an existing doc", ->
			beforeEach ->
				@FileTypeManager.getType = sinon.stub()
				@updateMerger.p.processDoc = sinon.stub().yields()
				@updateMerger.mergeUpdate @user_id, @project_id, @existingDocPath, @updateRequest, @source, @callback

			it 'should not look at the file contents', ->
				@FileTypeManager.getType.called.should.equal false

			it 'should process update as doc', ->
				@updateMerger.p.processDoc
					.calledWith(@project_id, @user_id, @fsPath, @existingDocPath, @source)
					.should.equal true

			it 'removes the temp file from disk', ->
				@fs.unlink.calledWith(@fsPath).should.equal true

		describe "file updates for an existing file", ->
			beforeEach ->
				@FileTypeManager.getType = sinon.stub()
				@updateMerger.p.processFile = sinon.stub().yields()
				@updateMerger.mergeUpdate @user_id, @project_id, @existingFilePath, @updateRequest, @source, @callback

			it 'should not look at the file contents', ->
				@FileTypeManager.getType.called.should.equal false

			it 'should process update as file', ->
				@updateMerger.p.processFile
					.calledWith(@project_id, @fsPath, @existingFilePath, @source, @user_id)
					.should.equal true

			it 'removes the temp file from disk', ->
				@fs.unlink.calledWith(@fsPath).should.equal true

	describe 'deleteUpdate', ->
		beforeEach ->
			@EditorController.deleteEntityWithPath = sinon.stub().yields()
			@updateMerger.deleteUpdate @user_id, @project_id, @docPath, @source, @callback

		it 'should delete the entity in the editor controller', ->
			@EditorController.deleteEntityWithPath
				.calledWith(@project_id, @docPath, @source, @user_id)
				.should.equal true

	describe 'private methods', ->
		describe 'processDoc', ->
			beforeEach ->
				@docLines = "\\documentclass{article}\n\\usepackage[utf8]{inputenc}\n\n\\title{42}\n\\author{Jane Doe}\n\\date{June 2011}"
				@updateMerger.p.readFileIntoTextArray = sinon.stub().yields(null, @docLines)
				@EditorController.upsertDocWithPath = sinon.stub().yields()

				@updateMerger.p.processDoc @project_id, @user_id, @fsPath, @docPath, @source, @callback

			it 'reads the temp file from disk', ->
				@updateMerger.p.readFileIntoTextArray
					.calledWith(@fsPath)
					.should.equal true

			it 'should upsert the doc in the editor controller', ->
				@EditorController.upsertDocWithPath
					.calledWith(@project_id, @docPath, @docLines, @source, @user_id)
					.should.equal true

		describe 'processFile', ->
			beforeEach ->
				@EditorController.upsertFileWithPath = sinon.stub().yields()
				@updateMerger.p.processFile @project_id, @fsPath, @filePath, @source, @user_id, @callback

			it 'should upsert the file in the editor controller', ->
				@EditorController.upsertFileWithPath
					.calledWith(@project_id, @filePath, @fsPath, null, @source, @user_id)
					.should.equal true
