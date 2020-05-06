sinon = require('sinon')
chai = require('chai')
should = chai.should()
modulePath = "../../../../app/js/DispatchManager.js"
SandboxedModule = require('sandboxed-module')
Errors = require "../../../../app/js/Errors.js"

describe "DispatchManager", ->
	beforeEach ->
		@timeout(3000)
		@DispatchManager = SandboxedModule.require modulePath, requires:
			"./UpdateManager" : @UpdateManager = {}
			"logger-sharelatex": @logger = { log: sinon.stub(), error: sinon.stub(), warn: sinon.stub() }
			"settings-sharelatex": @settings =
				redis:
					documentupdater: {}
			"redis-sharelatex": @redis = {}
			"./RateLimitManager": {}
			"./Errors": Errors
			"./Metrics":
				Timer: ->
					done: ->
		@callback = sinon.stub()
		@RateLimiter = { run: (task,cb) -> task(cb) } # run task without rate limit

	describe "each worker", ->
		beforeEach ->
			@client =
				auth: sinon.stub()
			@redis.createClient = sinon.stub().returns @client
			@worker = @DispatchManager.createDispatcher(@RateLimiter)
			
		it "should create a new redis client", ->
			@redis.createClient.called.should.equal true
			
		describe "_waitForUpdateThenDispatchWorker", ->
			beforeEach ->
				@project_id = "project-id-123"
				@doc_id = "doc-id-123"
				@doc_key = "#{@project_id}:#{@doc_id}"
				@client.blpop = sinon.stub().callsArgWith(2, null, ["pending-updates-list", @doc_key])

			describe "in the normal case", ->
				beforeEach ->
					@UpdateManager.processOutstandingUpdatesWithLock = sinon.stub().callsArg(2)
					@worker._waitForUpdateThenDispatchWorker @callback

				it "should call redis with BLPOP", ->
					@client.blpop
						.calledWith("pending-updates-list", 0)
						.should.equal true
						
				it "should call processOutstandingUpdatesWithLock", ->
					@UpdateManager.processOutstandingUpdatesWithLock
						.calledWith(@project_id, @doc_id)
						.should.equal true

				it "should not log any errors", ->
					@logger.error.called.should.equal false
					@logger.warn.called.should.equal false

				it "should call the callback", ->
					@callback.called.should.equal true

			describe "with an error", ->
				beforeEach ->
					@UpdateManager.processOutstandingUpdatesWithLock = sinon.stub().callsArgWith(2, new Error("a generic error"))
					@worker._waitForUpdateThenDispatchWorker @callback

				it "should log an error", ->
					@logger.error.called.should.equal true

				it "should call the callback", ->
					@callback.called.should.equal true

			describe "with a 'Delete component' error", ->
				beforeEach ->
					@UpdateManager.processOutstandingUpdatesWithLock = sinon.stub().callsArgWith(2, new Errors.DeleteMismatchError())
					@worker._waitForUpdateThenDispatchWorker @callback

				it "should log a warning", ->
					@logger.warn.called.should.equal true

				it "should call the callback", ->
					@callback.called.should.equal true

		describe "run", ->
			it "should call _waitForUpdateThenDispatchWorker until shutting down", (done) ->
				callCount = 0
				@worker._waitForUpdateThenDispatchWorker = (callback = (error) ->) =>
					callCount++
					if callCount == 3
						@settings.shuttingDown = true
					setTimeout () ->
						callback()
					, 10
				sinon.spy @worker, "_waitForUpdateThenDispatchWorker"
				
			
				@worker.run()

				checkStatus = () =>
					if not @settings.shuttingDown # retry until shutdown
						setTimeout checkStatus, 100
						return
					else
						@worker._waitForUpdateThenDispatchWorker.callCount.should.equal 3
						done()

				checkStatus()
