sinon = require('sinon')
chai = require('chai')
should = chai.should()
modulePath = "../../../../app/js/DocumentManager.js"
SandboxedModule = require('sandboxed-module')

describe "DocumentUpdater - flushAndDeleteDoc", ->
	beforeEach ->
		@DocumentManager = SandboxedModule.require modulePath, requires:
			"./RedisManager": @RedisManager = {}
			"./PersistenceManager": @PersistenceManager = {}
			"logger-sharelatex": @logger = {log: sinon.stub()}
			"./DocOpsManager" :{}
			"./Metrics": @Metrics =
				Timer: class Timer
					done: sinon.stub()
		@project_id = "project-id-123"
		@doc_id = "doc-id-123"
		@callback = sinon.stub()

	describe "successfully", ->
		beforeEach ->
			@RedisManager.removeDocFromMemory = sinon.stub().callsArg(2)
			@DocumentManager.flushDocIfLoaded = sinon.stub().callsArgWith(2)
			@DocumentManager.flushAndDeleteDoc @project_id, @doc_id, @callback
		
		it "should flush the doc", ->
			@DocumentManager.flushDocIfLoaded
				.calledWith(@project_id, @doc_id)
				.should.equal true

		it "should remove the doc from redis", ->
			@RedisManager.removeDocFromMemory
				.calledWith(@project_id, @doc_id)
				.should.equal true

		it "should call the callback without error", ->
			@callback.calledWith(null).should.equal true

		it "should time the execution", ->
			@Metrics.Timer::done.called.should.equal true
