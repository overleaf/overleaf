chai = require('chai')
assert = require('chai').assert
should = chai.should()
expect = chai.expect
sinon = require 'sinon'
modulePath = "../../../../app/js/Features/Project/ProjectEntityHandler"
SandboxedModule = require('sandboxed-module')
ObjectId = require("mongoose").Types.ObjectId
tk = require 'timekeeper'

describe 'ProjectEntityHandler', ->
	project_id = '4eecb1c1bffa66588e0000a1'
	folder_id = "4eecaffcbffa66588e000008"
	rootFolderId = "4eecaffcbffa66588e000007"
	
	beforeEach ->
		@FileStoreHandler =  
			uploadFileFromDisk:(project_id, fileRef,  localImagePath, callback)->callback()
			copyFile: sinon.stub().callsArgWith(4, null)
		@tpdsUpdateSender =
			addDoc:sinon.stub().callsArg(2)
			addFile:sinon.stub().callsArg(2)
			addFolder:sinon.stub().callsArg(2)
		@rootFolder = 
			_id:rootFolderId, 
			folders:[
				{name:"level1", folders:[]}
			]
		@ProjectModel = class Project
			constructor:(options)->
				@._id = project_id
				@name = "project_name_here"
				@rev = 0
			save:(callback)->callback()
			rootFolder:[@rootFolder]
		@DocModel = class Doc
			constructor:(options)->
				{@name, @lines} = options
				@_id = "mock-id"	
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
		@ProjectModel.putElement = (project_id, folder_id, doc, type, callback)-> callback(null, {path:{fileSystem:"somehintg"}})
		@projectUpdater = markAsUpdated:sinon.stub()
		@ProjectEntityHandler = SandboxedModule.require modulePath, requires:
			'../../models/Project': Project:@ProjectModel
			'../../models/Doc': Doc:@DocModel
			'../../models/Folder': Folder:@FolderModel
			'../../models/File': File:@FileModel
			'../FileStore/FileStoreHandler':@FileStoreHandler
			'../ThirdPartyDataStore/TpdsUpdateSender':@tpdsUpdateSender
			'./ProjectLocator':@projectLocator = {}
			'../../Features/DocumentUpdater/DocumentUpdaterHandler':@documentUpdaterHandler = {}
			'../Docstore/DocstoreManager': @DocstoreManager = {}
			'logger-sharelatex':{log:->}
			'./ProjectUpdateHandler': @projectUpdater
			"./ProjectGetter": @ProjectGetter = {}


	describe 'mkdirp', ->
		beforeEach ->
			@parentFolder_id = "1jnjknjk"
			@newFolder = {_id:"newFolder_id_here"}
			@lastFolder = {_id:"123das", folders:[]}
			@projectLocator.findElementByPath = (project_id, path, cb)=>
				@parentFolder = {_id:"parentFolder_id_here"}
				lastFolder = path.substring(path.lastIndexOf("/"))
				if lastFolder.indexOf("level1") == -1
					cb "level1 is not the last foler "
				else
					cb null, @parentFolder
			@ProjectEntityHandler.addFolder = (project_id, parentFolder_id, folderName, sl_req_id, callback)=>
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

	describe 'deleting an element', ->
		entity_id = "4eecaffcbffa66588e000009"
		beforeEach ->
			@tpdsUpdateSender.deleteEntity = sinon.stub().callsArg(2)
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
				@ProjectEntityHandler._cleanUpDoc = sinon.stub().callsArg(3)
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

				@ProjectEntityHandler._cleanUpDoc = sinon.stub().callsArg(3)
				@ProjectEntityHandler._cleanUpFile = sinon.stub().callsArg(3)
				@ProjectEntityHandler._cleanUpEntity @project, @folder, "folder", done

			it "should clean up all sub files", ->
				@ProjectEntityHandler._cleanUpFile.calledWith(@project, @file1).should.equal true
				@ProjectEntityHandler._cleanUpFile.calledWith(@project, @file2).should.equal true

			it "should clean up all sub docs", ->
				@ProjectEntityHandler._cleanUpDoc.calledWith(@project, @doc1).should.equal true
				@ProjectEntityHandler._cleanUpDoc.calledWith(@project, @doc2).should.equal true

	describe 'moving an element', ->
		beforeEach ->
			@docId = "4eecaffcbffa66588e000009"
			@doc = {lines:["1234","312343d"], rev: "1234"}

		it 'should find the project then element', (done)->
			@projectLocator.findElement = (options, callback)=>
				options.element_id.should.equal @docId
				options.type.should.equal 'docs'
				done()
			@ProjectEntityHandler.moveEntity project_id, @docId, folder_id, "docs", ->

		it 'should remove the element then add it back in', (done)->

			path = {mongo:"folders[0]"}
			@projectLocator.findElement = (opts, callback)=>
				callback(null, @doc, path)
			@ProjectEntityHandler._removeElementFromMongoArray = (model, model_id, path, callback)-> callback()

			@ProjectModel.putElement = (passedProject_id, destinationFolder_id, entity, entityType, callback)=>
				passedProject_id.should.equal project_id
				destinationFolder_id.should.equal folder_id
				entity.should.deep.equal @doc
				entityType.should.equal 'docs'
				done()
			@ProjectEntityHandler.moveEntity project_id, @docId, folder_id, "docs", ->

		it 'should tell the third party data store', (done)->
			startPath = {fileSystem:"/somewhere.txt"}
			endPath = {fileSystem:"/somewhere.txt"}

			@projectLocator.findElement = (opts, callback)=>
				callback(null, @doc, startPath)
			@ProjectEntityHandler._removeElementFromMongoArray = (model, model_id, path, callback)-> callback()
			@ProjectModel.putElement = (passedProject_id, destinationFolder_id, entity, entityType, callback)->
				callback null, path:endPath

			@tpdsUpdateSender.moveEntity = (opts)=>
				opts.project_id.should.equal project_id
				opts.startPath.should.equal startPath.fileSystem
				opts.endPath.should.equal endPath.fileSystem
				opts.project_name.should.equal @project.name
				opts.rev.should.equal @doc.rev
				done()
			@ProjectEntityHandler.moveEntity project_id, @docId, folder_id, "docs", ->


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

	describe 'addDoc', ->
		beforeEach ->
			@name = "some new doc"
			@lines = ['1234','abc']
			@path = "/path/to/doc"

			@ProjectModel.putElement = sinon.stub().callsArgWith(4, null, {path:{fileSystem:@path}})
			@callback = sinon.stub()
			@tpdsUpdateSender.addDoc = sinon.stub().callsArg(2)
			@DocstoreManager.updateDoc = sinon.stub().callsArgWith(4, null, 0)

			@ProjectEntityHandler.addDoc project_id, folder_id, @name, @lines, @callback

			# Created doc
			@doc = @ProjectModel.putElement.args[0][2]
			@doc.name.should.equal @name
			expect(@doc.lines).to.be.undefined

		it 'should call put element', ->
			@ProjectModel.putElement
				.calledWith(project_id, folder_id, @doc)
				.should.equal true

		it 'should return doc and parent folder', ->
			@callback.calledWith(null, @doc, folder_id).should.equal true

		it 'should call third party data store', ->
			@tpdsUpdateSender.addDoc
				.calledWith({
					project_id: project_id
					docLines: @lines
					path: @path
					project_name: @project.name
					rev: 0
				})
				.should.equal true

		it "should send the doc lines to the doc store", ->
			@DocstoreManager.updateDoc
				.calledWith(project_id, @doc._id.toString(), @lines, 0)
				.should.equal true

	describe 'adding file', ->
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
			@ProjectModel.putElement = (passedProject_id, passedFolder_id, passedFileRef, passedType, callback)->
				passedProject_id.should.equal project_id
				passedFolder_id.should.equal folder_id
				passedFileRef.name.should.equal fileName
				passedType.should.equal 'file'
				done()

			@ProjectEntityHandler.addFile project_id, folder_id, fileName, {}, (err, fileRef, parentFolder)->

		it 'should return doc and parent folder', (done)->
			@ProjectEntityHandler.addFile project_id, folder_id, fileName, {}, (err, fileRef, parentFolder)->
				parentFolder.should.equal folder_id
				fileRef.name.should.equal fileName
				done()

		it 'should call third party data store', (done)->
			@project.existsInVersioningApi = true
			opts =
				path : "/somehwere/idsadsds"
				project_id : project_id
			@ProjectModel.putElement = (project_id, folder_id, doc, type, callback)-> callback(null, {path:{fileSystem:opts.path}})

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
				differenceInMs.should.be.below(10)
				done()

			@ProjectEntityHandler.replaceFile project_id, @file_id, @fsPath, =>


	describe 'adding a folder', ->
		folderName = "folder1234"

		it 'should call put element', (done)->
			@ProjectModel.putElement = (passedProject_id, passedFolder_id, passedFolder, passedType, callback)->
				passedProject_id.should.equal project_id
				passedFolder_id.should.equal folder_id
				passedFolder.name.should.equal folderName
				passedType.should.equal 'folder'
				done()
			@ProjectEntityHandler.addFolder project_id, folder_id, folderName, (err, folder, parentFolder)->

		it 'should return the folder and parent folder', (done)->
			@ProjectEntityHandler.addFolder project_id, folder_id, folderName, (err, folder, parentFolder)->
				parentFolder.should.equal folder_id
				folder.name.should.equal folderName
				done()


	describe 'updating document lines', ->
		docId = "123456"
		docLines = ['1234','abc', '543543']
		mongoPath = "folders[0].folders[5]"
		fileSystemPath = "/somehwere/something.tex"

		it 'should find project via getProject', (done)->
			@ProjectModel.getProject = (passedProject_id, callback)->
				passedProject_id.should.equal project_id
				done()

			@ProjectEntityHandler.updateDocLines project_id, "", [], ->

		it 'should find the doc', (done)->
			
			@projectLocator.findElement = (options, callback)->
				options.element_id.should.equal docId
				options.type.should.equal 'docs'
				done()

			@ProjectEntityHandler.updateDocLines project_id, docId, "", ->

		it 'should build mongo update statment', (done)->
			@projectLocator.findElement = (opts, callback)->
				callback(null, {lines:[], rev:0}, {mongo:mongoPath})

			@ProjectModel.update = (conditions, update, options, callback)->
				conditions._id.should.equal project_id
				update.$set["#{mongoPath}.lines"].should.equal docLines
				update.$inc["#{mongoPath}.rev"].should.equal 1
				done()

			@ProjectEntityHandler.updateDocLines project_id, docId, docLines, ->

		it 'should call third party data store ', (done)->
			rev = 3
			@projectLocator.findElement = (opts, callback)->
				callback(null, {lines:[],rev:rev}, {fileSystem:fileSystemPath})
			@ProjectModel.update = (conditions, update, options, callback)-> callback()
			@tpdsUpdateSender.addDoc = (options, _, callback)=>
				options.project_id.should.equal project_id
				options.docLines.should.equal docLines
				options.path.should.equal fileSystemPath
				options.project_name.should.equal @project.name
				options.rev.should.equal (rev+1)
				callback()
				@projectUpdater.markAsUpdated.calledWith(project_id).should.equal true
			@ProjectEntityHandler.updateDocLines project_id, docId, docLines, done

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
			@documentUpdaterHandler.flushProjectToMongo = sinon.stub().callsArg(2)
			@tpdsUpdateSender.addDoc = sinon.stub().callsArg(2)
			@tpdsUpdateSender.addFile = sinon.stub().callsArg(2)
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

			@ProjectEntityHandler.flushProjectToThirdPartyDataStore project_id, () -> done()

		it "should flush the project from the doc updater", ->
			@documentUpdaterHandler.flushProjectToMongo
				.calledWith(project_id)
				.should.equal true

		it "should look up the project in mongo", ->
			@ProjectModel.findById
				.calledWith(project_id)
				.should.equal true

		it "should get all the docs in the project", ->
			@ProjectEntityHandler.getAllDocs
				.calledWith(project_id)
				.should.equal true

		it "should get all the files in the project", ->
			@ProjectEntityHandler.getAllFiles
				.calledWith(project_id)
				.should.equal true

		it "should flush each doc to the TPDS", ->
			for path, doc of @docs
				@tpdsUpdateSender.addDoc
					.calledWith({
						project_id: project_id,
						docLines: doc.lines
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

		it 'should copy the file in FileStoreHandler', (done)->
			@ProjectEntityHandler.copyFileFromExistingProject project_id, folder_id, oldProject_id, oldFileRef, (err, fileRef, parentFolder)=>     
				@FileStoreHandler.copyFile.calledWith(oldProject_id, oldFileRef._id, project_id, fileRef._id).should.equal true
				done()

		it 'should put file into folder by calling put element', (done)->
			@ProjectModel.putElement = (passedProject_id, passedFolder_id, passedFileRef, passedType, callback)-> 
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
			@ProjectModel.putElement = (project_id, folder_id, doc, type, callback)-> callback(null, {path:{fileSystem:opts.path}})

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