sinon = require('sinon')
chai = require('chai')
should = chai.should()
modulePath = "../../../../app/js/DocumentManager.js"
SandboxedModule = require('sandboxed-module')

describe "DocumentUpdater - flushDocIfLoaded", ->
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

	describe "when the doc is in Redis", ->
		beforeEach ->
			@RedisManager.getDoc = sinon.stub().callsArgWith(1, null, @lines, @version)
			@PersistenceManager.setDoc = sinon.stub().callsArgWith(4)
			@DocumentManager.flushDocIfLoaded @project_id, @doc_id, @callback

		it "should get the doc from redis", ->
			@RedisManager.getDoc
				.calledWith(@doc_id)
				.should.equal true

		it "should write the doc lines to the persistence layer", ->
			@PersistenceManager.setDoc
				.calledWith(@project_id, @doc_id, @lines, @version)
				.should.equal true
		
		it "should call the callback without error", ->
			@callback.calledWith(null).should.equal true

		it "should time the execution", ->
			@Metrics.Timer::done.called.should.equal true

	describe "when the document is not in Redis", ->
		beforeEach ->
			@RedisManager.getDoc = sinon.stub().callsArgWith(1, null, null, null)
			@PersistenceManager.setDoc = sinon.stub().callsArgWith(4)
			@DocOpsManager.flushDocOpsToMongo = sinon.stub().callsArgWith(2)
			@DocumentManager.flushDocIfLoaded @project_id, @doc_id, @callback

		it "should get the doc from redis", ->
			@RedisManager.getDoc
				.calledWith(@doc_id)
				.should.equal true

		it "should not write anything to the persistence layer", ->
			@PersistenceManager.setDoc.called.should.equal false
			@DocOpsManager.flushDocOpsToMongo.called.should.equal false

		it "should call the callback without error", ->
			@callback.calledWith(null).should.equal true

		it "should time the execution", ->
			@Metrics.Timer::done.called.should.equal true
		

