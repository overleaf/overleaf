SandboxedModule = require('sandboxed-module')
sinon = require('sinon')
require('chai').should()
expect = require("chai").expect

modulePath = require('path').join __dirname, '../../../../app/js/Features/Editor/EditorController'
MockClient = require "../helpers/MockClient"
assert = require('assert')

describe "EditorController", ->
	beforeEach ->
		@project_id = "test-project-id"
		@project =
			_id: @project_id
			owner_ref:{_id:"something"}


		@doc_id = "test-doc-id"
		@source = "dropbox"

		@user =
			_id: @user_id = "user-id"
			projects: {}

		@rooms = {}
		@io =
			sockets :
				clients : (room_id) =>
					@rooms[room_id]
		@DocumentUpdaterHandler = {}
		@ProjectOptionsHandler =
			setCompiler : sinon.spy()
			setSpellCheckLanguage: sinon.spy()
		@ProjectEntityHandler = 
			flushProjectToThirdPartyDataStore:sinon.stub()
		@Project =
			findPopulatedById: sinon.stub().callsArgWith(1, null, @project)
		@client = new MockClient()

		@settings = 
			apis:{thirdPartyDataStore:{emptyProjectFlushDelayMiliseconds:0.5}}
			redis: web:{}
		@dropboxProjectLinker = {}
		@callback = sinon.stub()
		@ProjectDetailsHandler = 
			setProjectDescription:sinon.stub()
		@CollaboratorsHandler = 
			removeUserFromProject: sinon.stub().callsArgWith(2)
			addUserToProject: sinon.stub().callsArgWith(3)
		@ProjectDeleter =
			deleteProject: sinon.stub()
		@LockManager =
			getLock : sinon.stub()
			releaseLock : sinon.stub()
		@EditorController = SandboxedModule.require modulePath, requires:
			"../../infrastructure/Server" : io : @io
			'../Project/ProjectEntityHandler' : @ProjectEntityHandler
			'../Project/ProjectOptionsHandler' : @ProjectOptionsHandler
			'../Project/ProjectDetailsHandler': @ProjectDetailsHandler
			'../Project/ProjectDeleter' : @ProjectDeleter
			'../Collaborators/CollaboratorsHandler': @CollaboratorsHandler
			'../DocumentUpdater/DocumentUpdaterHandler' : @DocumentUpdaterHandler
			'../../models/Project' : Project: @Project
			"settings-sharelatex":@settings
			'../Dropbox/DropboxProjectLinker':@dropboxProjectLinker
			'./EditorRealTimeController':@EditorRealTimeController = {}
			"../../infrastructure/Metrics": @Metrics = { inc: sinon.stub() }
			"../TrackChanges/TrackChangesManager": @TrackChangesManager = {}
			"../../infrastructure/LockManager":@LockManager
			'redis-sharelatex':createClient:-> auth:->
			"logger-sharelatex": @logger =
				log: sinon.stub()
				err: sinon.stub()

	describe "updating compiler used for project", ->
		it "should send the new compiler and project id to the project options handler", (done)->
			compiler = "latex"
			@EditorRealTimeController.emitToRoom = sinon.stub()
			@EditorController.setCompiler @project_id, compiler, (err) =>
				@ProjectOptionsHandler.setCompiler.calledWith(@project_id, compiler).should.equal true
				@EditorRealTimeController.emitToRoom.calledWith(@project_id, "compilerUpdated", compiler).should.equal true
				done()
			@ProjectOptionsHandler.setCompiler.args[0][2]()


	describe "updating language code used for project", ->
		it "should send the new languageCode and project id to the project options handler", (done)->
			languageCode = "fr"
			@EditorRealTimeController.emitToRoom = sinon.stub()
			@EditorController.setSpellCheckLanguage @project_id, languageCode, (err) =>
				@ProjectOptionsHandler.setSpellCheckLanguage.calledWith(@project_id, languageCode).should.equal true
				@EditorRealTimeController.emitToRoom.calledWith(@project_id, "spellCheckLanguageUpdated", languageCode).should.equal true
				done()
			@ProjectOptionsHandler.setSpellCheckLanguage.args[0][2]()


	describe 'setDoc', ->
		beforeEach ->
			@docLines = ["foo", "bar"]
			@DocumentUpdaterHandler.flushDocToMongo = sinon.stub().callsArg(2)
			@DocumentUpdaterHandler.setDocument = sinon.stub().callsArg(4)

		it 'should send the document to the documentUpdaterHandler', (done)->
			@DocumentUpdaterHandler.setDocument = sinon.stub().withArgs(@project_id, @doc_id, @docLines, @source).callsArg(4)
			@EditorController.setDoc @project_id, @doc_id, @docLines, @source, (err)->
				done()

		it 'should send the new doc lines to the doucment updater', (done)->
			@DocumentUpdaterHandler.setDocument = ->
			mock = sinon.mock(@DocumentUpdaterHandler).expects("setDocument").withArgs(@project_id, @doc_id, @docLines, @source).once().callsArg(4)

			@EditorController.setDoc @project_id, @doc_id, @docLines, @source, (err)=>
				mock.verify()
				done()

		it 'should flush the doc to mongo', (done)->
			@EditorController.setDoc @project_id, @doc_id, @docLines, @source, (err)=>
				@DocumentUpdaterHandler.flushDocToMongo.calledWith(@project_id, @doc_id).should.equal true
				done()


	describe 'addDocWithoutLock', ->
		beforeEach ->
			@ProjectEntityHandler.addDoc = ()->
			@EditorRealTimeController.emitToRoom = sinon.stub()
			@project_id = "12dsankj"
			@folder_id = "213kjd"
			@doc = {_id:"123ds"}
			@folder_id = "123ksajdn"
			@docName = "doc.tex"
			@docLines = ["1234","dskl"]

		it 'should add the doc using the project entity handler', (done)->
			mock = sinon.mock(@ProjectEntityHandler).expects("addDoc").withArgs(@project_id, @folder_id, @docName, @docLines).callsArg(4)

			@EditorController.addDocWithoutLock @project_id, @folder_id, @docName, @docLines, @source, ->
				mock.verify()
				done()

		it 'should send the update out to the users in the project', (done)->
			@ProjectEntityHandler.addDoc = sinon.stub().callsArgWith(4, null, @doc, @folder_id)

			@EditorController.addDocWithoutLock @project_id, @folder_id, @docName, @docLines, @source, =>
				@EditorRealTimeController.emitToRoom
					.calledWith(@project_id, "reciveNewDoc", @folder_id, @doc, @source)
					.should.equal true
				done()

		it 'should return the doc to the callback', (done) ->
			@ProjectEntityHandler.addDoc = sinon.stub().callsArgWith(4, null, @doc, @folder_id)
			@EditorController.addDocWithoutLock @project_id, @folder_id, @docName, @docLines, @source, (error, doc) =>
				doc.should.equal @doc
				done()

	describe "addDoc", ->

		beforeEach ->
			@LockManager.getLock.callsArgWith(1)
			@LockManager.releaseLock.callsArgWith(1)
			@EditorController.addDocWithoutLock = sinon.stub().callsArgWith(5)

		it "should call addDocWithoutLock", (done)->
			@EditorController.addDoc @project_id, @folder_id, @docName, @docLines, @source, =>
				@EditorController.addDocWithoutLock.calledWith(@project_id, @folder_id, @docName, @docLines, @source).should.equal true
				done()

		it "should take the lock", (done)->
			@EditorController.addDoc @project_id, @folder_id, @docName, @docLines, @source, =>
				@LockManager.getLock.calledWith(@project_id).should.equal true
				done()

		it "should release the lock", (done)->
			@EditorController.addDoc @project_id, @folder_id, @docName, @docLines, @source, =>
				@LockManager.releaseLock.calledWith(@project_id).should.equal true
				done()

		it "should error if it can't cat the lock", (done)->
			@LockManager.getLock = sinon.stub().callsArgWith(1, "timed out")
			@EditorController.addDoc @project_id, @folder_id, @docName, @docLines, @source, (err)=>
				expect(err).to.exist
				err.should.equal "timed out"
				done()			




	describe 'addFileWithoutLock:', ->
		beforeEach ->
			@ProjectEntityHandler.addFile = ->
			@EditorRealTimeController.emitToRoom = sinon.stub()
			@project_id = "12dsankj"
			@folder_id = "213kjd"
			@fileName = "file.png"
			@folder_id = "123ksajdn"
			@file = {_id:"dasdkjk"}
			@stream = new ArrayBuffer()

		it 'should add the folder using the project entity handler', (done)->
			@ProjectEntityHandler.addFile = sinon.stub().callsArgWith(4)
			@EditorController.addFileWithoutLock @project_id, @folder_id, @fileName, @stream, @source, =>
				@ProjectEntityHandler.addFile.calledWith(@project_id, @folder_id).should.equal true
				done()

		it 'should send the update of a new folder out to the users in the project', (done)->
			@ProjectEntityHandler.addFile = sinon.stub().callsArgWith(4, null, @file, @folder_id)

			@EditorController.addFileWithoutLock @project_id, @folder_id, @fileName, @stream, @source, =>
				@EditorRealTimeController.emitToRoom
					.calledWith(@project_id, "reciveNewFile", @folder_id, @file, @source)
					.should.equal true
				done()

		it "should return the file in the callback", (done) ->
			@ProjectEntityHandler.addFile = sinon.stub().callsArgWith(4, null, @file, @folder_id)
			@EditorController.addFileWithoutLock @project_id, @folder_id, @fileName, @stream, @source, (error, file) =>
				file.should.equal @file
				done()


	describe "addFile", ->

		beforeEach ->
			@LockManager.getLock.callsArgWith(1)
			@LockManager.releaseLock.callsArgWith(1)
			@EditorController.addFileWithoutLock = sinon.stub().callsArgWith(5)

		it "should call addFileWithoutLock", (done)->
			@EditorController.addFile @project_id, @folder_id, @fileName, @stream, @source, (error, file) =>
				@EditorController.addFileWithoutLock.calledWith(@project_id, @folder_id, @fileName, @stream, @source).should.equal true
				done()

		it "should take the lock", (done)->
			@EditorController.addFile @project_id, @folder_id, @fileName, @stream, @source, (error, file) =>
				@LockManager.getLock.calledWith(@project_id).should.equal true
				done()

		it "should release the lock", (done)->
			@EditorController.addFile @project_id, @folder_id, @fileName, @stream, @source, (error, file) =>
				@LockManager.releaseLock.calledWith(@project_id).should.equal true
				done()

		it "should error if it can't cat the lock", (done)->
			@LockManager.getLock = sinon.stub().callsArgWith(1, "timed out")
			@EditorController.addFile @project_id, @folder_id, @fileName, @stream, @source, (err, file) =>
				expect(err).to.exist
				err.should.equal "timed out"
				done()			




	describe "replaceFile", ->
		beforeEach ->
			@project_id = "12dsankj"
			@file_id = "file_id_here"
			@fsPath = "/folder/file.png"

		it 'should send the replace file message to the editor controller', (done)->
			@ProjectEntityHandler.replaceFile = sinon.stub().callsArgWith(3)
			@EditorController.replaceFile @project_id, @file_id, @fsPath, @source, =>
				@ProjectEntityHandler.replaceFile.calledWith(@project_id, @file_id, @fsPath).should.equal true
				done()

	describe 'addFolderWithoutLock :', ->
		beforeEach ->
			@ProjectEntityHandler.addFolder = ->
			@EditorRealTimeController.emitToRoom = sinon.stub()
			@project_id = "12dsankj"
			@folder_id = "213kjd"
			@folderName = "folder"
			@folder = {_id:"123ds"}

		it 'should add the folder using the project entity handler', (done)->
			mock = sinon.mock(@ProjectEntityHandler).expects("addFolder").withArgs(@project_id, @folder_id, @folderName).callsArg(3)

			@EditorController.addFolderWithoutLock @project_id, @folder_id, @folderName, @source, ->
				mock.verify()
				done()

		it 'should notifyProjectUsersOfNewFolder', (done)->
			@ProjectEntityHandler.addFolder = (project_id, folder_id, folderName, callback)=> callback(null, @folder, @folder_id)
			mock = sinon.mock(@EditorController.p).expects('notifyProjectUsersOfNewFolder').withArgs(@project_id, @folder_id, @folder).callsArg(3)

			@EditorController.addFolderWithoutLock @project_id, @folder_id, @folderName, @source, ->
				mock.verify()
				done()

		it 'notifyProjectUsersOfNewFolder should send update out to all users', (done)->
			@EditorController.p.notifyProjectUsersOfNewFolder @project_id, @folder_id, @folder, =>
				@EditorRealTimeController.emitToRoom
					.calledWith(@project_id, "reciveNewFolder", @folder_id, @folder)
					.should.equal true
				done()
	
		it 'should return the folder in the callback', (done) ->
			@ProjectEntityHandler.addFolder = (project_id, folder_id, folderName, callback)=> callback(null, @folder, @folder_id)
			@EditorController.addFolderWithoutLock @project_id, @folder_id, @folderName, @source, (error, folder) =>
				folder.should.equal @folder
				done()


	describe "addFolder", ->

		beforeEach ->
			@LockManager.getLock.callsArgWith(1)
			@LockManager.releaseLock.callsArgWith(1)
			@EditorController.addFolderWithoutLock = sinon.stub().callsArgWith(4)

		it "should call addFolderWithoutLock", (done)->
			@EditorController.addFolder @project_id, @folder_id, @folderName, @source, (error, file) =>
				@EditorController.addFolderWithoutLock.calledWith(@project_id, @folder_id, @folderName, @source).should.equal true
				done()

		it "should take the lock", (done)->
			@EditorController.addFolder @project_id, @folder_id, @folderName, @source, (error, file) =>
				@LockManager.getLock.calledWith(@project_id).should.equal true
				done()

		it "should release the lock", (done)->
			@EditorController.addFolder @project_id, @folder_id, @folderName, @source, (error, file) =>
				@LockManager.releaseLock.calledWith(@project_id).should.equal true
				done()

		it "should error if it can't cat the lock", (done)->
			@LockManager.getLock = sinon.stub().callsArgWith(1, "timed out")
			@EditorController.addFolder @project_id, @folder_id, @folderName, @source, (err, file) =>
				expect(err).to.exist
				err.should.equal "timed out"
				done()			


	describe 'mkdirpWithoutLock :', ->

		it 'should make the dirs and notifyProjectUsersOfNewFolder', (done)->
			path = "folder1/folder2"
			@folder1 = {_id:"folder_1_id_here"}
			@folder2 = {_id:"folder_2_id_here", parentFolder_id:@folder1._id}
			@folder3 = {_id:"folder_3_id_here", parentFolder_id:@folder2._id}

			@ProjectEntityHandler.mkdirp = sinon.stub().withArgs(@project_id, path).callsArgWith(2, null, [@folder1, @folder2, @folder3], @folder3)

			@EditorController.p.notifyProjectUsersOfNewFolder = sinon.stub().callsArg(3)

			@EditorController.mkdirpWithoutLock @project_id, path, (err, newFolders, lastFolder)=>
				@EditorController.p.notifyProjectUsersOfNewFolder.calledWith(@project_id, @folder1._id, @folder2).should.equal true
				@EditorController.p.notifyProjectUsersOfNewFolder.calledWith(@project_id, @folder2._id, @folder3).should.equal true
				newFolders.should.deep.equal [@folder1, @folder2, @folder3]
				lastFolder.should.equal @folder3
				done()


	describe "mkdirp", ->

		beforeEach ->
			@path = "folder1/folder2"
			@LockManager.getLock.callsArgWith(1)
			@LockManager.releaseLock.callsArgWith(1)
			@EditorController.mkdirpWithoutLock = sinon.stub().callsArgWith(2)

		it "should call mkdirpWithoutLock", (done)->
			@EditorController.mkdirp @project_id, @path, (error, file) =>
				@EditorController.mkdirpWithoutLock.calledWith(@project_id, @path).should.equal true
				done()

		it "should take the lock", (done)->
			@EditorController.mkdirp @project_id, @path, (error, file) =>
				@LockManager.getLock.calledWith(@project_id).should.equal true
				done()

		it "should release the lock", (done)->
			@EditorController.mkdirp @project_id, @path, (error, file) =>
				@LockManager.releaseLock.calledWith(@project_id).should.equal true
				done()

		it "should error if it can't cat the lock", (done)->
			@LockManager.getLock = sinon.stub().callsArgWith(1, "timed out")
			@EditorController.mkdirp @project_id, @path, (err, file) =>
				expect(err).to.exist
				err.should.equal "timed out"
				done()			


	describe "deleteEntity", ->

		beforeEach ->
			@LockManager.getLock.callsArgWith(1)
			@LockManager.releaseLock.callsArgWith(1)
			@EditorController.deleteEntityWithoutLock = sinon.stub().callsArgWith(4)

		it "should call deleteEntityWithoutLock", (done)->
			@EditorController.deleteEntity @project_id, @entity_id, @type, @source,  =>
				@EditorController.deleteEntityWithoutLock.calledWith(@project_id, @entity_id, @type, @source).should.equal true
				done()

		it "should take the lock", (done)->
			@EditorController.deleteEntity @project_id, @entity_id, @type, @source,  =>
				@LockManager.getLock.calledWith(@project_id).should.equal true
				done()

		it "should release the lock", (done)->
			@EditorController.deleteEntity @project_id, @entity_id, @type, @source, (error)=>
				@LockManager.releaseLock.calledWith(@project_id).should.equal true
				done()

		it "should error if it can't cat the lock", (done)->
			@LockManager.getLock = sinon.stub().callsArgWith(1, "timed out")
			@EditorController.deleteEntity @project_id, @entity_id, @type, @source, (err)=>
				expect(err).to.exist
				err.should.equal "timed out"
				done()			



	describe 'deleteEntityWithoutLock', ->
		beforeEach ->
			@ProjectEntityHandler.deleteEntity = (project_id, entity_id, type, callback)-> callback()
			@entity_id = "entity_id_here"
			@type = "doc"
			@EditorRealTimeController.emitToRoom = sinon.stub()

		it 'should delete the folder using the project entity handler', (done)->
			mock = sinon.mock(@ProjectEntityHandler).expects("deleteEntity").withArgs(@project_id, @entity_id, @type).callsArg(3)

			@EditorController.deleteEntityWithoutLock @project_id, @entity_id, @type, @source, ->
				mock.verify()
				done()

		it 'notify users an entity has been deleted', (done)->
			@EditorController.deleteEntityWithoutLock @project_id, @entity_id, @type, @source, =>
				@EditorRealTimeController.emitToRoom
					.calledWith(@project_id, "removeEntity", @entity_id, @source)
					.should.equal true
				done()

	describe "getting a list of project paths", ->

		it 'should call the project entity handler to get an array of docs', (done)->
			fullDocsHash = 
				"/doc1.tex":{lines:["das"], _id:"1234"}
				"/doc2.tex":{lines:["dshajkh"]}
			project_id = "d312nkjnajn"
			@ProjectEntityHandler.getAllDocs = sinon.stub().callsArgWith(1, null, fullDocsHash)
			@EditorController.getListOfDocPaths project_id, (err, returnedDocs)->
				returnedDocs.length.should.equal 2
				returnedDocs[0]._id.should.equal "1234"
				assert.equal returnedDocs[0].lines, undefined
				returnedDocs[1].path.should.equal "doc2.tex"	
				done()

	describe "notifyUsersProjectHasBeenDeletedOrRenamed", ->
		it 'should emmit a message to all users in a project', (done)->
			@EditorRealTimeController.emitToRoom = sinon.stub()
			@EditorController.notifyUsersProjectHasBeenDeletedOrRenamed @project_id, (err)=>
				@EditorRealTimeController.emitToRoom
					.calledWith(@project_id, "projectRenamedOrDeletedByExternalSource")
					.should.equal true
				done()

	describe "updateProjectDescription", ->
		beforeEach ->
			@description = "new description"
			@EditorRealTimeController.emitToRoom = sinon.stub()


		it "should send the new description to the project details handler", (done)->
			@ProjectDetailsHandler.setProjectDescription.callsArgWith(2)
			@EditorController.updateProjectDescription @project_id, @description, =>
				@ProjectDetailsHandler.setProjectDescription.calledWith(@project_id, @description).should.equal true
				done()

		it "should notify the other clients about the updated description", (done)->
			@ProjectDetailsHandler.setProjectDescription.callsArgWith(2)
			@EditorController.updateProjectDescription @project_id, @description, =>
				@EditorRealTimeController.emitToRoom.calledWith(@project_id, "projectDescriptionUpdated", @description).should.equal true				
				done()


	describe "deleteProject", ->

		beforeEach ->
			@err = "errro"
			@ProjectDeleter.deleteProject = sinon.stub().callsArgWith(1, @err)

		it "should call the project handler", (done)->
			@EditorController.deleteProject @project_id, (err)=>
				err.should.equal @err
				@ProjectDeleter.deleteProject.calledWith(@project_id).should.equal true
				done()


	describe "renameEntity", ->

		beforeEach ->
			@err = "errro"
			@entity_id = "entity_id_here"
			@entityType = "doc"
			@newName = "bobsfile.tex"
			@ProjectEntityHandler.renameEntity = sinon.stub().callsArgWith(4, @err)
			@EditorRealTimeController.emitToRoom = sinon.stub()

		it "should call the project handler", (done)->
			@EditorController.renameEntity @project_id, @entity_id, @entityType, @newName, =>
				@ProjectEntityHandler.renameEntity.calledWith(@project_id, @entity_id, @entityType, @newName).should.equal true
				done()


		it "should emit the update to the room", (done)->
			@EditorController.renameEntity @project_id, @entity_id, @entityType, @newName, =>
				@EditorRealTimeController.emitToRoom.calledWith(@project_id, 'reciveEntityRename', @entity_id, @newName).should.equal true				
				done()

	describe "moveEntity", ->

		beforeEach ->
			@err = "errro"
			@entity_id = "entity_id_here"
			@entityType = "doc"
			@folder_id = "313dasd21dasdsa"
			@ProjectEntityHandler.moveEntity = sinon.stub().callsArgWith(4, @err)
			@EditorRealTimeController.emitToRoom = sinon.stub()

		it "should call the ProjectEntityHandler", (done)->
			@EditorController.moveEntity @project_id, @entity_id, @folder_id, @entityType, =>
				@ProjectEntityHandler.moveEntity.calledWith(@project_id, @entity_id, @folder_id, @entityType).should.equal true
				done()


		it "should emit the update to the room", (done)->
			@EditorController.moveEntity @project_id, @entity_id, @folder_id, @entityType, =>
				@EditorRealTimeController.emitToRoom.calledWith(@project_id, 'reciveEntityMove', @entity_id, @folder_id).should.equal true				
				done()

	describe "renameProject", ->

		beforeEach ->
			@err = "errro"
			@window_id = "kdsjklj290jlk"
			@newName = "new name here"
			@ProjectDetailsHandler.renameProject = sinon.stub().callsArgWith(2, @err)
			@EditorRealTimeController.emitToRoom = sinon.stub()

		it "should call the EditorController", (done)->
			@EditorController.renameProject @project_id, @newName, =>
				@ProjectDetailsHandler.renameProject.calledWith(@project_id, @newName).should.equal true
				done()


		it "should emit the update to the room", (done)->
			@EditorController.renameProject @project_id, @newName, =>
				@EditorRealTimeController.emitToRoom.calledWith(@project_id, 'projectNameUpdated', @newName).should.equal true				
				done()


	describe "setPublicAccessLevel", ->

		beforeEach ->
			@newAccessLevel = "public"
			@ProjectDetailsHandler.setPublicAccessLevel = sinon.stub().callsArgWith(2, null)
			@EditorRealTimeController.emitToRoom = sinon.stub()

		it "should call the EditorController", (done)->
			@EditorController.setPublicAccessLevel @project_id, @newAccessLevel, =>
				@ProjectDetailsHandler.setPublicAccessLevel.calledWith(@project_id, @newAccessLevel).should.equal true
				done()

		it "should emit the update to the room", (done)->
			@EditorController.setPublicAccessLevel @project_id, @newAccessLevel, =>
				@EditorRealTimeController.emitToRoom.calledWith(@project_id, 'publicAccessLevelUpdated', @newAccessLevel).should.equal true				
				done()

	describe "setRootDoc", ->

		beforeEach ->
			@newRootDocID = "21312321321"
			@ProjectEntityHandler.setRootDoc = sinon.stub().callsArgWith(2, null)
			@EditorRealTimeController.emitToRoom = sinon.stub()

		it "should call the ProjectEntityHandler", (done)->
			@EditorController.setRootDoc @project_id, @newRootDocID, =>
				@ProjectEntityHandler.setRootDoc.calledWith(@project_id, @newRootDocID).should.equal true
				done()

		it "should emit the update to the room", (done)->
			@EditorController.setRootDoc @project_id, @newRootDocID, =>
				@EditorRealTimeController.emitToRoom.calledWith(@project_id, 'rootDocUpdated', @newRootDocID).should.equal true				
				done()