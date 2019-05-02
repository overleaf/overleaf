sinon = require('sinon')
chai = require('chai')
should = chai.should()
modulePath = "../../../../app/js/UpdateManager.js"
SandboxedModule = require('sandboxed-module')

describe "UpdateManager", ->
	beforeEach ->
		@project_id = "project-id-123"
		@projectHistoryId = "history-id-123"
		@doc_id = "document-id-123"
		@callback = sinon.stub()
		@UpdateManager = SandboxedModule.require modulePath, requires:
			"./LockManager" : @LockManager = {}
			"./RedisManager" : @RedisManager = {}
			"./RealTimeRedisManager" : @RealTimeRedisManager = {}
			"./ShareJsUpdateManager" : @ShareJsUpdateManager = {}
			"./HistoryManager" : @HistoryManager = {}
			"logger-sharelatex": @logger = { log: sinon.stub() }
			"./Metrics": @Metrics =
				Timer: class Timer
					done: sinon.stub()
			"settings-sharelatex": @Settings = {}
			"./DocumentManager": @DocumentManager = {}
			"./RangesManager": @RangesManager = {}
			"./SnapshotManager": @SnapshotManager = {}
			"./Profiler": class Profiler
				log: sinon.stub().returns { end: sinon.stub() }
				end: sinon.stub()

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
				@RealTimeRedisManager.getUpdatesLength = sinon.stub().callsArgWith(1, null, 3)
				@UpdateManager.processOutstandingUpdatesWithLock = sinon.stub().callsArg(2)
				@UpdateManager.continueProcessingUpdatesWithLock @project_id, @doc_id, @callback

			it "should process the outstanding updates", ->
				@UpdateManager.processOutstandingUpdatesWithLock.calledWith(@project_id, @doc_id).should.equal true

			it "should return the callback", ->
				@callback.called.should.equal true

		describe "when there are no outstanding updates", ->
			beforeEach ->
				@RealTimeRedisManager.getUpdatesLength = sinon.stub().callsArgWith(1, null, 0)
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
				@RealTimeRedisManager.getPendingUpdatesForDoc = sinon.stub().callsArgWith(1, null, @updates)
				@UpdateManager.applyUpdate = sinon.stub().callsArgWith(3, null, @updatedDocLines, @version)
				@UpdateManager.fetchAndApplyUpdates @project_id, @doc_id, @callback

			it "should get the pending updates", ->
				@RealTimeRedisManager.getPendingUpdatesForDoc.calledWith(@doc_id).should.equal true

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
				@RealTimeRedisManager.getPendingUpdatesForDoc = sinon.stub().callsArgWith(1, null, @updates)
				@UpdateManager.applyUpdate = sinon.stub()
				@RedisManager.setDocument = sinon.stub()
				@UpdateManager.fetchAndApplyUpdates @project_id, @doc_id, @callback

			it "should not call applyUpdate", ->
				@UpdateManager.applyUpdate.called.should.equal false

			it "should call the callback", ->
				@callback.called.should.equal true

	describe "applyUpdate", ->
		beforeEach ->
			@updateMeta = { user_id: 'last-author-fake-id' }
			@update = {op: [{p: 42, i: "foo"}], meta: @updateMeta}
			@updatedDocLines = ["updated", "lines"]
			@version = 34
			@lines = ["original", "lines"]
			@ranges = { entries: "mock", comments: "mock" }
			@updated_ranges = { entries: "updated", comments: "updated" }
			@appliedOps = [ {v: 42, op: "mock-op-42"}, { v: 45, op: "mock-op-45" }]
			@doc_ops_length = sinon.stub()
			@project_ops_length = sinon.stub()
			@pathname = '/a/b/c.tex'
			@DocumentManager.getDoc = sinon.stub().yields(null, @lines, @version, @ranges, @pathname, @projectHistoryId)
			@RangesManager.applyUpdate = sinon.stub().yields(null, @updated_ranges, false)
			@ShareJsUpdateManager.applyUpdate = sinon.stub().yields(null, @updatedDocLines, @version, @appliedOps)
			@RedisManager.updateDocument = sinon.stub().yields(null, @doc_ops_length, @project_ops_length)
			@RealTimeRedisManager.sendData = sinon.stub()
			@UpdateManager._addProjectHistoryMetadataToOps = sinon.stub()
			@HistoryManager.recordAndFlushHistoryOps = sinon.stub().callsArg(5)

		describe "normally", ->
			beforeEach ->
				@UpdateManager.applyUpdate @project_id, @doc_id, @update, @callback

			it "should apply the updates via ShareJS", ->
				@ShareJsUpdateManager.applyUpdate
					.calledWith(@project_id, @doc_id, @update, @lines, @version)
					.should.equal true

			it "should update the ranges", ->
				@RangesManager.applyUpdate
					.calledWith(@project_id, @doc_id, @ranges, @appliedOps, @updatedDocLines)
					.should.equal true

			it "should save the document", ->
				@RedisManager.updateDocument
					.calledWith(@project_id, @doc_id, @updatedDocLines, @version, @appliedOps, @updated_ranges, @updateMeta)
					.should.equal true

			it "should add metadata to the ops" , ->
				@UpdateManager._addProjectHistoryMetadataToOps
					.calledWith(@appliedOps, @pathname, @projectHistoryId, @lines)
					.should.equal true

			it "should push the applied ops into the history queue", ->
				@HistoryManager.recordAndFlushHistoryOps
					.calledWith(@project_id, @doc_id, @appliedOps, @doc_ops_length, @project_ops_length)
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

		describe "with an error", ->
			beforeEach ->
				@error = new Error("something went wrong")
				@ShareJsUpdateManager.applyUpdate = sinon.stub().yields(@error)
				@UpdateManager.applyUpdate @project_id, @doc_id, @update, @callback

			it "should call RealTimeRedisManager.sendData with the error", ->
				@RealTimeRedisManager.sendData
					.calledWith({
						project_id: @project_id,
						doc_id: @doc_id,
						error: @error.message
					})
					.should.equal true

			it "should call the callback with the error", ->
				@callback.calledWith(@error).should.equal true

		describe "when ranges get collapsed", ->
			beforeEach ->
				@RangesManager.applyUpdate = sinon.stub().yields(null, @updated_ranges, true)
				@SnapshotManager.recordSnapshot = sinon.stub().yields()
				@UpdateManager.applyUpdate @project_id, @doc_id, @update, @callback

			it "should call SnapshotManager.recordSnapshot", ->
				@SnapshotManager.recordSnapshot
					.calledWith(
						@project_id,
						@doc_id,
						@version,
						@pathname,
						@lines,
						@ranges
					)
					.should.equal true


	describe "_addProjectHistoryMetadataToOps", ->
		it "should add projectHistoryId, pathname and doc_length metadata to the ops", ->
			lines = [
				'some'
				'test'
				'data'
			]
			appliedOps = [
				{ v: 42, op: [{i: "foo", p: 4}, { i: "bar", p: 6 }] },
				{ v: 45, op: [{d: "qux", p: 4}, { i: "bazbaz", p: 14 }] },
				{ v: 49, op: [{i: "penguin", p: 18}] }
			]
			@UpdateManager._addProjectHistoryMetadataToOps(appliedOps, @pathname, @projectHistoryId, lines)
			appliedOps.should.deep.equal [{
				projectHistoryId: @projectHistoryId
				v: 42
				op: [{i: "foo", p: 4}, { i: "bar", p: 6 }]
				meta:
					pathname: @pathname
					doc_length: 14
			}, {
				projectHistoryId: @projectHistoryId
				v: 45
				op: [{d: "qux", p: 4}, { i: "bazbaz", p: 14 }]
				meta:
					pathname: @pathname
					doc_length: 20 # 14 + 'foo' + 'bar'
			}, {
				projectHistoryId: @projectHistoryId
				v: 49
				op: [{i: "penguin", p: 18}]
				meta:
					pathname: @pathname
					doc_length: 23 # 14 - 'qux' + 'bazbaz'
			}]

	describe "lockUpdatesAndDo", ->
		beforeEach ->
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



