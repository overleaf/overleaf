SandboxedModule = require('sandboxed-module')
sinon = require('sinon')
require('chai').should()
modulePath = require('path').join __dirname, '../../../app/js/ProjectPersistenceManager'
tk = require("timekeeper")

describe "ProjectPersistenceManager", ->
	beforeEach ->
		@ProjectPersistenceManager = SandboxedModule.require modulePath, requires:
			"./UrlCache": @UrlCache = {}
			"./CompileManager": @CompileManager = {}
			"logger-sharelatex": @logger = { log: sinon.stub() }
			"./db": @db = {}
		@callback = sinon.stub()
		@project_id = "project-id-123"
		@user_id = "1234"

	describe "clearExpiredProjects", ->
		beforeEach ->
			@project_ids = [
				"project-id-1"
				"project-id-2"
			]
			@ProjectPersistenceManager._findExpiredProjectIds = sinon.stub().callsArgWith(0, null, @project_ids)
			@ProjectPersistenceManager.clearProjectFromCache = sinon.stub().callsArg(1)
			@CompileManager.clearExpiredProjects = sinon.stub().callsArg(1)
			@ProjectPersistenceManager.clearExpiredProjects @callback

		it "should clear each expired project", ->
			for project_id in @project_ids
				@ProjectPersistenceManager.clearProjectFromCache
					.calledWith(project_id)
					.should.equal true

		it "should call the callback", ->
			@callback.called.should.equal true

	describe "clearProject", ->
		beforeEach ->
			@ProjectPersistenceManager._clearProjectFromDatabase = sinon.stub().callsArg(1)
			@UrlCache.clearProject = sinon.stub().callsArg(1)
			@CompileManager.clearProject = sinon.stub().callsArg(2)
			@ProjectPersistenceManager.clearProject @project_id, @user_id, @callback

		it "should clear the project from the database", ->
			@ProjectPersistenceManager._clearProjectFromDatabase
				.calledWith(@project_id)
				.should.equal true

		it "should clear all the cached Urls for the project", ->
			@UrlCache.clearProject
				.calledWith(@project_id)
				.should.equal true

		it "should clear the project compile folder", ->
			@CompileManager.clearProject
				.calledWith(@project_id, @user_id)
				.should.equal true

		it "should call the callback", ->
			@callback.called.should.equal true
			
