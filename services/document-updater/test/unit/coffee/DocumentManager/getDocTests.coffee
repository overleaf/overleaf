sinon = require('sinon')
chai = require('chai')
should = chai.should()
modulePath = "../../../../app/js/DocumentManager.js"
SandboxedModule = require('sandboxed-module')

describe "DocumentUpdater - getDoc", ->
	beforeEach ->
		@DocumentManager = SandboxedModule.require modulePath, requires:
			"./RedisManager": @RedisManager = {}
			"./PersistenceManager": @PersistenceManager = {}
			"./DocOpsManager": @DocOpsManager = {}
			"logger-sharelatex": @logger = {log: sinon.stub()}
			"./Metrics": @Metrics =
				Timer: class Timer
					done: sinon.stub()

		@project_id = "project-id-123"
		@doc_id = "doc-id-123"
		@lines = ["one", "two", "three"]
		@version = 42
		@callback = sinon.stub()

	describe "when the doc exists in Redis", ->
		beforeEach ->
			@RedisManager.getDoc = sinon.stub().callsArgWith(1, null, @lines, @version)
			@DocumentManager.getDoc @project_id, @doc_id, @callback

		it "should get the doc from Redis", ->
			@RedisManager.getDoc
				.calledWith(@doc_id)
				.should.equal true
		
		it "should call the callback with the doc info", ->
			@callback.calledWith(null, @lines, @version).should.equal true

		it "should time the execution", ->
			@Metrics.Timer::done.called.should.equal true

	describe "when the doc does not exist in Redis", ->
		beforeEach ->
			@RedisManager.getDoc = sinon.stub().callsArgWith(1, null, null, null)
			@PersistenceManager.getDoc = sinon.stub().callsArgWith(2, null, @lines, @version)
			@RedisManager.putDocInMemory = sinon.stub().callsArg(4)
			@DocumentManager.getDoc @project_id, @doc_id, @callback

		it "should try to get the doc from Redis", ->
			@RedisManager.getDoc
				.calledWith(@doc_id)
				.should.equal true

		it "should get the doc from the PersistenceManager", ->
			@PersistenceManager.getDoc
				.calledWith(@project_id, @doc_id)
				.should.equal true

		it "should set the doc in Redis", ->
			@RedisManager.putDocInMemory
				.calledWith(@project_id, @doc_id, @lines, @version)
				.should.equal true

		it "should call the callback with the doc info", ->
			@callback.calledWith(null, @lines, @version).should.equal true

		it "should time the execution", ->
			@Metrics.Timer::done.called.should.equal true
		


