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
		@fs = {}
		@FileTypeManager = {}
		@updateMerger = SandboxedModule.require modulePath, requires:
			'../Editor/EditorController': @editorController
			'../Project/ProjectLocator': @projectLocator
			'../Project/ProjectEntityHandler': @projectEntityHandler
			'fs': @fs
			'../Uploads/FileTypeManager':@FileTypeManager
			'logger-sharelatex':
				log: ->
				err: ->
		@project_id = "project_id_here"
		@update = new BufferedStream()
		@update.headers = {}

	describe 'mergeUpdate :', ->
		beforeEach ->
			@path = "/doc1"
			@fsPath = "file/system/path.tex"
			@updateMerger.p.writeStreamToDisk = sinon.stub().callsArgWith(3, null, @fsPath)
			@FileTypeManager.isBinary = sinon.stub()
			@FileTypeManager.shouldIgnore = sinon.stub()

		it 'should get the element id', (done)->

			@projectLocator.findElementByPath = sinon.spy()

			@updateMerger.mergeUpdate @project_id, @path, @update, "", =>

			@projectLocator.findElementByPath.calledWith(@project_id, @path).should.equal true
			done()


		it 'should ignore update if FileTypeManger says ignore', (done)->
			filePath = ".gitignore"
			@projectLocator.findElementByPath = (_, __, cb)->cb(null, {_id:"id"})
			@FileTypeManager.shouldIgnore.callsArgWith(1, null, true)
			@updateMerger.mergeUpdate @project_id, filePath, @update, "", =>
				@FileTypeManager.isBinary.called.should.equal false
				@FileTypeManager.shouldIgnore.calledWith(filePath).should.equal true
				done()


		it 'should process update as doc when it is a doc', (done)->
			doc_id = "231312s"
			@FileTypeManager.isBinary.callsArgWith(1, null, false)
			@projectLocator.findElementByPath = (_, __, cb)->cb(null, {_id:doc_id})
			@FileTypeManager.shouldIgnore.callsArgWith(1, null, false)
			@updateMerger.p.processDoc = sinon.stub().callsArgWith(5)
			filePath = "/folder/doc.tex"

			@updateMerger.mergeUpdate @project_id, filePath, @update, "", =>
				@FileTypeManager.isBinary.calledWith(filePath).should.equal true
				@updateMerger.p.processDoc.calledWith(@project_id, doc_id, @fsPath).should.equal true
				done()

		it 'should process update as file when it is not a doc', (done)->
			file_id = "1231"
			@projectLocator.findElementByPath = (_, __, cb)->cb(null, {_id:file_id})
			@FileTypeManager.isBinary.callsArgWith(1, null, true)
			@FileTypeManager.shouldIgnore.callsArgWith(1, null, false)
			@updateMerger.p.processFile = sinon.stub().callsArgWith(4)
			filePath = "/folder/file1.png"

			@updateMerger.mergeUpdate @project_id, filePath, @update, "", =>
				@updateMerger.p.processFile.calledWith(@project_id, file_id, @fsPath).should.equal true
				@FileTypeManager.isBinary.calledWith(filePath).should.equal true
				done()


	describe 'processDoc :', (done)->
		beforeEach ->
			@doc_id = "312312klnkld"
			@docLines = "\\documentclass{article}\n\\usepackage[utf8]{inputenc}\n\n\\title{42}\n\\author{Jane Doe}\n\\date{June 2011}"
			@splitDocLines = @docLines.split("\n")
			@fs.readFile = sinon.stub().callsArgWith(2, null, @docLines)

		it 'should set the doc text in the editor controller', (done)->
			@editorController.setDoc = ->
			mock = sinon.mock(@editorController).expects("setDoc").withArgs(@project_id, @doc_id, @splitDocLines).callsArg(4)

			@update.write(@docLines)
			@update.end()

			@updateMerger.p.processDoc @project_id, @doc_id, @update, "path", "", ->
				mock.verify()
				done()

		it 'should create a new doc when it doesnt exist', (done)->
			folder = {_id:"adslkjioj"}
			docName = "main.tex"
			path = "folder1/folder2/#{docName}"
			@editorController.mkdirp = sinon.stub().withArgs(@project_id).callsArgWith(2, null, [folder], folder)
			@editorController.addDoc = ->
			mock = sinon.mock(@editorController).expects("addDoc").withArgs(@project_id, folder._id, docName, @splitDocLines).callsArg(5)

			@update.write(@docLines)
			@update.end()

			@updateMerger.p.processDoc @project_id, undefined, @update, path, "", ->
				mock.verify()
				done()

	describe 'processFile :', (done)->
		beforeEach ->
			@file_id = "file_id_here"
			@folder_id = "folder_id_here"
			@path = "folder/file.png"
			@folder = _id: @folder_id
			@fileName = "file.png"
			@fsPath = "fs/path.tex"
			@editorController.addFile = sinon.stub().callsArg(4)
			@editorController.replaceFile = sinon.stub().callsArg(3)
			@editorController.deleteEntity = sinon.stub()
			@editorController.mkdirp = sinon.stub().withArgs(@project_id).callsArgWith(2, null, [@folder], @folder)
			@updateMerger.p.writeStreamToDisk = sinon.stub().withArgs(@project_id, @file_id, @update).callsArgWith(3, null, @fsPath)

		it 'should replace file if the file already exists', (done)->
			@updateMerger.p.processFile @project_id, @file_id, @fsPath, @path, =>
				@editorController.addFile.called.should.equal false
				@editorController.replaceFile.calledWith(@project_id, @file_id, @fsPath).should.equal true
				done()

		it 'should call add file if the file does not exist', (done)->
			@updateMerger.p.processFile @project_id, undefined, @fsPath, @path, =>
				@editorController.mkdirp.calledWith(@project_id, "folder/").should.equal true
				@editorController.addFile.calledWith(@project_id, @folder_id, @fileName, @fsPath).should.equal true
				@editorController.replaceFile.called.should.equal false
				done()

	describe 'delete entity :', (done)->

		beforeEach ->
			@path = "folder/doc1"
			@editorController.deleteEntity = ->
			@entity_id = "entity_id_here"
			@entity = _id:@entity_id
			@projectLocator.findElementByPath = (project_id, path, cb)=> cb(null, @entity, @path)

		it 'should get the element id', ->
			@projectLocator.findElementByPath = sinon.spy()
			@updateMerger.deleteUpdate @project_id, @path, "", ->
			@projectLocator.findElementByPath.calledWith(@project_id, @path).should.equal true

		it 'should delete the entity in the editor controller with type doc when entity has docLines array', (done)->
			@entity.lines = []
			mock = sinon.mock(@editorController).expects("deleteEntity").withArgs(@project_id, @entity_id, "doc").callsArg(4)
			@updateMerger.deleteUpdate @project_id, @path, "", ->
				mock.verify()
				done()

		it 'should delete the entity in the editor controller with type folder when entity has folders array', (done)->
			@entity.folders = []
			mock = sinon.mock(@editorController).expects("deleteEntity").withArgs(@project_id, @entity_id, "folder").callsArg(4)
			@updateMerger.deleteUpdate @project_id, @path, "", ->
				mock.verify()
				done()

		it 'should delete the entity in the editor controller with type file when entity has no interesting properties', (done)->
			mock = sinon.mock(@editorController).expects("deleteEntity").withArgs(@project_id, @entity_id, "file").callsArg(4)
			@updateMerger.deleteUpdate @project_id, @path, "", ->
				mock.verify()
				done()

	
