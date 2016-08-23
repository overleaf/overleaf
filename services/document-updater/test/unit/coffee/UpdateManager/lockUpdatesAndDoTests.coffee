sinon = require('sinon')
chai = require('chai')
should = chai.should()
modulePath = "../../../../app/js/UpdateManager.js"
SandboxedModule = require('sandboxed-module')

describe 'UpdateManager - lockUpdatesAndDo', ->
	beforeEach ->
		@UpdateManager = SandboxedModule.require modulePath, requires:
			"./LockManager" : @LockManager = {}
			"./RedisManager" : @RedisManager = {}
			"./WebRedisManager" : @WebRedisManager = {}
			"./ShareJsUpdateManager" : @ShareJsUpdateManager = {}
			"./TrackChangesManager" : @TrackChangesManager = {}
			"logger-sharelatex": @logger = { log: sinon.stub() }
			"./Metrics": @Metrics =
				Timer: class Timer
					done: sinon.stub()
			"settings-sharelatex": Settings = {}
		@project_id = "project-id-123"
		@doc_id = "doc-id-123"
		@method = sinon.stub().callsArgWith(3, null, @response_arg1)
		@callback = sinon.stub()
		@arg1 = "argument 1"
		@response_arg1 = "response argument 1"
		@lockValue = "mock-lock-value"
		@LockManager.getLock = sinon.stub().callsArgWith(1, null, @lockValue)
		@LockManager.releaseLock = sinon.stub().callsArg(2)

	describe "successfully", ->
		beforeEach ->
			@UpdateManager.continueProcessingUpdatesWithLock = sinon.stub()
			@UpdateManager.processOutstandingUpdates = sinon.stub().callsArg(2)
			@UpdateManager.lockUpdatesAndDo @method, @project_id, @doc_id, @arg1, @callback

		it "should lock the doc", ->
			@LockManager.getLock
				.calledWith(@doc_id)
				.should.equal true

		it "should process any outstanding updates", ->
			@UpdateManager.processOutstandingUpdates
				.calledWith(@project_id, @doc_id)
				.should.equal true

		it "should call the method", ->
			@method
				.calledWith(@project_id, @doc_id, @arg1)
				.should.equal true

		it "should return the method response to the callback", ->
			@callback
				.calledWith(null, @response_arg1)
				.should.equal true

		it "should release the lock", ->
			@LockManager.releaseLock
				.calledWith(@doc_id, @lockValue)
				.should.equal true

		it "should continue processing updates", ->
			@UpdateManager.continueProcessingUpdatesWithLock
				.calledWith(@project_id, @doc_id)
				.should.equal true

	describe "when processOutstandingUpdates returns an error", ->
		beforeEach ->
			@UpdateManager.processOutstandingUpdates = sinon.stub().callsArgWith(2, @error = new Error("Something went wrong"))
			@UpdateManager.lockUpdatesAndDo @method, @project_id, @doc_id, @arg1, @callback

		it "should free the lock", ->
			@LockManager.releaseLock.calledWith(@doc_id, @lockValue).should.equal true
			
		it "should return the error in the callback", ->
			@callback.calledWith(@error).should.equal true

	describe "when the method returns an error", ->
		beforeEach ->
			@UpdateManager.processOutstandingUpdates = sinon.stub().callsArg(2)
			@method = sinon.stub().callsArgWith(3, @error = new Error("something went wrong"), @response_arg1)
			@UpdateManager.lockUpdatesAndDo @method, @project_id, @doc_id, @arg1, @callback

		it "should free the lock", ->
			@LockManager.releaseLock.calledWith(@doc_id, @lockValue).should.equal true
			
		it "should return the error in the callback", ->
			@callback.calledWith(@error).should.equal true



