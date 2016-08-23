sinon = require('sinon')
chai = require('chai')
should = chai.should()
modulePath = "../../../../app/js/DocumentManager.js"
SandboxedModule = require('sandboxed-module')

describe "DocumentManager.getDocAndRecentOps", ->
	beforeEach ->
		@DocumentManager = SandboxedModule.require modulePath, requires:
			"./RedisManager": @RedisManager = {}
			"./PersistenceManager": @PersistenceManager = {}
			"logger-sharelatex": @logger = {log: sinon.stub()}
			"./Metrics": @Metrics =
				Timer: class Timer
					done: sinon.stub()
			"./TrackChangesManager": {}

		@project_id = "project-id-123"
		@doc_id = "doc-id-123"
		@lines = ["one", "two", "three"]
		@version = 42
		@fromVersion = 40
		@ops = ["mock-op-1", "mock-op-2"]
		@callback = sinon.stub()

	describe "with a previous version specified", ->
		beforeEach ->
			@DocumentManager.getDoc = sinon.stub().callsArgWith(2, null, @lines, @version)
			@RedisManager.getPreviousDocOps = sinon.stub().callsArgWith(3, null, @ops)
			@DocumentManager.getDocAndRecentOps @project_id, @doc_id, @fromVersion, @callback

		it "should get the doc", ->
			@DocumentManager.getDoc
				.calledWith(@project_id, @doc_id)
				.should.equal true

		it "should get the doc ops", ->
			@RedisManager.getPreviousDocOps
				.calledWith(@doc_id, @fromVersion, @version)
				.should.equal true

		it "should call the callback with the doc info", ->
			@callback.calledWith(null, @lines, @version, @ops).should.equal true

		it "should time the execution", ->
			@Metrics.Timer::done.called.should.equal true

	describe "with no previous version specified", ->
		beforeEach ->
			@DocumentManager.getDoc = sinon.stub().callsArgWith(2, null, @lines, @version)
			@RedisManager.getPreviousDocOps = sinon.stub().callsArgWith(3, null, @ops)
			@DocumentManager.getDocAndRecentOps @project_id, @doc_id, -1, @callback

		it "should get the doc", ->
			@DocumentManager.getDoc
				.calledWith(@project_id, @doc_id)
				.should.equal true

		it "should not need to get the doc ops", ->
			@RedisManager.getPreviousDocOps.called.should.equal false

		it "should call the callback with the doc info", ->
			@callback.calledWith(null, @lines, @version, []).should.equal true

		it "should time the execution", ->
			@Metrics.Timer::done.called.should.equal true

