sinon = require('sinon')
chai = require('chai')
should = chai.should()
modulePath = "../../../../app/js/ProjectHistoryRedisManager.js"
SandboxedModule = require('sandboxed-module')
tk = require "timekeeper"

describe "ProjectHistoryRedisManager", ->
	beforeEach ->
		@project_id = "project-id-123"
		@projectHistoryId = "history-id-123"
		@user_id = "user-id-123"
		@callback = sinon.stub()
		@rclient = {}
		tk.freeze(new Date())
		@ProjectHistoryRedisManager = SandboxedModule.require modulePath,
			requires:
				"settings-sharelatex": @settings = {
					redis:
						project_history:
							key_schema:
								projectHistoryOps: ({project_id}) -> "ProjectHistory:Ops:#{project_id}"
								projectHistoryFirstOpTimestamp: ({project_id}) -> "ProjectHistory:FirstOpTimestamp:#{project_id}"
				}
				"redis-sharelatex":
					createClient: () => @rclient
				"./RedisMigrationManager":
					createClient: () => @rclient
				"logger-sharelatex":
					log:->
				"./Metrics": @metrics = { summary: sinon.stub()}
			globals:
				JSON: @JSON = JSON

	afterEach ->
		tk.reset()

	describe "queueOps", ->
		beforeEach ->
			@ops = ["mock-op-1", "mock-op-2"]
			@multi = exec: sinon.stub()
			@multi.rpush = sinon.stub()
			@multi.setnx = sinon.stub()
			@rclient.multi = () => @multi
			# @rclient = multi: () => @multi
			@ProjectHistoryRedisManager.queueOps @project_id, @ops..., @callback

		it "should queue an update", ->
			@multi.rpush
				.calledWithExactly(
					"ProjectHistory:Ops:#{@project_id}"
					@ops[0]
					@ops[1]
				).should.equal true

		it "should set the queue timestamp if not present", ->
			@multi.setnx
				.calledWithExactly(
					"ProjectHistory:FirstOpTimestamp:#{@project_id}"
					Date.now()
				).should.equal true

	describe "queueRenameEntity", ->
		beforeEach () ->
			@file_id = 1234

			@rawUpdate =
				pathname: @pathname = '/old'
				newPathname: @newPathname = '/new'
				version: @version = 2

			@ProjectHistoryRedisManager.queueOps = sinon.stub()
			@ProjectHistoryRedisManager.queueRenameEntity @project_id, @projectHistoryId, 'file', @file_id, @user_id, @rawUpdate, @callback

		it "should queue an update", ->
			update =
				pathname: @pathname
				new_pathname: @newPathname
				meta:
					user_id: @user_id
					ts: new Date()
				version: @version
				projectHistoryId: @projectHistoryId
				file: @file_id

			@ProjectHistoryRedisManager.queueOps
				.calledWithExactly(@project_id, @JSON.stringify(update), @callback)
				.should.equal true

	describe "queueAddEntity", ->
		beforeEach () ->
			@rclient.rpush = sinon.stub().yields()
			@doc_id = 1234

			@rawUpdate =
				pathname: @pathname = '/old'
				docLines: @docLines = 'a\nb'
				version: @version = 2
				url: @url = 'filestore.example.com'

			@ProjectHistoryRedisManager.queueOps = sinon.stub()
			@ProjectHistoryRedisManager.queueAddEntity @project_id, @projectHistoryId, 'doc', @doc_id, @user_id, @rawUpdate, @callback

		it "should queue an update", ->
			update =
				pathname: @pathname
				docLines: @docLines
				url: @url
				meta:
					user_id: @user_id
					ts: new Date()
				version: @version
				projectHistoryId: @projectHistoryId
				doc: @doc_id

			@ProjectHistoryRedisManager.queueOps
				.calledWithExactly(@project_id, @JSON.stringify(update), @callback)
				.should.equal true

		describe "queueResyncProjectStructure", ->
			it "should queue an update", ->

		describe "queueResyncDocContent", ->
			it "should queue an update", ->
