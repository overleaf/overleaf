SandboxedModule = require('sandboxed-module')
sinon = require('sinon')
require('chai').should()
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

		@projectModelView = "projectModelView"

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
		@ProjectEntityHandler = {}
		@ProjectEditorHandler =
			buildProjectModelView : sinon.stub().returns(@projectModelView)
		@ProjectHandler = class ProjectHandler
		@Project =
			findPopulatedById: sinon.stub().callsArgWith(1, null, @project)
		@LimitationsManager = {}
		@AuthorizationManager = {}
		@AutomaticSnapshotManager = {}
		@VersioningApiHandler =
			enableVersioning : sinon.stub().callsArg(1)
		@client = new MockClient()

		@settings = 
			apis:{thirdPartyDataStore:{emptyProjectFlushDelayMiliseconds:0.5}}
			redis: web:{}
		@dropboxProjectLinker = {}
		@callback = sinon.stub()
		@TpdsPollingBackgroundTasks = {}
		@ProjectDetailsHandler = 
			setProjectDescription:sinon.stub()
		@EditorController = SandboxedModule.require modulePath, requires:
			"../../infrastructure/Server" : io : @io
			'../Project/ProjectEditorHandler' : @ProjectEditorHandler
			'../Project/ProjectEntityHandler' : @ProjectEntityHandler
			'../Project/ProjectOptionsHandler' : @ProjectOptionsHandler
			'../Project/ProjectDetailsHandler': @ProjectDetailsHandler
			'../Project/ProjectGetter' : @ProjectGetter = {}
			'../DocumentUpdater/DocumentUpdaterHandler' : @DocumentUpdaterHandler
			'../Subscription/LimitationsManager' : @LimitationsManager
			'../Security/AuthorizationManager' : @AuthorizationManager
			'../../handlers/ProjectHandler' : @ProjectHandler
			"../Versioning/AutomaticSnapshotManager" : @AutomaticSnapshotManager
			"../Versioning/VersioningApiHandler" : @VersioningApiHandler
			'../../models/Project' : Project: @Project
			"settings-sharelatex":@settings
			'../Dropbox/DropboxProjectLinker':@dropboxProjectLinker
			'../ThirdPartyDataStore/TpdsPollingBackgroundTasks':@TpdsPollingBackgroundTasks
			'./EditorRealTimeController':@EditorRealTimeController = {}
			"../../infrastructure/Metrics": @Metrics = { inc: sinon.stub() }
			"../TrackChanges/TrackChangesManager": @TrackChangesManager = {}
			'redis':createClient:-> auth:->
			"logger-sharelatex": @logger =
				log: sinon.stub()
				err: sinon.stub()

	describe "joinProject", ->
		beforeEach ->
			sinon.spy(@client, "set")
			sinon.spy(@client, "get")
			@ProjectGetter.getProjectWithoutDocLines = sinon.stub().callsArgWith(1, null, @project)
			@ProjectGetter.populateProjectWithUsers = sinon.stub().callsArgWith(1, null, @project)
			@AuthorizationManager.setPrivilegeLevelOnClient = sinon.stub()

		describe "when authorized", ->
			beforeEach ->
				@AuthorizationManager.getPrivilegeLevelForProject =
					sinon.stub().callsArgWith(2, null, true, "owner")
				@EditorController.joinProject(@client, @user, @project_id, @callback)

			it "should find the project without doc lines", ->
				@ProjectGetter.getProjectWithoutDocLines
					.calledWith(@project_id)
					.should.equal true

			it "should populate the user references in the project", ->
				@ProjectGetter.populateProjectWithUsers
					.calledWith(@project)
					.should.equal true

			it "should set the privilege level on the client", ->
				@AuthorizationManager.setPrivilegeLevelOnClient
					.calledWith(@client, "owner")
					.should.equal.true

			it "should add the client to the project channel", ->
				@client.join.calledWith(@project_id).should.equal true

			it "should set the project_id of the client", ->
				@client.set.calledWith("project_id", @project_id).should.equal true

			it "should return the project model view, privilege level and protocol version", ->
				@callback.calledWith(null, @projectModelView, "owner", @EditorController.protocolVersion).should.equal true

			it "should enable versioning", ->
				@VersioningApiHandler.enableVersioning.calledWith(@project)
					.should.equal true

		describe "when not authorized", ->
			beforeEach ->
				@AuthorizationManager.getPrivilegeLevelForProject =
					sinon.stub().callsArgWith(2, null, false)
				@EditorController.joinProject(@client, @user, @project_id, @callback)

			it "should not set the privilege level on the client", ->
				@AuthorizationManager.setPrivilegeLevelOnClient
					.called.should.equal false

			it "should not add the client to the project channel", ->
				@client.join.called.should.equal false

			it "should not set the project_id of the client", ->
				@client.set.called.should.equal false

			it "should return an error", ->
				@callback.calledWith(sinon.match.truthy).should.equal true


	describe "leaveProject", ->
		beforeEach ->
			sinon.stub(@client, "set")
			sinon.stub(@client, "get").callsArgWith(1, null, @project_id)
			@EditorRealTimeController.emitToRoom = sinon.stub()
			@EditorController.flushProjectIfEmpty = sinon.stub()
			@EditorController.leaveProject @client, @user

		it "should call the flush project if empty function", ->
			@EditorController.flushProjectIfEmpty
				.calledWith(@project_id)
				.should.equal true

		it "should emit a clientDisconnect to the project room", ->
			@EditorRealTimeController.emitToRoom
				.calledWith(@project_id, "clientTracking.clientDisconnected", @client.id)
				.should.equal true

	describe "joinDoc", ->
		beforeEach ->
			@client.join = sinon.stub()
			@client.set("user_id", @user_id)
			@fromVersion = 40
			@docLines = ["foo", "bar"]
			@ops = ["mock-op-1", "mock-op-2"]
			@version = 42
			@DocumentUpdaterHandler.getDocument = sinon.stub().callsArgWith(3, null, @docLines, @version, @ops)

		describe "with a fromVersion", ->
			beforeEach ->
				@EditorController.joinDoc @client, @project_id, @doc_id, @fromVersion, @callback

			it "should add the client to the socket.io room for the doc", ->
				@client.join.calledWith(@doc_id).should.equal true

			it "should get the document", ->
				@DocumentUpdaterHandler.getDocument
					.calledWith(@project_id, @doc_id, @fromVersion)
					.should.equal true

			it "should return the doclines and version and ops", ->
				@callback.calledWith(null, @docLines, @version, @ops).should.equal true

			it "should increment the join-doc metric", ->
				@Metrics.inc.calledWith("editor.join-doc").should.equal true

			it "should log out the request", ->
				@logger.log
					.calledWith(user_id: @user_id, project_id: @project_id, doc_id: @doc_id, "user joining doc")
					.should.equal true

		describe "without a fromVersion", ->
			beforeEach ->
				@EditorController.joinDoc @client, @project_id, @doc_id, @callback

			it "should get the document with fromVersion=-1", ->
				@DocumentUpdaterHandler.getDocument
					.calledWith(@project_id, @doc_id, -1)
					.should.equal true

			it "should return the doclines and version and ops", ->
				@callback.calledWith(null, @docLines, @version, @ops).should.equal true

	describe "leaveDoc", ->
		beforeEach ->
			@client.leave = sinon.stub()
			@client.set("user_id", @user_id)
			@EditorController.leaveDoc @client, @project_id, @doc_id, @callback

		it "should remove the client from the socket.io room for the doc", ->
			@client.leave.calledWith(@doc_id).should.equal true

		it "should increment the leave-doc metric", ->
			@Metrics.inc.calledWith("editor.leave-doc").should.equal true

		it "should log out the request", ->
			@logger.log
				.calledWith(user_id: @user_id, project_id: @project_id, doc_id: @doc_id, "user leaving doc")

				.should.equal true

	describe "flushProjectIfEmpty", ->
		beforeEach ->	
			@DocumentUpdaterHandler.flushProjectToMongoAndDelete = sinon.stub()
			@TrackChangesManager.flushProject = sinon.stub()

		describe "when a project has no more users", ->
			it "should do the flush after the config set timeout to ensure that a reconect didn't just happen", (done)->
				@rooms[@project_id] = []
				@EditorController.flushProjectIfEmpty @project_id, =>
					@DocumentUpdaterHandler.flushProjectToMongoAndDelete.calledWith(@project_id).should.equal(true)
					@TrackChangesManager.flushProject.calledWith(@project_id).should.equal true
					done()

		describe "when a project still has connected users", ->
			it "should not flush the project", (done)->
				@rooms[@project_id] = ["socket-id-1", "socket-id-2"]
				@EditorController.flushProjectIfEmpty @project_id, =>
					@DocumentUpdaterHandler.flushProjectToMongoAndDelete.calledWith(@project_id).should.equal(false)
					@TrackChangesManager.flushProject.calledWith(@project_id).should.equal false
					done()

	describe "updateClientPosition", ->
		beforeEach ->
			@EditorRealTimeController.emitToRoom = sinon.stub()
			@update = {
				doc_id: @doc_id = "doc-id-123"
				row: @row = 42
				column: @column = 37
			}
			@clientParams = {
				project_id: @project_id
				first_name: @first_name = "Douglas"
				last_name: @last_name = "Adams"
			}
			@client.get = (param, callback) => callback null, @clientParams[param]

		describe "with a logged in user", ->
			beforeEach ->
				@EditorController.updateClientPosition @client, @update

			it "should send the update to the project room with the user's name", ->
				@EditorRealTimeController.emitToRoom
					.calledWith(@project_id, "clientTracking.clientUpdated", {
						doc_id: @doc_id,
						id: @client.id
						name: "#{@first_name} #{@last_name}"
						row: @row
						column: @column
					})
					.should.equal true

		describe "with an anonymous user", ->
			beforeEach ->
				@clientParams.first_name = null
				@clientParams.last_name = null
				@EditorController.updateClientPosition @client, @update

			it "should send the update to the project room with an anonymous name", ->
				@EditorRealTimeController.emitToRoom
					.calledWith(@project_id, "clientTracking.clientUpdated", {
						doc_id: @doc_id,
						id: @client.id
						name: "Anonymous"
						row: @row
						column: @column
					})
					.should.equal true
				

	describe "addUserToProject", ->
		beforeEach ->
			@email = "Jane.Doe@example.com"
			@priveleges = "readOnly"
			@addedUser = { _id: "added-user" }
			@ProjectHandler::addUserToProject = sinon.stub().callsArgWith(3, @addedUser)
			@EditorRealTimeController.emitToRoom = sinon.stub()
			@callback = sinon.stub()

		describe "when the project can accept more collaborators", ->
			beforeEach ->
				@LimitationsManager.isCollaboratorLimitReached = sinon.stub().callsArgWith(1, null, false)
				@EditorController.addUserToProject(@project_id, @email, @priveleges, @callback)

			it "should add the user to the project", ->
				@ProjectHandler::addUserToProject
					.calledWith(@project_id, @email.toLowerCase(), @priveleges)
					.should.equal true

			it "should emit a userAddedToProject event", ->
				@EditorRealTimeController.emitToRoom.calledWith(@project_id, "userAddedToProject", @addedUser).should.equal true

			it "should return true to the callback", ->
				@callback.calledWith(null, true).should.equal true

		describe "when the project cannot accept more collaborators", ->
			beforeEach ->
				@LimitationsManager.isCollaboratorLimitReached = sinon.stub().callsArgWith(1, null, true)
				@EditorController.addUserToProject(@project_id, @email, @priveleges, @callback)

			it "should not add the user to the project", ->
				@ProjectHandler::addUserToProject.called.should.equal false

			it "should not emit a userAddedToProject event", ->
				@EditorRealTimeController.emitToRoom.called.should.equal false

			it "should return false to the callback", ->
				@callback.calledWith(null, false).should.equal true


	describe "removeUserFromProject", ->
		beforeEach ->
			@removed_user_id = "removed-user-id"
			@ProjectHandler::removeUserFromProject = sinon.stub().callsArgWith(2)
			@EditorRealTimeController.emitToRoom = sinon.stub()

			@EditorController.removeUserFromProject(@project_id, @removed_user_id)

		it "remove the user from the project", ->
			@ProjectHandler::removeUserFromProject
				.calledWith(@project_id, @removed_user_id)
				.should.equal true

		it "should emit a userRemovedFromProject event", ->
			@EditorRealTimeController.emitToRoom.calledWith(@project_id, "userRemovedFromProject", @removed_user_id).should.equal true

	describe "updating compiler used for project", ->
		it "should send the new compiler and project id to the project options handler", (done)->
			compiler = "latex"
			@EditorController.setCompiler @project_id, compiler, (err)=>
				@ProjectOptionsHandler.setCompiler.calledWith(@project_id, compiler).should.equal true
				done()
			@ProjectOptionsHandler.setCompiler.args[0][2]()


	describe "updating language code used for project", ->
		it "should send the new languageCode and project id to the project options handler", (done)->
			languageCode = "fr"
			@EditorController.setSpellCheckLanguage @project_id, languageCode, (err)=>
				@ProjectOptionsHandler.setSpellCheckLanguage.calledWith(@project_id, languageCode).should.equal true
				done()
			@ProjectOptionsHandler.setSpellCheckLanguage.args[0][2]()


	describe 'set document', ->
		beforeEach ->
			@docLines = ["foo", "bar"]
			@ProjectEntityHandler.updateDocLines = sinon.stub().callsArg(4)
			@DocumentUpdaterHandler.setDocument = sinon.stub().callsArg(3)
			@EditorRealTimeController.emitToRoom = sinon.stub()

		it 'should send the document to the documentUpdaterHandler', (done)->
			@DocumentUpdaterHandler.setDocument = sinon.stub().withArgs(@project_id, @doc_id, @docLines).callsArg(3)
			@EditorController.setDoc @project_id, @doc_id, @docLines, (err)->
				done()

		it 'should send the update to the connected users', (done)->
			@EditorController.setDoc @project_id, @doc_id, @docLines, (err)=>
				@EditorRealTimeController.emitToRoom.calledWith(@project_id, "entireDocUpdate", @doc_id).should.equal true
				done()

		it 'should send the new doc lines to the doucment updater', (done)->
			@DocumentUpdaterHandler.setDocument = ->
			mock = sinon.mock(@DocumentUpdaterHandler).expects("setDocument").withArgs(@project_id, @doc_id, @docLines).once().callsArg(3)

			@EditorController.setDoc @project_id, @doc_id, @docLines, (err)=>
				mock.verify()
				done()

		it 'should update the document lines', (done)->
			@ProjectEntityHandler.updateDocLines = ->
			mock = sinon.mock(@ProjectEntityHandler).expects("updateDocLines").withArgs(@project_id, @doc_id, @docLines).once().callsArg(4)

			@EditorController.setDoc @project_id, @doc_id, @docLines, (err)->
				mock.verify()
				done()


	describe 'add doc', ->
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
			mock = sinon.mock(@ProjectEntityHandler).expects("addDoc").withArgs(@project_id, @folder_id, @docName, @docLines).callsArg(5)

			@EditorController.addDoc @project_id, @folder_id, @docName, @docLines, "", ->
				mock.verify()
				done()

		it 'should send the update out to the users in the project', (done)->
			@ProjectEntityHandler.addDoc = sinon.stub().callsArgWith(5, null, @doc, @folder_id)

			@EditorController.addDoc @project_id, @folder_id, @docName, @docLines, "", =>
				@EditorRealTimeController.emitToRoom
					.calledWith(@project_id, "reciveNewDoc", @folder_id, @doc)
					.should.equal true
				done()

		it 'should return the doc to the callback', (done) ->
			@ProjectEntityHandler.addDoc = sinon.stub().callsArgWith(5, null, @doc, @folder_id)
			@EditorController.addDoc @project_id, @folder_id, @docName, @docLines, "", (error, doc) =>
				doc.should.equal @doc
				done()

	describe 'addFile :', ->
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
			mock = sinon.mock(@ProjectEntityHandler).expects("addFile").withArgs(@project_id).callsArg(4)
			@EditorController.addFile @project_id, @folder_id, @fileName, @stream, =>
				mock.verify()
				done()

		it 'should send the update of a new folder out to the users in the project', (done)->
			@ProjectEntityHandler.addFile = sinon.stub().callsArgWith(4, null, @file, @folder_id)

			@EditorController.addFile @project_id, @folder_id, @fileName, @stream, =>
				@EditorRealTimeController.emitToRoom
					.calledWith(@project_id, "reciveNewFile", @folder_id, @file)
					.should.equal true
				done()

		it "should return the file in the callback", (done) ->
			@ProjectEntityHandler.addFile = sinon.stub().callsArgWith(4, null, @file, @folder_id)
			@EditorController.addFile @project_id, @folder_id, @fileName, @stream, (error, file) =>
				file.should.equal @file
				done()


	describe "replaceFile", ->
		beforeEach ->
			@project_id = "12dsankj"
			@file_id = "file_id_here"
			@fsPath = "/folder/file.png"

		it 'should send the replace file message to the editor controller', (done)->
			@ProjectEntityHandler.replaceFile = sinon.stub().callsArgWith(3)
			@EditorController.replaceFile @project_id, @file_id, @fsPath, =>
				@ProjectEntityHandler.replaceFile.calledWith(@project_id, @file_id, @fsPath).should.equal true
				done()

	describe 'addFolder :', ->
		beforeEach ->
			@ProjectEntityHandler.addFolder = ->
			@EditorRealTimeController.emitToRoom = sinon.stub()
			@project_id = "12dsankj"
			@folder_id = "213kjd"
			@folderName = "folder"
			@folder = {_id:"123ds"}

		it 'should add the folder using the project entity handler', (done)->
			mock = sinon.mock(@ProjectEntityHandler).expects("addFolder").withArgs(@project_id, @folder_id, @folderName).callsArg(3)

			@EditorController.addFolder @project_id, @folder_id, @folderName, ->
				mock.verify()
				done()

		it 'should notifyProjectUsersOfNewFolder', (done)->
			@ProjectEntityHandler.addFolder = (project_id, folder_id, folderName, callback)=> callback(null, @folder, @folder_id)
			mock = sinon.mock(@EditorController.p).expects('notifyProjectUsersOfNewFolder').withArgs(@project_id, @folder_id, @folder).callsArg(3)

			@EditorController.addFolder @project_id, @folder_id, @folderName, ->
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
			@EditorController.addFolder @project_id, @folder_id, @folderName, (error, folder) =>
				folder.should.equal @folder
				done()

	describe 'mkdirp :', ->

		it 'should make the dirs and notifyProjectUsersOfNewFolder', (done)->
			path = "folder1/folder2"
			@folder1 = {_id:"folder_1_id_here"}
			@folder2 = {_id:"folder_2_id_here", parentFolder_id:@folder1._id}
			@folder3 = {_id:"folder_3_id_here", parentFolder_id:@folder2._id}

			@ProjectEntityHandler.mkdirp = sinon.stub().withArgs(@project_id, path).callsArgWith(2, null, [@folder1, @folder2, @folder3], @folder3)

			@EditorController.p.notifyProjectUsersOfNewFolder = sinon.stub().callsArg(3)

			@EditorController.mkdirp @project_id, path, (err, newFolders, lastFolder)=>
				@EditorController.p.notifyProjectUsersOfNewFolder.calledWith(@project_id, @folder1._id, @folder2).should.equal true
				@EditorController.p.notifyProjectUsersOfNewFolder.calledWith(@project_id, @folder2._id, @folder3).should.equal true
				newFolders.should.deep.equal [@folder1, @folder2, @folder3]
				lastFolder.should.equal @folder3
				done()

	describe 'deleteEntity', ->
		beforeEach ->
			@ProjectEntityHandler.deleteEntity = (project_id, entity_id, type, callback)-> callback()
			@entity_id = "entity_id_here"
			@type = "doc"
			@EditorRealTimeController.emitToRoom = sinon.stub()

		it 'should delete the folder using the project entity handler', (done)->
			mock = sinon.mock(@ProjectEntityHandler).expects("deleteEntity").withArgs(@project_id, @entity_id, @type).callsArg(3)

			@EditorController.deleteEntity @project_id, @entity_id, @type, ->
				mock.verify()
				done()

		it 'notify users an entity has been deleted', (done)->
			@EditorController.deleteEntity @project_id, @entity_id, @type, =>
				@EditorRealTimeController.emitToRoom
					.calledWith(@project_id, "removeEntity", @entity_id)
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

	describe "forceResyncOfDropbox", ->
		it 'should tell the project entity handler to flush to tpds', (done)->
			@ProjectEntityHandler.flushProjectToThirdPartyDataStore = sinon.stub().callsArgWith(1)
			@EditorController.forceResyncOfDropbox @project_id, (err)=>
				@ProjectEntityHandler.flushProjectToThirdPartyDataStore.calledWith(@project_id).should.equal true
				done()

	describe "notifyUsersProjectHasBeenDeletedOrRenamed", ->
		it 'should emmit a message to all users in a project', (done)->
			@EditorRealTimeController.emitToRoom = sinon.stub()
			@EditorController.notifyUsersProjectHasBeenDeletedOrRenamed @project_id, (err)=>
				@EditorRealTimeController.emitToRoom
					.calledWith(@project_id, "projectRenamedOrDeletedByExternalSource")
					.should.equal true
				done()

	describe "gettingTimeOfLastTpdsPoll", ->
		it "should ask the tpdsPollingBackgroundTask", (done)->
			date = new Date()
			@TpdsPollingBackgroundTasks.getLastTimePollHappned = sinon.stub().callsArgWith(0, null, date)
			@EditorController.getLastTimePollHappned (err, lastTimePollHappened)->
				lastTimePollHappened.should.equal date
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
			@ProjectHandler::deleteProject = sinon.stub().callsArgWith(1, @err)

		it "should call the project handler", (done)->
			@EditorController.deleteProject @project_id, (err)=>
				err.should.equal @err
				@ProjectHandler::deleteProject.calledWith(@project_id).should.equal true
				done()


	describe "renameEntity", ->

		beforeEach ->
			@err = "errro"
			@entity_id = "entity_id_here"
			@entityType = "doc"
			@newName = "bobsfile.tex"
			@ProjectHandler::renameEntity = sinon.stub().callsArgWith(4, @err)
			@EditorRealTimeController.emitToRoom = sinon.stub()

		it "should call the project handler", (done)->
			@EditorController.renameEntity @project_id, @entity_id, @entityType, @newName, =>
				@ProjectHandler::renameEntity.calledWith(@project_id, @entity_id, @entityType, @newName).should.equal true
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
			@ProjectHandler::renameProject = sinon.stub().callsArgWith(3, @err)
			@EditorRealTimeController.emitToRoom = sinon.stub()

		it "should call the ProjectHandler", (done)->
			@EditorController.renameProject @project_id, @window_id, @newName, =>
				@ProjectHandler::renameProject.calledWith(@project_id, @window_id, @newName).should.equal true
				done()


		it "should emit the update to the room", (done)->
			@EditorController.renameProject @project_id, @window_id, @newName, =>
				@EditorRealTimeController.emitToRoom.calledWith(@project_id, 'projectNameUpdated', @window_id, @newName).should.equal true				
				done()


	describe "setPublicAccessLevel", ->

		beforeEach ->
			@err = "errro"
			@newAccessLevel = "public"
			@ProjectHandler::setPublicAccessLevel = sinon.stub().callsArgWith(2, @err)
			@EditorRealTimeController.emitToRoom = sinon.stub()

		it "should call the ProjectHandler", (done)->
			@EditorController.setPublicAccessLevel @project_id, @newAccessLevel, =>
				@ProjectHandler::setPublicAccessLevel.calledWith(@project_id, @newAccessLevel).should.equal true
				done()

		it "should emit the update to the room", (done)->
			@EditorController.setPublicAccessLevel @project_id, @newAccessLevel, =>
				@EditorRealTimeController.emitToRoom.calledWith(@project_id, 'publicAccessLevelUpdated', @newAccessLevel).should.equal true				
				done()

