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
		@source = "dropbox"

		@doc = _id: @doc_id = "test-doc-id"
		@docName = "doc.tex"
		@docLines = ["1234","dskl"]
		@file = _id: @file_id ="dasdkjk"
		@fileName = "file.png"
		@fsPath = "/folder/file.png"
		@linkedFileData = {provider: 'url'}

		@newFile = _id: "new-file-id"

		@folder_id = "123ksajdn"
		@folder = _id: @folder_id
		@folderName = "folder"

		@callback = sinon.stub()

		@EditorController = SandboxedModule.require modulePath, requires:
			'../Project/ProjectEntityUpdateHandler' : @ProjectEntityUpdateHandler = {}
			'../Project/ProjectOptionsHandler' : @ProjectOptionsHandler =
				setCompiler: sinon.stub().yields()
				setImageName: sinon.stub().yields()
				setSpellCheckLanguage: sinon.stub().yields()
			'../Project/ProjectDetailsHandler': @ProjectDetailsHandler =
				setProjectDescription: sinon.stub().yields()
				renameProject: sinon.stub().yields()
				setPublicAccessLevel: sinon.stub().yields()
			'../Project/ProjectDeleter' : @ProjectDeleter = {}
			'../DocumentUpdater/DocumentUpdaterHandler' : @DocumentUpdaterHandler =
				flushDocToMongo: sinon.stub().yields()
				setDocument: sinon.stub().yields()
			'./EditorRealTimeController':@EditorRealTimeController =
				emitToRoom: sinon.stub()
			"metrics-sharelatex": @Metrics = inc: sinon.stub()
			"logger-sharelatex": @logger =
				log: sinon.stub()
				err: sinon.stub()

	describe 'addDoc', ->
		beforeEach ->
			@ProjectEntityUpdateHandler.addDocWithRanges = sinon.stub().yields(null, @doc, @folder_id)
			@EditorController.addDoc @project_id, @folder_id, @docName, @docLines, @source, @user_id, @callback

		it 'should add the doc using the project entity handler', ->
			@ProjectEntityUpdateHandler.addDocWithRanges
				.calledWith(@project_id, @folder_id, @docName, @docLines, {})
				.should.equal true

		it 'should send the update out to the users in the project', ->
			@EditorRealTimeController.emitToRoom
				.calledWith(@project_id, "reciveNewDoc", @folder_id, @doc, @source)
				.should.equal true

		it 'calls the callback', ->
			@callback.calledWith(null, @doc).should.equal true

	describe 'addFile', ->
		beforeEach ->
			@ProjectEntityUpdateHandler.addFile = sinon.stub().yields(null, @file, @folder_id)
			@EditorController.addFile @project_id, @folder_id, @fileName, @fsPath, @linkedFileData, @source, @user_id, @callback

		it 'should add the folder using the project entity handler', ->
			@ProjectEntityUpdateHandler.addFile
				.calledWith(@project_id, @folder_id, @fileName, @fsPath, @linkedFileData, @user_id)
				.should.equal true

		it 'should send the update of a new folder out to the users in the project', ->
			@EditorRealTimeController.emitToRoom
				.calledWith(@project_id, "reciveNewFile", @folder_id, @file, @source, @linkedFileData)
				.should.equal true

		it 'calls the callback', ->
			@callback.calledWith(null, @file).should.equal true

	describe 'upsertDoc', ->
		beforeEach ->
			@ProjectEntityUpdateHandler.upsertDoc = sinon.stub().yields(null, @doc, false)
			@EditorController.upsertDoc @project_id, @folder_id, @docName, @docLines, @source, @user_id, @callback

		it 'upserts the doc using the project entity handler', ->
			@ProjectEntityUpdateHandler.upsertDoc
				.calledWith(@project_id, @folder_id, @docName, @docLines, @source)
				.should.equal true

		it 'returns the doc', ->
			@callback.calledWith(null, @doc).should.equal true

		describe 'doc does not exist', ->
			beforeEach ->
				@ProjectEntityUpdateHandler.upsertDoc = sinon.stub().yields(null, @doc, true)
				@EditorController.upsertDoc @project_id, @folder_id, @docName, @docLines, @source, @user_id, @callback

			it 'sends an update out to users in the project', ->
				@EditorRealTimeController.emitToRoom
					.calledWith(@project_id, "reciveNewDoc", @folder_id, @doc, @source)
					.should.equal true

	describe 'upsertFile', ->
		beforeEach ->
			@ProjectEntityUpdateHandler.upsertFile = sinon.stub().yields(null, @newFile, false, @file)
			@EditorController.upsertFile @project_id, @folder_id, @fileName, @fsPath, @linkedFileData, @source, @user_id, @callback

		it 'upserts the file using the project entity handler', ->
			@ProjectEntityUpdateHandler.upsertFile
				.calledWith(@project_id, @folder_id, @fileName, @fsPath, @linkedFileData, @user_id)
				.should.equal true

		it 'returns the file', ->
			@callback.calledWith(null, @newFile).should.equal true

		describe 'file does not exist', ->
			beforeEach ->
				@ProjectEntityUpdateHandler.upsertFile = sinon.stub().yields(null, @file, true)
				@EditorController.upsertFile @project_id, @folder_id, @fileName, @fsPath, @linkedFileData, @source, @user_id, @callback

			it 'should send the update out to users in the project', ->
				@EditorRealTimeController.emitToRoom
					.calledWith(@project_id, "reciveNewFile", @folder_id, @file, @source, @linkedFileData)
					.should.equal true

	describe "upsertDocWithPath", ->
		beforeEach ->
			@docPath = '/folder/doc'

			@ProjectEntityUpdateHandler.upsertDocWithPath = sinon.stub().yields(null, @doc, false, [], @folder)
			@EditorController.upsertDocWithPath @project_id, @docPath, @docLines, @source, @user_id, @callback

		it 'upserts the doc using the project entity handler', ->
			@ProjectEntityUpdateHandler.upsertDocWithPath
				.calledWith(@project_id, @docPath, @docLines, @source)
				.should.equal true

		describe 'doc does not exist', ->
			beforeEach ->
				@ProjectEntityUpdateHandler.upsertDocWithPath = sinon.stub().yields(null, @doc, true, [], @folder)
				@EditorController.upsertDocWithPath @project_id, @docPath, @docLines, @source, @user_id, @callback

			it 'should send the update for the doc out to users in the project', ->
				@EditorRealTimeController.emitToRoom
					.calledWith(@project_id, "reciveNewDoc", @folder_id, @doc, @source)
					.should.equal true

		describe 'folders required for doc do not exist', ->
			beforeEach ->
				folders = [
					@folderA = { _id: 2, parentFolder_id: 1}
					@folderB = { _id: 3, parentFolder_id: 2}
				]
				@ProjectEntityUpdateHandler.upsertDocWithPath = sinon.stub().yields(null, @doc, true, folders, @folderB)
				@EditorController.upsertDocWithPath @project_id, @docPath, @docLines, @source, @user_id, @callback

			it 'should send the update for each folder to users in the project', ->
				@EditorRealTimeController.emitToRoom
					.calledWith(@project_id, "reciveNewFolder", @folderA.parentFolder_id, @folderA)
					.should.equal true
				@EditorRealTimeController.emitToRoom
					.calledWith(@project_id, "reciveNewFolder", @folderB.parentFolder_id, @folderB)
					.should.equal true

	describe "upsertFileWithPath", ->
		beforeEach ->
			@filePath = '/folder/file'

			@ProjectEntityUpdateHandler.upsertFileWithPath = sinon.stub().yields(null, @newFile, false, @file, [], @folder)
			@EditorController.upsertFileWithPath @project_id, @filePath, @fsPath, @linkedFileData, @source, @user_id, @callback

		it 'upserts the file using the project entity handler', ->
			@ProjectEntityUpdateHandler.upsertFileWithPath
				.calledWith(@project_id, @filePath, @fsPath, @linkedFileData)
				.should.equal true

		describe 'file does not exist', ->
			beforeEach ->
				@ProjectEntityUpdateHandler.upsertFileWithPath = sinon.stub().yields(null, @file, true, undefined, [], @folder)
				@EditorController.upsertFileWithPath @project_id, @filePath, @fsPath, @linkedFileData, @source, @user_id, @callback

			it 'should send the update for the file out to users in the project', ->
				@EditorRealTimeController.emitToRoom
					.calledWith(@project_id, "reciveNewFile", @folder_id, @file, @source, @linkedFileData)
					.should.equal true

		describe 'folders required for file do not exist', ->
			beforeEach ->
				folders = [
					@folderA = { _id: 2, parentFolder_id: 1}
					@folderB = { _id: 3, parentFolder_id: 2}
				]
				@ProjectEntityUpdateHandler.upsertFileWithPath = sinon.stub().yields(null, @file, true, undefined, folders, @folderB)
				@EditorController.upsertFileWithPath @project_id, @filePath, @fsPath, @linkedFileData, @source, @user_id, @callback

			it 'should send the update for each folder to users in the project', ->
				@EditorRealTimeController.emitToRoom
					.calledWith(@project_id, "reciveNewFolder", @folderA.parentFolder_id, @folderA)
					.should.equal true
				@EditorRealTimeController.emitToRoom
					.calledWith(@project_id, "reciveNewFolder", @folderB.parentFolder_id, @folderB)
					.should.equal true

	describe 'addFolder', ->
		beforeEach ->
			@EditorController._notifyProjectUsersOfNewFolder = sinon.stub().yields()
			@ProjectEntityUpdateHandler.addFolder = sinon.stub().yields(null, @folder, @folder_id)
			@EditorController.addFolder @project_id, @folder_id, @folderName, @source, @callback

		it 'should add the folder using the project entity handler', ->
			@ProjectEntityUpdateHandler.addFolder
				.calledWith(@project_id, @folder_id, @folderName)
				.should.equal true

		it 'should notifyProjectUsersOfNewFolder', ->
			@EditorController._notifyProjectUsersOfNewFolder
				.calledWith(@project_id, @folder_id, @folder)

		it 'should return the folder in the callback', ->
			@callback.calledWith(null, @folder).should.equal true

	describe 'mkdirp', ->
		beforeEach ->
			@path = "folder1/folder2"
			@folders = [
				@folderA = { _id: 2, parentFolder_id: 1}
				@folderB = { _id: 3, parentFolder_id: 2}
			]
			@EditorController._notifyProjectUsersOfNewFolders = sinon.stub().yields()
			@ProjectEntityUpdateHandler.mkdirp = sinon.stub().yields(null, @folders, @folder)
			@EditorController.mkdirp @project_id, @path, @callback

		it 'should create the folder using the project entity handler', ->
			@ProjectEntityUpdateHandler.mkdirp
				.calledWith(@project_id, @path)
				.should.equal true

		it 'should notifyProjectUsersOfNewFolder', ->
			@EditorController._notifyProjectUsersOfNewFolders
				.calledWith(@project_id, @folders)

		it 'should return the folder in the callback', ->
			@callback.calledWith(null, @folders, @folder).should.equal true

	describe 'deleteEntity', ->
		beforeEach ->
			@entity_id = "entity_id_here"
			@type = "doc"
			@ProjectEntityUpdateHandler.deleteEntity = sinon.stub().yields()
			@EditorController.deleteEntity @project_id, @entity_id, @type, @source, @user_id, @callback

		it 'should delete the folder using the project entity handler', ->
			@ProjectEntityUpdateHandler.deleteEntity
				.calledWith(@project_id, @entity_id, @type, @user_id)
				.should.equal.true

		it 'notify users an entity has been deleted', ->
			@EditorRealTimeController.emitToRoom
				.calledWith(@project_id, "removeEntity", @entity_id, @source)
				.should.equal true

	describe "deleteEntityWithPath", ->
		beforeEach () ->
			@entity_id = "entity_id_here"
			@ProjectEntityUpdateHandler.deleteEntityWithPath = sinon.stub().yields(null, @entity_id)
			@path = "folder1/folder2"
			@EditorController.deleteEntityWithPath @project_id, @path, @source, @user_id, @callback

		it 'should delete the folder using the project entity handler', ->
			@ProjectEntityUpdateHandler.deleteEntityWithPath
				.calledWith(@project_id, @path, @user_id)
				.should.equal.true

		it 'notify users an entity has been deleted', ->
			@EditorRealTimeController.emitToRoom
				.calledWith(@project_id, "removeEntity", @entity_id, @source)
				.should.equal true

	describe "notifyUsersProjectHasBeenDeletedOrRenamed", ->
		it 'should emmit a message to all users in a project', (done)->
			@EditorController.notifyUsersProjectHasBeenDeletedOrRenamed @project_id, (err)=>
				@EditorRealTimeController.emitToRoom
					.calledWith(@project_id, "projectRenamedOrDeletedByExternalSource")
					.should.equal true
				done()

	describe "updateProjectDescription", ->
		beforeEach ->
			@description = "new description"
			@EditorController.updateProjectDescription @project_id, @description, @callback

		it "should send the new description to the project details handler", ->
			@ProjectDetailsHandler.setProjectDescription.calledWith(@project_id, @description).should.equal true

		it "should notify the other clients about the updated description", ->
			@EditorRealTimeController.emitToRoom.calledWith(@project_id, "projectDescriptionUpdated", @description).should.equal true				

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
		beforeEach (done) ->
			@entity_id = "entity_id_here"
			@entityType = "doc"
			@newName = "bobsfile.tex"
			@ProjectEntityUpdateHandler.renameEntity = sinon.stub().yields()

			@EditorController.renameEntity @project_id, @entity_id, @entityType, @newName, @user_id, done

		it "should call the project handler", ->
			@ProjectEntityUpdateHandler.renameEntity
				.calledWith(@project_id, @entity_id, @entityType, @newName, @user_id)
				.should.equal true

		it "should emit the update to the room", ->
			@EditorRealTimeController.emitToRoom
				.calledWith(@project_id, 'reciveEntityRename', @entity_id, @newName)
				.should.equal true

	describe "moveEntity", ->
		beforeEach ->
			@entity_id = "entity_id_here"
			@entityType = "doc"
			@ProjectEntityUpdateHandler.moveEntity = sinon.stub().yields()
			@EditorController.moveEntity @project_id, @entity_id, @folder_id, @entityType, @user_id, @callback

		it "should call the ProjectEntityUpdateHandler", ->
			@ProjectEntityUpdateHandler.moveEntity
				.calledWith(@project_id, @entity_id, @folder_id, @entityType, @user_id)
				.should.equal true

		it "should emit the update to the room", ->
			@EditorRealTimeController.emitToRoom
				.calledWith(@project_id, 'reciveEntityMove', @entity_id, @folder_id)
				.should.equal true

		it "calls the callback", ->
			@callback.called.should.equal true

	describe "renameProject", ->
		beforeEach ->
			@err = "errro"
			@newName = "new name here"
			@EditorController.renameProject @project_id, @newName, @callback

		it "should call the EditorController", ->
			@ProjectDetailsHandler.renameProject.calledWith(@project_id, @newName).should.equal true

		it "should emit the update to the room", ->
			@EditorRealTimeController.emitToRoom.calledWith(@project_id, 'projectNameUpdated', @newName).should.equal true				

	describe "setCompiler", ->
		beforeEach ->
			@compiler = "latex"
			@EditorController.setCompiler @project_id, @compiler, @callback

		it "should send the new compiler and project id to the project options handler", ->
			@ProjectOptionsHandler.setCompiler
				.calledWith(@project_id, @compiler)
				.should.equal true
			@EditorRealTimeController.emitToRoom
				.calledWith(@project_id, "compilerUpdated", @compiler)
				.should.equal true

	describe "setImageName", ->
		beforeEach ->
			@imageName = "texlive-1234.5"
			@EditorController.setImageName @project_id, @imageName, @callback

		it "should send the new imageName and project id to the project options handler", ->
			@ProjectOptionsHandler.setImageName
				.calledWith(@project_id, @imageName)
				.should.equal true
			@EditorRealTimeController.emitToRoom
				.calledWith(@project_id, "imageNameUpdated", @imageName)
				.should.equal true

	describe "setSpellCheckLanguage", ->
		beforeEach ->
			@languageCode = "fr"
			@EditorController.setSpellCheckLanguage @project_id, @languageCode, @callback

		it "should send the new languageCode and project id to the project options handler", ->
			@ProjectOptionsHandler.setSpellCheckLanguage
				.calledWith(@project_id, @languageCode)
				.should.equal true
			@EditorRealTimeController.emitToRoom
				.calledWith(@project_id, "spellCheckLanguageUpdated", @languageCode)
				.should.equal true

	describe "setPublicAccessLevel", ->
		describe 'when setting to private', ->
			beforeEach ->
				@newAccessLevel = 'private'
				@ProjectDetailsHandler.ensureTokensArePresent = sinon.stub().yields(null, @tokens)
				@EditorController.setPublicAccessLevel @project_id, @newAccessLevel, @callback

			it 'should set the access level', ->
					@ProjectDetailsHandler.setPublicAccessLevel
						.calledWith(@project_id, @newAccessLevel)
						.should.equal true

			it 'should broadcast the access level change', ->
				@EditorRealTimeController.emitToRoom
					.calledWith(@project_id, 'project:publicAccessLevel:changed')
					.should.equal true

			it 'should not ensure tokens are present for project', ->
				@ProjectDetailsHandler.ensureTokensArePresent
					.calledWith(@project_id)
					.should.equal false

			it 'should not broadcast a token change', ->
				@EditorRealTimeController.emitToRoom
					.calledWith(@project_id, 'project:tokens:changed', {tokens: @tokens})
					.should.equal false

		describe 'when setting to tokenBased', ->
			beforeEach ->
				@newAccessLevel = 'tokenBased'
				@tokens = {readOnly: 'aaa', readAndWrite: '42bbb'}
				@ProjectDetailsHandler.ensureTokensArePresent = sinon.stub().yields(null, @tokens)
				@EditorController.setPublicAccessLevel @project_id, @newAccessLevel, @callback

			it 'should set the access level', ->
				@ProjectDetailsHandler.setPublicAccessLevel
					.calledWith(@project_id, @newAccessLevel)
					.should.equal true

			it 'should broadcast the access level change', ->
				@EditorRealTimeController.emitToRoom
					.calledWith(@project_id, 'project:publicAccessLevel:changed')
					.should.equal true

			it 'should ensure tokens are present for project', ->
				@ProjectDetailsHandler.ensureTokensArePresent
					.calledWith(@project_id)
					.should.equal true

			it 'should broadcast the token change too', ->
				@EditorRealTimeController.emitToRoom
					.calledWith(@project_id, 'project:tokens:changed', {tokens: @tokens})
					.should.equal true

	describe "setRootDoc", ->
		beforeEach ->
			@newRootDocID = "21312321321"
			@ProjectEntityUpdateHandler.setRootDoc = sinon.stub().yields()
			@EditorController.setRootDoc @project_id, @newRootDocID, @callback

		it "should call the ProjectEntityUpdateHandler", ->
			@ProjectEntityUpdateHandler.setRootDoc
				.calledWith(@project_id, @newRootDocID)
				.should.equal true

		it "should emit the update to the room", ->
			@EditorRealTimeController.emitToRoom
				.calledWith(@project_id, 'rootDocUpdated', @newRootDocID)
				.should.equal true
