SandboxedModule = require('sandboxed-module')
sinon = require('sinon')
require('chai').should()
expect = require('chai').expect
modulePath = require('path').join __dirname, '../../../../app/js/Features/ThirdPartyDataStore/TpdsUpdateHandler.js'

describe 'TpdsUpdateHandler', ->
	beforeEach ->
		@requestQueuer = {}
		@updateMerger = 
			deleteUpdate: (user_id, project_id, path, source, cb)->cb()
			mergeUpdate:(user_id, project_id, path, update, source, cb)->cb()
		@editorController = {}
		@project_id = "dsjajilknaksdn"
		@project = {_id:@project_id, name:"projectNameHere"}
		@projectLocator = findUsersProjectByName:sinon.stub().callsArgWith(2, null, @project)
		@projectCreationHandler = 
			createBlankProject : sinon.stub().callsArgWith(2, null, @project)
		@projectDeleter = {markAsDeletedByExternalSource:sinon.stub().callsArgWith(1)}
		@rootDocManager = setRootDocAutomatically:sinon.stub()
		@FileTypeManager =
			shouldIgnore: sinon.stub().callsArgWith(1, null, false)
		@CooldownManager =
			isProjectOnCooldown: sinon.stub().callsArgWith(1, null, false)
		@handler = SandboxedModule.require modulePath, requires:
			'./UpdateMerger': @updateMerger
			'./Editor/EditorController': @editorController
			'../Project/ProjectLocator': @projectLocator
			'../Project/ProjectCreationHandler':@projectCreationHandler
			'../Project/ProjectDeleter': @projectDeleter
			"../Project/ProjectRootDocManager" : @rootDocManager
			'../Uploads/FileTypeManager': @FileTypeManager
			'../Cooldown/CooldownManager': @CooldownManager
			'logger-sharelatex': log:->
		@user_id = "dsad29jlkjas"
		@source = "dropbox"

	describe 'getting an update', ->
		it 'should send the update to the update merger', (done)->
			path = "/path/here"
			update = {}
			@updateMerger.mergeUpdate = sinon.stub()
			@updateMerger.mergeUpdate.withArgs(@user_id, @project_id, path, update, @source).callsArg(5)
			@handler.newUpdate @user_id, @project.name, path, update, @source, =>
				@projectCreationHandler.createBlankProject.called.should.equal false
				done()

		it 'should create a new project if one does not already exit', (done)->
			@projectLocator.findUsersProjectByName = sinon.stub().callsArgWith(2)
			path = "/"
			@handler.newUpdate @user_id, @project.name, path, {}, @source, =>
				@projectCreationHandler.createBlankProject.calledWith(@user_id, @project.name).should.equal true
				done()

		it 'should set the root doc automatically if a new project is created', (done)->
			@projectLocator.findUsersProjectByName = sinon.stub().callsArgWith(2)
			@handler._rootDocTimeoutLength = 0
			path = "/"
			@handler.newUpdate @user_id, @project.name, path, {}, @source, =>
				setTimeout (=>
					@rootDocManager.setRootDocAutomatically.calledWith(@project._id).should.equal true
					done()
				), 1

		it 'should not update files that should be ignored', (done) ->
			@FileTypeManager.shouldIgnore = sinon.stub().callsArgWith(1, null, true)
			@projectLocator.findUsersProjectByName = sinon.stub().callsArgWith(2)
			path = "/.gitignore"
			@updateMerger.mergeUpdate = sinon.stub()
			@handler.newUpdate @user_id, @project.name, path, {}, @source, =>
				@updateMerger.mergeUpdate.called.should.equal false
				done()

		it 'should check if the project is on cooldown', (done) ->
			@CooldownManager.isProjectOnCooldown = sinon.stub().callsArgWith(1, null, false)
			@projectLocator.findUsersProjectByName = sinon.stub().callsArgWith(2)
			path = "/path/here"
			update = {}
			@updateMerger.mergeUpdate = sinon.stub()
			@updateMerger.mergeUpdate.withArgs(@user_id, @project_id, path, update, @source).callsArg(5)
			@handler.newUpdate @user_id, @project.name, path, update, @source, (err) =>
				expect(err).to.be.oneOf [null, undefined]
				@CooldownManager.isProjectOnCooldown.callCount.should.equal 1
				@CooldownManager.isProjectOnCooldown.calledWith(@project_id).should.equal true
				@FileTypeManager.shouldIgnore.callCount.should.equal 1
				@updateMerger.mergeUpdate.callCount.should.equal 1
				done()

		it 'should return error and not proceed with update if project is on cooldown', (done) ->
			@CooldownManager.isProjectOnCooldown = sinon.stub().callsArgWith(1, null, true)
			@projectLocator.findUsersProjectByName = sinon.stub().callsArgWith(2)
			@FileTypeManager.shouldIgnore = sinon.stub().callsArgWith(1, null, false)
			path = "/path/here"
			update = {}
			@updateMerger.mergeUpdate = sinon.stub()
			@updateMerger.mergeUpdate.withArgs(@user_id, @project_id, path, update, @source).callsArg(5)
			@handler.newUpdate @user_id, @project.name, path, update, @source, (err) =>
				expect(err).to.not.be.oneOf [null, undefined]
				expect(err).to.be.instanceof Error
				@CooldownManager.isProjectOnCooldown.callCount.should.equal 1
				@CooldownManager.isProjectOnCooldown.calledWith(@project_id).should.equal true
				@FileTypeManager.shouldIgnore.callCount.should.equal 0
				@updateMerger.mergeUpdate.callCount.should.equal 0
				done()

	describe 'getting a delete :', ->
		it 'should call deleteEntity in the collaberation manager', (done)->
			path = "/delete/this"
			update = {}
			@updateMerger.deleteUpdate = sinon.stub().callsArg(4)

			@handler.deleteUpdate @user_id, @project.name, path, @source, =>
				@projectDeleter.markAsDeletedByExternalSource.calledWith(@project._id).should.equal false
				@updateMerger.deleteUpdate
					.calledWith(@user_id, @project_id, path, @source)
					.should.equal true
				done()

		it 'should mark the project as deleted by external source if path is a single slash', (done)->
			path = "/"
			@handler.deleteUpdate @user_id, @project.name, path, @source, =>
				@projectDeleter.markAsDeletedByExternalSource.calledWith(@project._id).should.equal true
				done()

