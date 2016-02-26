chai = require('chai')
assert = require('chai').assert
should = chai.should()
expect = chai.expect
sinon = require 'sinon'
modulePath = "../../../../app/js/Features/Project/ProjectEntityHandler"
SandboxedModule = require('sandboxed-module')
ObjectId = require("mongoose").Types.ObjectId
tk = require 'timekeeper'
Errors = require "../../../../app/js/errors"

describe 'ProjectEntityHandler', ->
	project_id = '4eecb1c1bffa66588e0000a1'
	doc_id = '4eecb1c1bffa66588e0000a2'
	folder_id = "4eecaffcbffa66588e000008"
	rootFolderId = "4eecaffcbffa66588e000007"
	
	beforeEach ->
		@FileStoreHandler =  
			uploadFileFromDisk:(project_id, fileRef,  localImagePath, callback)->callback()
			copyFile: sinon.stub().callsArgWith(4, null)
		@tpdsUpdateSender =
			addDoc:sinon.stub().callsArg(1)
			addFile:sinon.stub().callsArg(1)
			addFolder:sinon.stub().callsArg(1)
		@rootFolder = 
			_id:rootFolderId, 
			folders:[
				{name:"level1", folders:[]}
			]
		@ProjectUpdateStub = sinon.stub()
		@ProjectModel = class Project
			constructor:(options)->
				@._id = project_id
				@name = "project_name_here"
				@rev = 0
			save:(callback)->callback()
			rootFolder:[@rootFolder]
		@ProjectModel.update = @ProjectUpdateStub

		@DocModel = class Doc
			constructor:(options)->
				{@name, @lines} = options
				@_id = doc_id
				@rev = 0
		@FileModel =  class File
			constructor:(options)->
				{@name} = options
				@._id = "file_id" 
				@rev = 0
		@FolderModel = class Folder
			constructor:(options)->
				{@name} = options

		@project = new @ProjectModel()
		@project.rootFolder = [@rootFolder]

		@ProjectModel.findById = (project_id, callback)=> callback(null, @project)
		@ProjectModel.getProject = (project_id, fields, callback)=> callback(null, @project)
		@ProjectGetter = 
			getProjectWithOnlyFolders : (project_id, callback)=> callback(null, @project)
			getProject:sinon.stub()
		@projectUpdater = markAsUpdated:sinon.stub()
		@projectLocator = 
			findElement : sinon.stub()
		@ProjectEntityHandler = SandboxedModule.require modulePath, requires:
			'../../models/Project': Project:@ProjectModel
			'../../models/Doc': Doc:@DocModel
			'../../models/Folder': Folder:@FolderModel
			'../../models/File': File:@FileModel
			'../FileStore/FileStoreHandler':@FileStoreHandler
			'../ThirdPartyDataStore/TpdsUpdateSender':@tpdsUpdateSender
			'./ProjectLocator': @projectLocator
			'../../Features/DocumentUpdater/DocumentUpdaterHandler':@documentUpdaterHandler = {}
			'../Docstore/DocstoreManager': @DocstoreManager = {}
			'logger-sharelatex': @logger = {log:sinon.stub(), error: sinon.stub(), err:->}
			'./ProjectUpdateHandler': @projectUpdater
			"./ProjectGetter": @ProjectGetter


	describe 'mkdirp', ->
		beforeEach ->
			@parentFolder_id = "1jnjknjk"
			@newFolder = {_id:"newFolder_id_here"}
			@lastFolder = {_id:"123das", folders:[]}
			@ProjectGetter.getProjectWithOnlyFolders = sinon.stub().callsArgWith(1, null, @project)
			@projectLocator.findElementByPath = (project_id, path, cb)=>
				@parentFolder = {_id:"parentFolder_id_here"}
				lastFolder = path.substring(path.lastIndexOf("/"))
				if lastFolder.indexOf("level1") == -1
					cb "level1 is not the last foler "
				else
					cb null, @parentFolder
			@ProjectEntityHandler.addFolder = (project_id, parentFolder_id, folderName, callback)=>
				callback null, {name:folderName}, @parentFolder_id 
		
		it 'should return the root folder if the path is just a slash', (done)->
			path = "/"
			@ProjectEntityHandler.mkdirp project_id, path, (err, folders, lastFolder)=>
				lastFolder.should.deep.equal @rootFolder
				assert.equal lastFolder.parentFolder_id, undefined
				done()


		it 'should make just one folder', (done)->
			path = "/differentFolder/"
			@ProjectEntityHandler.mkdirp project_id, path, (err, folders, lastFolder)=>
				folders.length.should.equal 1
				lastFolder.name.should.equal "differentFolder"
				lastFolder.parentFolder_id.should.equal @parentFolder_id
				done()

		it 'should make the final folder in path if it doesnt exist with one level', (done)->
			path = "level1/level2"
			@ProjectEntityHandler.mkdirp project_id, path, (err, folders, lastFolder)=>
				folders.length.should.equal 1
				lastFolder.name.should.equal "level2"
				lastFolder.parentFolder_id.should.equal @parentFolder_id
				done()


		it 'should make the final folder in path if it doesnt exist with mutliple levels', (done)->
			path = "level1/level2/level3"

			@ProjectEntityHandler.mkdirp project_id, path,(err, folders, lastFolder) =>
				folders.length.should.equal 2
				folders[0].name.should.equal "level2"
				folders[0].parentFolder_id.should.equal @parentFolder_id
				lastFolder.name.should.equal "level3"
				lastFolder.parentFolder_id.should.equal @parentFolder_id
				done()

		it 'should work with slashes either side', (done)->
			path = "/level1/level2/level3/"

			@ProjectEntityHandler.mkdirp project_id, path, (err, folders, lastFolder)=>
				folders.length.should.equal 2
				folders[0].name.should.equal "level2"
				folders[0].parentFolder_id.should.equal @parentFolder_id
				lastFolder.name.should.equal "level3"
				lastFolder.parentFolder_id.should.equal @parentFolder_id
				done()

	describe 'deleteEntity', ->
		entity_id = "4eecaffcbffa66588e000009"
		beforeEach ->
			@ProjectGetter.getProject.callsArgWith(1, null, @project)
			@tpdsUpdateSender.deleteEntity = sinon.stub().callsArg(1)
			@ProjectEntityHandler._removeElementFromMongoArray = sinon.stub().callsArg(3)
			@ProjectEntityHandler._cleanUpEntity = sinon.stub().callsArg(3)
			@path = mongo: "mongo.path", fileSystem: "/file/system/path"
			@projectLocator.findElement = sinon.stub().callsArgWith(1, null, @entity = { _id: entity_id }, @path)

		describe "deleting from Mongo", ->
			beforeEach (done) ->
				@ProjectEntityHandler.deleteEntity project_id, entity_id, @type = 'file', done

			it "should retreive the path", ->
				@projectLocator.findElement.called.should.equal true
				options = @projectLocator.findElement.args[0][0]
				options.type.should.equal @type
				options.project.should.equal @project
				options.element_id.should.equal entity_id

			it "should remove the element from the database", ->
				@ProjectEntityHandler._removeElementFromMongoArray.calledWith(@ProjectModel, project_id, @path.mongo).should.equal true

			it "should call the third party data store", ->
				options = @tpdsUpdateSender.deleteEntity.args[0][0]
				options.project_id.should.equal project_id
				options.path.should.equal @path.fileSystem

			it "should clean up the entity from the rest of the system", ->
				@ProjectEntityHandler._cleanUpEntity
					.calledWith(@project, @entity, @type)
					.should.equal true

	describe "_cleanUpEntity", ->
		beforeEach ->
			@entity_id = "4eecaffcbffa66588e000009"
			@documentUpdaterHandler.deleteDoc = sinon.stub().callsArg(2)
			@FileStoreHandler.deleteFile = sinon.stub().callsArg(2)
			@ProjectEntityHandler.unsetRootDoc = sinon.stub().callsArg(1)

		describe "a file", ->
			beforeEach (done) ->
				@ProjectEntityHandler._cleanUpEntity @project, _id: @entity_id, 'file', done

			it "should delete the file from FileStoreHandler", ->
				@FileStoreHandler.deleteFile.calledWith(project_id, @entity_id).should.equal true

			it "should not attempt to delete from the document updater", ->
				@documentUpdaterHandler.deleteDoc.called.should.equal false

		describe "a doc", ->
			beforeEach (done) ->
				@ProjectEntityHandler._cleanUpDoc = sinon.stub().callsArg(2)
				@ProjectEntityHandler._cleanUpEntity @project, @entity = {_id: @entity_id}, 'doc', done

			it "should clean up the doc", ->
				@ProjectEntityHandler._cleanUpDoc
					.calledWith(@project, @entity)
					.should.equal true

		describe "a folder", ->
			beforeEach (done) ->
				@folder =
					folders: [
						fileRefs: [ @file1 = {_id: "file-id-1" } ]
						docs:     [ @doc1  = { _id: "doc-id-1" } ]
						folders:  []
					]
					fileRefs: [ @file2 = { _id: "file-id-2" } ]
					docs:     [ @doc2  = { _id: "doc-id-2" } ]

				@ProjectEntityHandler._cleanUpDoc = sinon.stub().callsArg(2)
				@ProjectEntityHandler._cleanUpFile = sinon.stub().callsArg(2)
				@ProjectEntityHandler._cleanUpEntity @project, @folder, "folder", done

			it "should clean up all sub files", ->
				@ProjectEntityHandler._cleanUpFile.calledWith(@project, @file1).should.equal true
				@ProjectEntityHandler._cleanUpFile.calledWith(@project, @file2).should.equal true

			it "should clean up all sub docs", ->
				@ProjectEntityHandler._cleanUpDoc.calledWith(@project, @doc1).should.equal true
				@ProjectEntityHandler._cleanUpDoc.calledWith(@project, @doc2).should.equal true

	describe 'moveEntity', ->
		beforeEach ->
			@pathAfterMove = {
				fileSystem: "/somewhere/else.txt"
			}
			@ProjectEntityHandler._removeElementFromMongoArray = sinon.stub().callsArg(3)
			@ProjectEntityHandler._putElement = sinon.stub().callsArgWith(4, null, path: @pathAfterMove)
			@ProjectGetter.getProject.callsArgWith(1, null, @project)
			@tpdsUpdateSender.moveEntity = sinon.stub().callsArg(1)
			
		describe "moving a doc", ->
			beforeEach (done) ->
				@docId = "4eecaffcbffa66588e000009"
				@doc = {lines:["1234","312343d"], rev: "1234"}
				@path = {
					mongo:"folders[0]"
					fileSystem:"/somewhere.txt"
				}
				@projectLocator.findElement = sinon.stub().callsArgWith(1, null, @doc, @path)
				@ProjectEntityHandler.moveEntity project_id, @docId, folder_id, "docs", done

			it 'should find the project then element', ->
				@projectLocator.findElement
					.calledWith({
						element_id: @docId,
						type: "docs",
						project: @project
					})
					.should.equal true

			it 'should remove the element from its current position', ->
				@ProjectEntityHandler._removeElementFromMongoArray
					.calledWith(
						@ProjectModel,
						project_id,
						@path.mongo
					)
					.should.equal true
					
			it "should put the element back in the new folder", ->
				@ProjectEntityHandler._putElement
					.calledWith(
						project_id,
						folder_id,
						@doc,
						"docs"
					)
					.should.equal true
					
			it 'should tell the third party data store', ->
				@tpdsUpdateSender.moveEntity
					.calledWith({
						project_id: project_id,
						startPath: @path.fileSystem
						endPath: @pathAfterMove.fileSystem
						project_name: @project.name
						rev: @doc.rev
					})
					.should.equal true
					
		describe "moving a folder", ->
			beforeEach ->
				@folder_id = "folder-to-move"
				@move_to_folder_id = "folder-to-move-to"
				@folder = { name: "folder" }
				@folder_to_move_to = { name: "folder to move to" }
				@path = {
					mongo:      "folders[0]"
					fileSystem: "/somewhere.txt"
				}
				@pathToMoveTo = {
					mongo:      "folders[0]"
					fileSystem: "/somewhere.txt"
				}
				@projectLocator.findElement = (options, callback) =>
					if options.element_id == @folder_id
						callback(null, @folder, @path)
					else if options.element_id == @move_to_folder_id
						callback(null, @folder_to_move_to, @pathToMoveTo)
					else
						console.log "UNKNOWN ID", options
				sinon.spy @projectLocator, "findElement"
						
			describe "when the destination folder is outside the moving folder", ->
				beforeEach (done) ->
					@path.fileSystem = "/one/directory"
					@pathToMoveTo.fileSystem = "/another/directory"
					@ProjectEntityHandler.moveEntity project_id, @folder_id, @move_to_folder_id, "folder", done

				it 'should find the project then element', ->
					@projectLocator.findElement
						.calledWith({
							element_id: @folder_id,
							type: "folder",
							project: @project
						})
						.should.equal true

				it 'should remove the element from its current position', ->
					@ProjectEntityHandler._removeElementFromMongoArray
						.calledWith(
							@ProjectModel,
							project_id,
							@path.mongo
						)
						.should.equal true
						
				it "should put the element back in the new folder", ->
					@ProjectEntityHandler._putElement
						.calledWith(
							project_id,
							@move_to_folder_id,
							@folder,
							"folder"
						)
						.should.equal true
						
				it 'should tell the third party data store', ->
					@tpdsUpdateSender.moveEntity
						.calledWith({
							project_id: project_id,
							startPath: @path.fileSystem
							endPath: @pathAfterMove.fileSystem
							project_name: @project.name,
							rev: @folder.rev
						})
						.should.equal true
						
			describe "when the destination folder is inside the moving folder", ->
				beforeEach ->
					@path.fileSystem = "/one/two"
					@pathToMoveTo.fileSystem = "/one/two/three"
					@callback = sinon.stub()
					@ProjectEntityHandler.moveEntity project_id, @folder_id, @move_to_folder_id, "folder", @callback

				it 'should find the folder we are moving to as well element', ->
					@projectLocator.findElement
						.calledWith({
							element_id: @move_to_folder_id,
							type: "folder",
							project: @project
						})
						.should.equal true
						
				it "should return an error", ->
					@callback
						.calledWith(new Error("destination folder is a child folder of me"))
						.should.equal true

	describe 'removing element from mongo array', ->
		it 'should call update with log the path', (done)->
			mongoPath = "folders[0].folders[5]"
			id = "12344"
			firstUpdate = true
			model =
				update: (conditions, update, opts, callback)->
					if firstUpdate
						conditions._id.should.equal id
						update.$unset[mongoPath].should.equal 1
						firstUpdate = false
						callback()
					else
						conditions._id.should.equal id
						assert.deepEqual update, { '$pull': { 'folders[0]': null } }
						done()
			@ProjectEntityHandler._removeElementFromMongoArray model, id, mongoPath, ->

	describe 'getDoc', ->
		beforeEach ->
			@lines = ["mock", "doc", "lines"]
			@rev = 5
			@DocstoreManager.getDoc = sinon.stub().callsArgWith(3, null, @lines, @rev)
			@ProjectEntityHandler.getDoc project_id, doc_id, @callback

		it "should call the docstore", ->
			@DocstoreManager.getDoc
				.calledWith(project_id, doc_id)
				.should.equal true

		it "should call the callback with the lines, version and rev", ->
			@callback.calledWith(null, @lines, @rev).should.equal true

	describe 'addDoc', ->
		beforeEach ->
			@name = "some new doc"
			@lines = ['1234','abc']
			@path = "/path/to/doc"

			@ProjectEntityHandler._putElement = sinon.stub().callsArgWith(4, null, {path:{fileSystem:@path}})
			@callback = sinon.stub()
			@tpdsUpdateSender.addDoc = sinon.stub().callsArg(1)
			@DocstoreManager.updateDoc = sinon.stub().callsArgWith(3, null, true, 0)

			@ProjectEntityHandler.addDoc project_id, folder_id, @name, @lines, @callback

			# Created doc
			@doc = @ProjectEntityHandler._putElement.args[0][2]
			@doc.name.should.equal @name
			expect(@doc.lines).to.be.undefined

		it 'should call put element', ->
			@ProjectEntityHandler._putElement
				.calledWith(project_id, folder_id, @doc)
				.should.equal true

		it 'should return doc and parent folder', ->
			@callback.calledWith(null, @doc, folder_id).should.equal true

		it 'should call third party data store', ->
			@tpdsUpdateSender.addDoc
				.calledWith({
					project_id: project_id
					doc_id: doc_id
					path: @path
					project_name: @project.name
					rev: 0
				})
				.should.equal true

		it "should send the doc lines to the doc store", ->
			@DocstoreManager.updateDoc
				.calledWith(project_id, @doc._id.toString(), @lines)
				.should.equal true

	describe "restoreDoc", ->
		beforeEach ->
			@name = "doc-name"
			@lines = ['1234','abc']
			@doc = { "mock": "doc" }
			@folder_id = "mock-folder-id"
			@callback = sinon.stub()
			@ProjectEntityHandler.getDoc = sinon.stub().callsArgWith(3, null, @lines)
			@ProjectEntityHandler.addDoc = sinon.stub().callsArgWith(4, null, @doc, @folder_id)

			@ProjectEntityHandler.restoreDoc project_id, doc_id, @name, @callback

		it 'should get the doc lines', ->
			@ProjectEntityHandler.getDoc
				.calledWith(project_id, doc_id, include_deleted: true)
				.should.equal true

		it "should add a new doc with these doc lines", ->
			@ProjectEntityHandler.addDoc
				.calledWith(project_id, null, @name, @lines)
				.should.equal true

		it "should call the callback with the new folder and doc", ->
			@callback.calledWith(null, @doc, @folder_id).should.equal true

	describe 'addFile', ->
		fileName = "something.jpg"
		beforeEach ->
			@filePath = "somewhere"
		it 'should upload it via the FileStoreHandler', (done)->
			@FileStoreHandler.uploadFileFromDisk = (passedProject_id, file_id, filePath, callback)=>
				file_id.should.equal "file_id"
				passedProject_id.should.equal project_id
				filePath.should.equal @filePath
				done()

			@ProjectEntityHandler.addFile project_id, folder_id, fileName, @filePath, (err, fileRef, parentFolder)->

		it 'should put file into folder by calling put element', (done)->
			@ProjectEntityHandler._putElement = (passedProject_id, passedFolder_id, passedFileRef, passedType, callback)->
				passedProject_id.should.equal project_id
				passedFolder_id.should.equal folder_id
				passedFileRef.name.should.equal fileName
				passedType.should.equal 'file'
				done()

			@ProjectEntityHandler.addFile project_id, folder_id, fileName, {}, (err, fileRef, parentFolder)->

		it 'should return doc and parent folder', (done)->
			@ProjectEntityHandler._putElement = sinon.stub().callsArgWith(4, null, {path:{fileSystem:"somehintg"}})
			@ProjectEntityHandler.addFile project_id, folder_id, fileName, {}, (err, fileRef, parentFolder)->
				parentFolder.should.equal folder_id
				fileRef.name.should.equal fileName
				done()

		it 'should call third party data store', (done)->
			@project.existsInVersioningApi = true
			opts =
				path : "/somehwere/idsadsds"
				project_id : project_id
			@ProjectEntityHandler._putElement = (project_id, folder_id, doc, type, callback)-> callback(null, {path:{fileSystem:opts.path}})

			@tpdsUpdateSender.addFile = (options)=>
				options.project_id.should.equal project_id
				options.path.should.equal opts.path
				options.project_name.should.equal @project.name
				options.file_id.should.not.be.null
				options.rev.should.equal 0
				done()

			@ProjectEntityHandler.addFile project_id, folder_id, fileName, {}, (err, fileRef, parentFolder)->

	describe 'replacing a file', ->

		beforeEach ->
			@projectLocator
			@file_id = "file_id_here"
			@fsPath = "fs_path_here.png"
			@fileRef = {rev:3, _id:@file_id}
			@filePaths = {fileSystem:"/folder1/file.png", mongo:"folder.1.files.somewhere"}
			@projectLocator.findElement = sinon.stub().callsArgWith(1, null, @fileRef, @filePaths)
			@ProjectModel.update = (_, __, ___, cb)-> cb()

		it 'should find the file', (done)->

			@ProjectEntityHandler.replaceFile project_id, @file_id, @fsPath, =>
				@projectLocator.findElement.calledWith({element_id:@file_id, type:"file", project_id:project_id}).should.equal true
				done()

		it 'should tell the file store handler to upload the file from disk', (done)->
			@FileStoreHandler.uploadFileFromDisk = sinon.stub().callsArgWith(3)
			@ProjectEntityHandler.replaceFile project_id, @file_id, @fsPath, =>
				@FileStoreHandler.uploadFileFromDisk.calledWith(project_id, @file_id, @fsPath).should.equal true
				done()


		it 'should send the file to the tpds with an incremented rev', (done)->
			@tpdsUpdateSender.addFile = (options)=>
				options.project_id.should.equal project_id
				options.path.should.equal @filePaths.fileSystem
				options.project_name.should.equal @project.name
				options.file_id.should.equal @file_id
				options.rev.should.equal @fileRef.rev + 1
				done()

			@ProjectEntityHandler.replaceFile project_id, @file_id, @fsPath, =>

		it 'should inc the rev id', (done)->
			@ProjectModel.update = (conditions, update, options, callback)=>
				conditions._id.should.equal project_id
				update.$inc["#{@filePaths.mongo}.rev"].should.equal 1
				done()

			@ProjectEntityHandler.replaceFile project_id, @file_id, @fsPath, =>

		it 'should update the created at date', (done)->
			d = new Date()
			@ProjectModel.update = (conditions, update, options, callback)=>
				conditions._id.should.equal project_id
				differenceInMs = update.$set["#{@filePaths.mongo}.created"].getTime() - d.getTime()
				differenceInMs.should.be.below(20)
				done()

			@ProjectEntityHandler.replaceFile project_id, @file_id, @fsPath, =>


	describe 'adding a folder', ->
		folderName = "folder1234"

		it 'should call put element', (done)->
			@ProjectEntityHandler._putElement = (passedProject_id, passedFolder_id, passedFolder, passedType, callback)->
				passedProject_id.should.equal project_id
				passedFolder_id.should.equal folder_id
				passedFolder.name.should.equal folderName
				passedType.should.equal 'folder'
				done()
			@ProjectEntityHandler.addFolder project_id, folder_id, folderName, (err, folder, parentFolder)->

		it 'should return the folder and parent folder', (done)->
			@ProjectEntityHandler._putElement = sinon.stub().callsArgWith(4)
			@ProjectEntityHandler.addFolder project_id, folder_id, folderName, (err, folder, parentFolder)->
				parentFolder.should.equal folder_id
				folder.name.should.equal folderName
				done()


	describe 'updateDocLines', ->
		beforeEach ->
			@lines = ['mock', 'doc', 'lines']
			@path = "/somewhere/something.tex"
			@doc = {
				_id: doc_id
			}
			@ProjectGetter.getProjectWithoutDocLines = sinon.stub().callsArgWith(1, null, @project)
			@projectLocator.findElement = sinon.stub().callsArgWith(1, null, @doc, {fileSystem: @path})
			@tpdsUpdateSender.addDoc = sinon.stub().callsArg(1)
			@projectUpdater.markAsUpdated = sinon.stub()
			@callback = sinon.stub()

		describe "when the doc has been modified", ->
			beforeEach ->
				@DocstoreManager.updateDoc = sinon.stub().callsArgWith(3, null, true, @rev = 5)
				@ProjectEntityHandler.updateDocLines project_id, doc_id, @lines, @callback

			it "should get the project without doc lines", ->
				@ProjectGetter.getProjectWithoutDocLines
					.calledWith(project_id)
					.should.equal true

			it "should find the doc", ->
				@projectLocator.findElement
					.calledWith({
						project: @project
						type: "docs"
						element_id: doc_id
					})
					.should.equal true

			it "should update the doc in the docstore", ->
				@DocstoreManager.updateDoc
					.calledWith(project_id, doc_id, @lines)
					.should.equal true

			it "should mark the project as updated", ->
				@projectUpdater.markAsUpdated
					.calledWith(project_id)
					.should.equal true

			it "should send the doc the to the TPDS", ->
				@tpdsUpdateSender.addDoc
					.calledWith({
						project_id: project_id
						project_name: @project.name
						doc_id: doc_id
						rev: @rev
						path: @path
					})
					.should.equal true

			it "should call the callback", ->
				@callback.called.should.equal true

		describe "when the doc has not been modified", ->
			beforeEach ->
				@DocstoreManager.updateDoc = sinon.stub().callsArgWith(3, null, false, @rev = 5)
				@ProjectEntityHandler.updateDocLines project_id, doc_id, @lines, @callback

			it "should not mark the project as updated", ->
				@projectUpdater.markAsUpdated.called.should.equal false

			it "should not send the doc the to the TPDS", ->
				@tpdsUpdateSender.addDoc.called.should.equal false

			it "should call the callback", ->
				@callback.called.should.equal true

		describe "when the project is not found", ->
			beforeEach ->
				@ProjectGetter.getProjectWithoutDocLines = sinon.stub().callsArgWith(1, null, null)
				@ProjectEntityHandler.updateDocLines project_id, doc_id, @lines, @callback

			it "should return a not found error", ->
				@callback.calledWith(new Errors.NotFoundError()).should.equal true

		describe "when the doc is not found", ->
			beforeEach ->
				@projectLocator.findElement = sinon.stub().callsArgWith(1, null, null, null)
				@ProjectEntityHandler.updateDocLines project_id, doc_id, @lines, @callback

			it "should log out the error", ->
				@logger.error
					.calledWith(
						project_id: project_id
						doc_id: doc_id
						lines: @lines
						err: new Errors.NotFoundError("doc not found")
						"doc not found while updating doc lines"
					)
					.should.equal true

			it "should return a not found error", ->
				@callback.calledWith(new Errors.NotFoundError()).should.equal true


	describe "getting folders, docs and files", ->
		beforeEach ->
			@project.rootFolder = [
				docs: [@doc1 = {
					name  : "doc1"
					_id   : "doc1_id"
				}]
				fileRefs: [@file1 = {
					rev  : 1
					_id  : "file1_id"
					name : "file1"
				}]
				folders: [@folder1 = {
					name    : "folder1"
					docs    : [@doc2 = {
						name  : "doc2"
						_id   : "doc2_id"
					}]
					fileRefs   : [@file2 = {
						rev  : 2
						name : "file2"
						_id  : "file2_id"
					}]
					folders : []
				}]
			]
			@ProjectGetter.getProjectWithoutDocLines = sinon.stub().callsArgWith(1, null, @project)

		describe "getAllFolders", ->
			beforeEach ->
				@callback = sinon.stub()
				@ProjectEntityHandler.getAllFolders project_id, @callback

			it "should get the project without the docs lines", ->
				@ProjectGetter.getProjectWithoutDocLines
					.calledWith(project_id)
					.should.equal true

			it "should call the callback with the folders", ->
				@callback
					.calledWith(null, {
						"/": @project.rootFolder[0]
						"/folder1": @folder1
					})
					.should.equal true

		describe "getAllFiles", ->
			beforeEach ->
				@callback = sinon.stub()
				@ProjectEntityHandler.getAllFiles project_id, @callback

			it "should call the callback with the files", ->
				@callback
					.calledWith(null, {
						"/file1": @file1
						"/folder1/file2": @file2
					})
					.should.equal true

		describe "getAllDocs", ->
			beforeEach ->
				@docs = [{
					_id:   @doc1._id
					lines: @lines1 = ["one"]
					rev:   @rev1 = 1
				}, {
					_id:   @doc2._id
					lines: @lines2 = ["two"]
					rev:   @rev2 = 2
				}]
				@DocstoreManager.getAllDocs = sinon.stub().callsArgWith(1, null, @docs)
				@ProjectEntityHandler.getAllDocs project_id, @callback

			it "should get the doc lines and rev from the docstore", ->
				@DocstoreManager.getAllDocs
					.calledWith(project_id)
					.should.equal true

			it "should call the callback with the docs with the lines and rev included", ->
				@callback
					.calledWith(null, {
						"/doc1": {
							_id:   @doc1._id
							lines: @lines1
							name:  @doc1.name
							rev:   @rev1
						}
						"/folder1/doc2":  {
							_id:   @doc2._id
							lines: @lines2
							name:  @doc2.name
							rev:   @rev2
						}
					})
					.should.equal true

	describe "flushProjectToThirdPartyDataStore", ->
		beforeEach (done) ->
			@project = {
				_id: project_id
				name: "Mock project name"
			}
			@ProjectModel.findById = sinon.stub().callsArgWith(1, null, @project)
			@documentUpdaterHandler.flushProjectToMongo = sinon.stub().callsArg(1)
			@tpdsUpdateSender.addDoc = sinon.stub().callsArg(1)
			@tpdsUpdateSender.addFile = sinon.stub().callsArg(1)
			@docs = {
				"/doc/one": @doc1 = { _id: "mock-doc-1", lines: ["one"], rev: 5 }
				"/doc/two": @doc2 = { _id: "mock-doc-2", lines: ["two"], rev: 6 }
			}
			@files = {
				"/file/one": @file1 = { _id: "mock-file-1", rev: 7 }
				"/file/two": @file2 = { _id: "mock-file-2", rev: 8 }
			}
			@ProjectEntityHandler.getAllDocs = sinon.stub().callsArgWith(1, null, @docs)
			@ProjectEntityHandler.getAllFiles = sinon.stub().callsArgWith(1, null, @files)

			@ProjectGetter.getProject.callsArgWith(1, null, @project)

			@ProjectEntityHandler.flushProjectToThirdPartyDataStore project_id, () -> done()

		it "should flush the project from the doc updater", ->
			@documentUpdaterHandler.flushProjectToMongo.calledWith(project_id).should.equal true

		it "should look up the project in mongo", ->
			@ProjectGetter.getProject.calledWith(project_id).should.equal true

		it "should get all the docs in the project", ->
			@ProjectEntityHandler.getAllDocs.calledWith(project_id).should.equal true

		it "should get all the files in the project", ->
			@ProjectEntityHandler.getAllFiles.calledWith(project_id).should.equal true

		it "should flush each doc to the TPDS", ->
			for path, doc of @docs
				@tpdsUpdateSender.addDoc
					.calledWith({
						project_id: project_id,
						doc_id: doc._id
						project_name: @project.name
						rev: doc.rev
						path: path
					})
					.should.equal true

		it "should flush each file to the TPDS", ->
			for path, file of @files
				@tpdsUpdateSender.addFile
					.calledWith({
						project_id: project_id,
						file_id: file._id
						project_name: @project.name
						rev: file.rev
						path: path
					})
					.should.equal true
	
	describe "setRootDoc", ->
		it "should call Project.update", ->
			@project_id = "project-id-123234adfs"
			@rootDoc_id = "root-doc-id-123123"
			@ProjectModel.update = sinon.stub()
			@ProjectEntityHandler.setRootDoc @project_id, @rootDoc_id
			@ProjectModel.update.calledWith({_id : @project_id}, {rootDoc_id: @rootDoc_id})
				.should.equal true

	describe "unsetRootDoc", ->
		it "should call Project.update", ->
			@project_id = "project-id-123234adfs"
			@rootDoc_id = "root-doc-id-123123"
			@ProjectModel.update = sinon.stub()
			@ProjectEntityHandler.unsetRootDoc @project_id
			@ProjectModel.update.calledWith({_id : @project_id}, {$unset : {rootDoc_id: true}})
				.should.equal true

	describe 'copying file', ->
		fileName = "something.jpg"
		filePath = "dumpFolder/somewhere/image.jpeg"
		oldProject_id = "123kljadas"
		oldFileRef = {name:fileName, _id:"oldFileRef"}
		beforeEach ->
			@ProjectModel.getProject = (project_id, fields, callback)=> callback(null, {name:@project.name, _id:@project._id})
			@ProjectEntityHandler._putElement = sinon.stub().callsArgWith(4, null, {path:{fileSystem:"somehintg"}})


		it 'should copy the file in FileStoreHandler', (done)->
			@ProjectEntityHandler._putElement = sinon.stub().callsArgWith(4, null, {path:{fileSystem:"somehintg"}})
			@ProjectEntityHandler.copyFileFromExistingProject project_id, folder_id, oldProject_id, oldFileRef, (err, fileRef, parentFolder)=>     
				@FileStoreHandler.copyFile.calledWith(oldProject_id, oldFileRef._id, project_id, fileRef._id).should.equal true
				done()

		it 'should put file into folder by calling put element', (done)->
			@ProjectEntityHandler._putElement = (passedProject_id, passedFolder_id, passedFileRef, passedType, callback)-> 
				passedProject_id.should.equal project_id
				passedFolder_id.should.equal folder_id
				passedFileRef.name.should.equal fileName
				passedType.should.equal 'file'
				done()

			@ProjectEntityHandler.copyFileFromExistingProject project_id, folder_id, oldProject_id, oldFileRef, (err, fileRef, parentFolder)->     

		it 'should return doc and parent folder', (done)->
			@ProjectEntityHandler.copyFileFromExistingProject project_id, folder_id, oldProject_id, oldFileRef, (err, fileRef, parentFolder)->     
				parentFolder.should.equal folder_id
				fileRef.name.should.equal fileName
				done()

		it 'should call third party data store if versioning is enabled', (done)->
			@project.existsInVersioningApi = true
			opts =
				path : "/somehwere/idsadsds"
				project_id : project_id
			@ProjectEntityHandler._putElement = (project_id, folder_id, doc, type, callback)-> callback(null, {path:{fileSystem:opts.path}})

			@tpdsUpdateSender.addFile = (options)=>
				options.project_id.should.equal project_id
				options.project_name.should.equal @project.name
				options.path.should.equal opts.path
				options.file_id.should.not.be.null
				options.rev.should.equal 0
				done()

			@ProjectEntityHandler.copyFileFromExistingProject project_id, folder_id, oldProject_id, oldFileRef, (err, fileRef, parentFolder)->     


	describe "renameEntity", ->
		beforeEach ->
			@entity_id = "4eecaffcbffa66588e000009"
			@entityType = "doc"
			@newName = "new.tex"
			@path = mongo: "mongo.path", fileSystem: "/file/system/old.tex"
			@projectLocator.findElement = sinon.stub().callsArgWith(1, null, @entity = { _id: @entity_id, name:"old.tex", rev:4 }, @path)
			@ProjectModel.update = sinon.stub().callsArgWith(3)
			@tpdsUpdateSender.moveEntity = sinon.stub()
			@ProjectGetter.getProject.callsArgWith(1, null, @project)

		it "should update the name in mongo", (done)->

			@ProjectEntityHandler.renameEntity @project_id, @entity_id, @entityType, @newName, =>
				@ProjectModel.update.calledWith({_id : @project_id}, {"$set":{"mongo.path.name":@newName}}).should.equal true
				done()

		it "should send the update to the tpds", (done)->
			@ProjectEntityHandler.renameEntity @project_id, @entity_id, @entityType, @newName, =>
				@tpdsUpdateSender.moveEntity.calledWith({project_id:@project_id, startPath:@path.fileSystem, endPath:"/file/system/new.tex", project_name:@project.name, rev:4}).should.equal true
				done()

	describe "_insertDeletedDocReference", ->
		beforeEach ->
			@doc =
				_id: ObjectId()
				name: "test.tex"
			@callback = sinon.stub()
			@ProjectModel.update = sinon.stub().callsArgWith(3)
			@ProjectEntityHandler._insertDeletedDocReference project_id, @doc, @callback

		it "should insert the doc into deletedDocs", ->
			@ProjectModel.update
				.calledWith({
					_id: project_id
				}, {
					$push: {
						deletedDocs: {
							_id: @doc._id
							name: @doc.name
						}
					}
				})
				.should.equal true

		it "should call the callback", ->
			@callback.called.should.equal true

	describe "_cleanUpDoc", ->
		beforeEach ->
			@project =
				_id: ObjectId(project_id)
			@doc =
				_id: ObjectId()
				name: "test.tex"
			@ProjectEntityHandler.unsetRootDoc = sinon.stub().callsArg(1)
			@ProjectEntityHandler._insertDeletedDocReference = sinon.stub().callsArg(2)
			@documentUpdaterHandler.deleteDoc = sinon.stub().callsArg(2)
			@DocstoreManager.deleteDoc = sinon.stub().callsArg(2)
			@callback = sinon.stub()

		describe "when the doc is the root doc", ->
			beforeEach ->
				@project.rootDoc_id = @doc._id
				@ProjectEntityHandler._cleanUpDoc @project, @doc, @callback

			it "should unset the root doc", ->
				@ProjectEntityHandler.unsetRootDoc
					.calledWith(project_id)
					.should.equal true

			it "should delete the doc in the doc updater", ->
				@documentUpdaterHandler.deleteDoc
					.calledWith(project_id, @doc._id.toString())

			it "should insert the doc into the deletedDocs array", ->
				@ProjectEntityHandler._insertDeletedDocReference
					.calledWith(@project._id, @doc)
					.should.equal true

			it "should delete the doc in the doc store", ->
				@DocstoreManager.deleteDoc
					.calledWith(project_id, @doc._id.toString())
					.should.equal true

			it "should call the callback", ->
				@callback.called.should.equal true

		describe "when the doc is not the root doc", ->
			beforeEach ->
				@project.rootDoc_id = ObjectId()
				@ProjectEntityHandler._cleanUpDoc @project, @doc, @callback

			it "should not unset the root doc", ->
				@ProjectEntityHandler.unsetRootDoc.called.should.equal false

			it "should call the callback", ->
				@callback.called.should.equal true


	describe "_putElement", ->
		beforeEach ->
			@project_id = project_id
			@project =
				_id: ObjectId(project_id)
				rootFolder: [_id:ObjectId()]
			@folder =
				_id: ObjectId()
				name: "someFolder"
			@doc = 
				_id: ObjectId()
				name: "new.tex"
			@path = mongo: "mongo.path", fileSystem: "/file/system/old.tex"
			@ProjectGetter.getProject.callsArgWith(2, null, @project)
			@projectLocator.findElement.callsArgWith(1, null, @folder, @path)
			@ProjectUpdateStub.callsArgWith(3)


		describe "updating the project", ->
			

			it "should use the correct mongo path", (done)->
				@ProjectEntityHandler._putElement @project_id, @folder._id, @doc, "docs", (err)=>
					@ProjectModel.update.args[0][0]._id.should.equal @project_id
					assert.deepEqual @ProjectModel.update.args[0][1].$push[@path.mongo+".docs"], @doc
					done()

			it "should add an s onto the type if not included", (done)->
				@ProjectEntityHandler._putElement @project_id, @folder._id, @doc, "doc", (err)=>
					assert.deepEqual @ProjectModel.update.args[0][1].$push[@path.mongo+".docs"], @doc
					done()


			it "should not call update if elemenet is null", (done)->
				@ProjectEntityHandler._putElement @project_id, @folder._id, null, "doc", (err)=>
					@ProjectModel.update.called.should.equal false
					done()

			it "should default to root folder insert", (done)->
				@ProjectEntityHandler._putElement @project_id, null, @doc, "doc", (err)=>
					@projectLocator.findElement.args[0][0].element_id.should.equal @project.rootFolder[0]._id
					done()



		describe "_countElements", ->

			beforeEach ->
				@project.rootFolder[0].docs = [{_id:123}, {_id:345}]
				@project.rootFolder[0].fileRefs = [{_id:123}, {_id:345}, {_id:456}]
				@project.rootFolder[0].folders = [
					{
						docs:
							[{_id:123}, {_id:345}, {_id:456}]
						fileRefs:{}
						folders: [
							{
								docs:[_id:1234], 
								fileRefs:[{_id:23123}, {_id:123213}, {_id:2312}]
								folders:[
									{
										docs:[{_id:321321}, {_id:123213}]
										fileRefs:[{_id:312321}]
										folders:[]
									}
								]
							}
						]
					},{
						docs:[{_id:123}, {_id:32131}]
						fileRefs:[]
						folders:[
							{
								docs:[{_id:3123}]
								fileRefs:[{_id:321321}, {_id:321321}, {_id:313122}]
								folders:0
							}
						]
					}
				]				

			it "should return the correct number", (done)->
				@ProjectEntityHandler._countElements @project, (err, count)->
					count.should.equal 21
					done()

			it "should deal with null folders", (done)->
				@project.rootFolder[0].folders[0].folders = undefined
				@ProjectEntityHandler._countElements @project, (err, count)->
					count.should.equal 14
					done()				

			it "should deal with null docs", (done)->
				@project.rootFolder[0].folders[0].docs = undefined
				@ProjectEntityHandler._countElements @project, (err, count)->
					count.should.equal 18
					done()				

			it "should deal with null fileRefs", (done)->
				@project.rootFolder[0].folders[0].folders[0].fileRefs = undefined
				@ProjectEntityHandler._countElements @project, (err, count)->
					count.should.equal 18
					done()	





