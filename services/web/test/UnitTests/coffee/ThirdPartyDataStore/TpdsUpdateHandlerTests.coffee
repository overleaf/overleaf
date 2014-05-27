SandboxedModule = require('sandboxed-module')
sinon = require('sinon')
require('chai').should()
modulePath = require('path').join __dirname, '../../../../app/js/Features/ThirdPartyDataStore/TpdsUpdateHandler.js'

describe 'third party data store reciver :', ->
	beforeEach ->
		@requestQueuer = {}
		@updateMerger = 
			deleteUpdate: (user_id, path, sl_req_id, cb)->cb()
			mergeUpdate:(user_id, path, update, sl_req_id, cb)->cb()
		@editorController = {}
		@project_id = "dsjajilknaksdn"
		@project = {_id:@project_id, name:"projectNameHere"}
		@projectLocator = findUsersProjectByName:sinon.stub().callsArgWith(2, null, @project)
		@projectCreationHandler = 
			createBlankProject : sinon.stub().callsArgWith(2, null, @project)
		@projectDeleter = {markAsDeletedByExternalSource:sinon.stub().callsArgWith(1)}
		@rootDocManager = setRootDocAutomatically:sinon.stub()
		@handler = SandboxedModule.require modulePath, requires:
			'./UpdateMerger': @updateMerger
			'./Editor/EditorController': @editorController
			'../Project/ProjectLocator': @projectLocator
			'../Project/ProjectCreationHandler':@projectCreationHandler
			'../Project/ProjectDeleter': @projectDeleter
			"../Project/ProjectRootDocManager" : @rootDocManager
			'logger-sharelatex': log:->
		@user_id = "dsad29jlkjas"

	describe 'getting an update', ->
		it 'should send the update to the update merger', (done)->
			path = "/path/here"
			update = {}
			@updateMerger.mergeUpdate = sinon.stub()
			@updateMerger.mergeUpdate.withArgs(@project_id, path, update).callsArg(4)
			@handler.newUpdate @user_id, @project.name, path, update, "", =>
				@projectCreationHandler.createBlankProject.called.should.equal false
				done()

		it 'should create a new project if one does not already exit', (done)->
			@projectLocator.findUsersProjectByName = sinon.stub().callsArgWith(2)
			path = "/"
			@handler.newUpdate @user_id, @project.name, path, {}, "", =>
				@projectCreationHandler.createBlankProject.calledWith(@user_id, @project.name).should.equal true
				done()

		it 'should set the root doc automatically if a new project is created', (done)->
			@projectLocator.findUsersProjectByName = sinon.stub().callsArgWith(2)
			@handler._rootDocTimeoutLength = 0
			path = "/"
			@handler.newUpdate @user_id, @project.name, path, {}, "", =>
				setTimeout (=>
					@rootDocManager.setRootDocAutomatically.calledWith(@project._id).should.equal true
					done()
				), 1



	describe 'getting a delete :', ->
		it 'should call deleteEntity in the collaberation manager', (done)->
			path = "/delete/this"
			update = {}
			@updateMerger.deleteUpdate = sinon.stub().callsArg(3)

			@handler.deleteUpdate @user_id, @project.name,path, "sl_req_id", =>
				@projectDeleter.markAsDeletedByExternalSource.calledWith(@project._id).should.equal false
				@updateMerger.deleteUpdate.calledWith(@project_id, path).should.equal true
				done()

		it 'should mark the project as deleted by external source if path is a single slash', (done)->
			path = "/"
			@handler.deleteUpdate @user_id, @project.name, path, "sl_req_id", =>
				@projectDeleter.markAsDeletedByExternalSource.calledWith(@project._id).should.equal true
				done()

