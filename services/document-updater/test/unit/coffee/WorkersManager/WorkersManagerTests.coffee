sinon = require('sinon')
chai = require('chai')
should = chai.should()
modulePath = "../../../../app/js/WorkersManager.js"
SandboxedModule = require('sandboxed-module')

describe "WorkersManager", ->
	beforeEach ->
		@WorkersManager = SandboxedModule.require modulePath, requires:
			"./UpdateManager" : @UpdateManager = {}
			"logger-sharelatex": @logger = { log: sinon.stub() }
			"settings-sharelatex": @settings =
				redis:
					web: {}
			"redis": @redis = {}
		@callback = sinon.stub()

	describe "each worker", ->
		beforeEach ->
			@client =
				auth: sinon.stub()
			@redis.createClient = sinon.stub().returns @client
			
			@worker = @WorkersManager.createWorker()
			
		it "should create a new redis client", ->
			@redis.createClient.called.should.equal true
			
		describe "waitForAndProcessUpdate", ->
			beforeEach ->
				@project_id = "project-id-123"
				@doc_id = "doc-id-123"
				@doc_key = "#{@project_id}:#{@doc_id}"
				@client.blpop = sinon.stub().callsArgWith(2, null, ["pending-updates-list", @doc_key])
				@UpdateManager.processOutstandingUpdatesWithLock = sinon.stub().callsArg(2)
				
				@worker.waitForAndProcessUpdate @callback
				
			it "should call redis with BLPOP", ->
				@client.blpop
					.calledWith("pending-updates-list", 0)
					.should.equal true
					
			it "should call processOutstandingUpdatesWithLock", ->
				@UpdateManager.processOutstandingUpdatesWithLock
					.calledWith(@project_id, @doc_id)
					.should.equal true
					
			it "should call the callback", ->
				@callback.called.should.equal true
				
		describe "run", ->
			it "should call waitForAndProcessUpdate until shutting down", (done) ->
				callCount = 0
				@worker.waitForAndProcessUpdate = (callback = (error) ->) =>
					callCount++
					if callCount == 3
						@settings.shuttingDown = true
					setTimeout () ->
						callback()
					, 10
				sinon.spy @worker, "waitForAndProcessUpdate"
				
			
				@worker.run()
				
				setTimeout () =>
					@worker.waitForAndProcessUpdate.callCount.should.equal 3
					done()
				, 100
					
			
	