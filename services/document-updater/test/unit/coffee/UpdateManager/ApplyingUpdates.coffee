sinon = require('sinon')
chai = require('chai')
should = chai.should()
modulePath = "../../../../app/js/UpdateManager.js"
SandboxedModule = require('sandboxed-module')

describe "UpdateManager", ->
	beforeEach ->
		@project_id = "project-id-123"
		@doc_id = "document-id-123"
		@callback = sinon.stub()
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

	describe "processOutstandingUpdates", ->
		beforeEach ->
			@UpdateManager.fetchAndApplyUpdates = sinon.stub().callsArg(2)
			@UpdateManager.processOutstandingUpdates @project_id, @doc_id, @callback

		it "should apply the updates", ->
			@UpdateManager.fetchAndApplyUpdates.calledWith(@project_id, @doc_id).should.equal true

		it "should call the callback", ->
			@callback.called.should.equal true

		it "should time the execution", ->
			@Metrics.Timer::done.called.should.equal true

	describe "processOutstandingUpdatesWithLock", ->
		describe "when the lock is free", ->
			beforeEach ->
				@LockManager.tryLock = sinon.stub().callsArgWith(1, null, true, @lockValue = "mock-lock-value")
				@LockManager.releaseLock = sinon.stub().callsArg(2)
				@UpdateManager.continueProcessingUpdatesWithLock = sinon.stub().callsArg(2)
				@UpdateManager.processOutstandingUpdates = sinon.stub().callsArg(2)

			describe "successfully", ->
				beforeEach ->
					@UpdateManager.processOutstandingUpdatesWithLock @project_id, @doc_id, @callback

				it "should acquire the lock", ->
					@LockManager.tryLock.calledWith(@doc_id).should.equal true

				it "should free the lock", ->
					@LockManager.releaseLock.calledWith(@doc_id, @lockValue).should.equal true

				it "should process the outstanding updates", ->
					@UpdateManager.processOutstandingUpdates.calledWith(@project_id, @doc_id).should.equal true
					
				it "should do everything with the lock acquired", ->
					@UpdateManager.processOutstandingUpdates.calledAfter(@LockManager.tryLock).should.equal true
					@UpdateManager.processOutstandingUpdates.calledBefore(@LockManager.releaseLock).should.equal true

				it "should continue processing new updates that may have come in", ->
					@UpdateManager.continueProcessingUpdatesWithLock.calledWith(@project_id, @doc_id).should.equal true
				
				it "should return the callback", ->
					@callback.called.should.equal true

			describe "when processOutstandingUpdates returns an error", ->
				beforeEach ->
					@UpdateManager.processOutstandingUpdates = sinon.stub().callsArgWith(2, @error = new Error("Something went wrong"))
					@UpdateManager.processOutstandingUpdatesWithLock @project_id, @doc_id, @callback

				it "should free the lock", ->
					@LockManager.releaseLock.calledWith(@doc_id, @lockValue).should.equal true
					
				it "should return the error in the callback", ->
					@callback.calledWith(@error).should.equal true

		describe "when the lock is taken", ->
			beforeEach ->
				@LockManager.tryLock = sinon.stub().callsArgWith(1, null, false)
				@UpdateManager.processOutstandingUpdates = sinon.stub().callsArg(2)
				@UpdateManager.processOutstandingUpdatesWithLock @project_id, @doc_id, @callback

			it "should return the callback", ->
				@callback.called.should.equal true

			it "should not process the updates", ->
				@UpdateManager.processOutstandingUpdates.called.should.equal false
				
	describe "continueProcessingUpdatesWithLock", ->
		describe "when there are outstanding updates", ->
			beforeEach ->
				@WebRedisManager.getUpdatesLength = sinon.stub().callsArgWith(1, null, 3)
				@UpdateManager.processOutstandingUpdatesWithLock = sinon.stub().callsArg(2)
				@UpdateManager.continueProcessingUpdatesWithLock @project_id, @doc_id, @callback

			it "should process the outstanding updates", ->
				@UpdateManager.processOutstandingUpdatesWithLock.calledWith(@project_id, @doc_id).should.equal true

			it "should return the callback", ->
				@callback.called.should.equal true

		describe "when there are no outstanding updates", ->
			beforeEach ->
				@WebRedisManager.getUpdatesLength = sinon.stub().callsArgWith(1, null, 0)
				@UpdateManager.processOutstandingUpdatesWithLock = sinon.stub().callsArg(2)
				@UpdateManager.continueProcessingUpdatesWithLock @project_id, @doc_id, @callback

			it "should not try to process the outstanding updates", ->
				@UpdateManager.processOutstandingUpdatesWithLock.called.should.equal false

			it "should return the callback", ->
				@callback.called.should.equal true

	describe "fetchAndApplyUpdates", ->
		describe "with updates", ->
			beforeEach ->
				@updates = [{p: 1, t: "foo"}]
				@updatedDocLines = ["updated", "lines"]
				@version = 34
				@WebRedisManager.getPendingUpdatesForDoc = sinon.stub().callsArgWith(1, null, @updates)
				@UpdateManager.applyUpdate = sinon.stub().callsArgWith(3, null, @updatedDocLines, @version)
				@UpdateManager.fetchAndApplyUpdates @project_id, @doc_id, @callback

			it "should get the pending updates", ->
				@WebRedisManager.getPendingUpdatesForDoc.calledWith(@doc_id).should.equal true

			it "should apply the updates", ->
				for update in @updates
					@UpdateManager.applyUpdate
						.calledWith(@project_id, @doc_id, update)
						.should.equal true
		
			it "should call the callback", ->
				@callback.called.should.equal true

		describe "when there are no updates", ->
			beforeEach ->
				@updates = []
				@WebRedisManager.getPendingUpdatesForDoc = sinon.stub().callsArgWith(1, null, @updates)
				@UpdateManager.applyUpdate = sinon.stub()
				@RedisManager.setDocument = sinon.stub()
				@UpdateManager.fetchAndApplyUpdates @project_id, @doc_id, @callback

			it "should not call applyUpdate", ->
				@UpdateManager.applyUpdate.called.should.equal false

			it "should call the callback", ->
				@callback.called.should.equal true
				
	describe "applyUpdate", ->
		beforeEach ->
			@update = {op: [{p: 42, i: "foo"}]}
			@updatedDocLines = ["updated", "lines"]
			@version = 34
			@appliedOps = ["mock-applied-ops"]
			@ShareJsUpdateManager.applyUpdate = sinon.stub().callsArgWith(3, null, @updatedDocLines, @version, @appliedOps)
			@RedisManager.updateDocument = sinon.stub().callsArg(4)
			@TrackChangesManager.pushUncompressedHistoryOps = sinon.stub().callsArg(3)
		
		describe "normally", ->
			beforeEach ->
				@UpdateManager.applyUpdate @project_id, @doc_id, @update, @callback
			
			it "should apply the updates via ShareJS", ->
				@ShareJsUpdateManager.applyUpdate
					.calledWith(@project_id, @doc_id, @update)
					.should.equal true

			it "should save the document", ->
				@RedisManager.updateDocument
					.calledWith(@doc_id, @updatedDocLines, @version, @appliedOps)
					.should.equal true
			
			it "should push the applied ops into the track changes queue", ->
				@TrackChangesManager.pushUncompressedHistoryOps
					.calledWith(@project_id, @doc_id, @appliedOps)
					.should.equal true

			it "should call the callback", ->
				@callback.called.should.equal true

		describe "with UTF-16 surrogate pairs in the update", ->
			beforeEach ->
				@update = {op: [{p: 42, i: "\uD835\uDC00"}]}
				@UpdateManager.applyUpdate @project_id, @doc_id, @update, @callback

			it "should apply the update but with surrogate pairs removed", ->
				@ShareJsUpdateManager.applyUpdate
					.calledWith(@project_id, @doc_id, @update)
					.should.equal true
				
				# \uFFFD is 'replacement character'
				@update.op[0].i.should.equal "\uFFFD\uFFFD"

