chai = require('chai')
assert = require('chai').assert
should = chai.should()
sinon = require 'sinon'
modulePath = "../../../../app/js/Features/Project/ProjectEntityHandler"
SandboxedModule = require('sandboxed-module')
ObjectId = require("mongoose").Types.ObjectId
tk = require 'timekeeper'

describe 'project entity handler', ->
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
				@ProjectEntityHandler._cleanUpEntity @project, _id: @entity_id, 'doc', done

			it "should not attempted to delete from FileStoreHandler", ->
				@FileStoreHandler.deleteFile.called.should.equal false

			it "should delete the doc from the document updater", ->
				@documentUpdaterHandler.deleteDoc.calledWith(project_id, @entity_id).should.equal true

		describe "when the entity is the root document", ->
			beforeEach (done) ->
				@project.rootDoc_id = new ObjectId(@entity_id)
				@ProjectEntityHandler._cleanUpEntity @project, _id: @entity_id, 'doc', done

			it "should unset the root doc id", ->
				@ProjectEntityHandler.unsetRootDoc.calledWith(project_id).should.equal true

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

	describe 'adding doc', ->
		docName = "some new doc"
		docLines = ['1234','abc']

		it 'should call put element', (done)->
			@ProjectModel.putElement = (passedProject_id, passedFolder_id, passedDoc, passedType, callback)-> 
				passedProject_id.should.equal project_id
				passedFolder_id.should.equal folder_id
				passedDoc.name.should.equal docName
				passedDoc.lines[0].should.equal docLines[0]
				passedDoc.lines[1].should.equal docLines[1]
				passedType.should.equal 'doc'
				done()
			@ProjectEntityHandler.addDoc project_id, folder_id, docName, docLines, "", (err, doc, parentFolder)->

		it 'should return doc and parent folder', (done)->
			@ProjectEntityHandler.addDoc project_id, folder_id, docName, docLines, "", (err, doc, parentFolder)->
				parentFolder.should.equal folder_id
				doc.name.should.equal docName
				done()

		it 'should call third party data store', (done)->
			fileSystemPath = "/somehwere/#{docName}"
			@ProjectModel.putElement = (project_id, folder_id, doc, type, callback)-> callback(null, {path:{fileSystem:fileSystemPath}})

			@tpdsUpdateSender.addDoc = (options)=>
				options.project_id.should.equal project_id
				options.docLines.should.equal docLines
				options.path.should.equal fileSystemPath
				options.project_name.should.equal @project.name
				options.rev.should.equal 0
				done()

			@ProjectEntityHandler.addDoc project_id, folder_id, docName, docLines, "",->

		

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

	describe "flushing folders, docs and files", ->
		beforeEach ->
			@project.rootFolder = [
				folders: [{
					name    : "folder1"
					folders : [{
						name    : "folder2"
						folders : [{
							name:"folder4",
							docs:[{name:"doc3", rev:3,lines:["doc3"]}],
							fileRefs:[{_id:"file3_id", rev:3,name:"file3"}],
							folders:[]
							}]
						docs    : [{
							rev:2
							name: "doc2"
							lines: ["doc2", "lines"]
						}]
						fileRefs   : []
					}]
					docs    : []
					fileRefs   : [{
						rev:2
						name : "file2"
						_id  : "file2_id"
					}]
				}, {
					name    : "folder3"
					folders : []
					docs    : []
					fileRefs   : []
				}]
				docs: [{
					rev:1
					name: "doc1"
					lines: ["doc1", "lines"]
				}]
				fileRefs: [{
					rev:1
					_id  : "file1_id"
					name : "file1"
				}]
			]

		it "should work for a very small project", (done)->
			@project.rootFolder[0].folders = []
			@ProjectEntityHandler.getAllDocs project_id, (err, docs) =>
				docs["/doc1"].name.should.equal "doc1"
				@ProjectEntityHandler.getAllFiles project_id, (err, files) =>
					files["/file1"].name.should.equal "file1"
					done()

		it "should be able to get all folders", (done) ->
			@ProjectEntityHandler.getAllFolders project_id, (err, folders) ->
				should.exist folders["/"]
				should.exist folders["/folder1"]
				should.exist folders["/folder1/folder2"]
				should.exist folders["/folder1/folder2/folder4"]
				folders["/folder1/folder2/folder4"].name.should.equal "folder4"
				should.exist folders["/folder3"]
				done()

		it "should be able to get all docs", (done) ->
			@ProjectEntityHandler.getAllDocs project_id, (err, docs) ->
				docs["/doc1"].name.should.equal "doc1"
				docs["/folder1/folder2/doc2"].name.should.equal "doc2"
				docs["/folder1/folder2/folder4/doc3"].lines.should.deep.equal ["doc3"]
				done()

		it "should be able to get all files", (done) ->
			@ProjectEntityHandler.getAllFiles project_id, (err, files) ->
				files["/file1"].name.should.equal "file1"
				files["/folder1/file2"].name.should.equal "file2"
				files["/folder1/folder2/folder4/file3"].name.should.equal "file3"
				done()

		describe "flushProjectToThirdPartyDataStore", ->
			beforeEach (done) ->
				@addedDocs = {}
				@addedFiles = {}
				@tpdsUpdateSender.addDoc = (options, _, callback) =>
					callback()
				sinon.spy @tpdsUpdateSender, "addDoc"
				@tpdsUpdateSender.addFile = (options, _, callback) =>
					callback()
				sinon.spy @tpdsUpdateSender, "addFile"
				@documentUpdaterHandler.flushProjectToMongo = (project_id, sl_req_id, callback) ->
					callback()
				sinon.spy @documentUpdaterHandler, "flushProjectToMongo"

				@ProjectEntityHandler.flushProjectToThirdPartyDataStore project_id, (err) -> done()

			it "should flush the documents from the document updater", ->
				@documentUpdaterHandler.flushProjectToMongo
					.calledWith(@project._id).should.equal true
				@documentUpdaterHandler.flushProjectToMongo
					.calledBefore(@tpdsUpdateSender.addDoc).should.equal true
				@documentUpdaterHandler.flushProjectToMongo
					.calledBefore(@tpdsUpdateSender.addFile).should.equal true

			it "should call addDoc for each doc", ->
				@tpdsUpdateSender.addDoc.calledWith(
					project_id : @project._id
					path : "/doc1"
					docLines: ["doc1", "lines"]
					project_name: @project.name
					rev:1
				).should.equal true
				@tpdsUpdateSender.addDoc.calledWith(
					project_id : @project._id
					path : "/folder1/folder2/doc2"
					docLines: ["doc2", "lines"]
					project_name: @project.name
					rev:2
				).should.equal true

			it "should call addFile for each file", ->
				@tpdsUpdateSender.addFile.calledWith(
					project_id : @project._id
					file_id    : "file1_id"
					path       : "/file1"
					project_name: @project.name
					rev:1
				).should.equal true
				@tpdsUpdateSender.addFile.calledWith(
					project_id : @project._id
					file_id    : "file2_id"
					path       : "/folder1/file2"
					project_name: @project.name
					rev:2
				).should.equal true
	
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