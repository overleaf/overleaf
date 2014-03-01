sinon = require('sinon')
chai = require('chai')
should = chai.should()
expect = chai.expect
modulePath = "../../../../app/js/HistoryManager.js"
SandboxedModule = require('sandboxed-module')

describe "HistoryManager", ->
	beforeEach ->
		@HistoryManager = SandboxedModule.require modulePath, requires:
			"./UpdateCompressor": @UpdateCompressor = {}
			"./MongoManager" : @MongoManager = {}
			"./RedisManager" : @RedisManager = {}
			"./LockManager"  : @LockManager = {}
			"logger-sharelatex": { log: sinon.stub() }
		@doc_id = "doc-id-123"
		@callback = sinon.stub()

	describe "compressAndSaveRawUpdates", ->
		describe "when there are no raw ops", ->
			beforeEach ->
				@MongoManager.popLastCompressedUpdate = sinon.stub()
				@MongoManager.insertCompressedUpdates = sinon.stub()
				@HistoryManager.compressAndSaveRawUpdates @doc_id, [], @callback

			it "should not need to access the database", ->
				@MongoManager.popLastCompressedUpdate.called.should.equal false
				@MongoManager.insertCompressedUpdates.called.should.equal false

			it "should call the callback", ->
				@callback.called.should.equal true

		describe "when there is no compressed history to begin with", ->
			beforeEach ->
				@rawUpdates = [{ v: 12, op: "mock-op-12" }, { v: 13, op: "mock-op-13" }]
				@compressedUpdates = { v: 13, op: "compressed-op-12" }

				@MongoManager.popLastCompressedUpdate = sinon.stub().callsArgWith(1, null, null)
				@MongoManager.insertCompressedUpdates = sinon.stub().callsArg(2)
				@UpdateCompressor.compressRawUpdates = sinon.stub().returns(@compressedUpdates)
				@HistoryManager.compressAndSaveRawUpdates @doc_id, @rawUpdates, @callback

			it "should try to pop the last compressed op", ->
				@MongoManager.popLastCompressedUpdate
					.calledWith(@doc_id)
					.should.equal true
			
			it "should compress the raw ops", ->
				@UpdateCompressor.compressRawUpdates
					.calledWith(null, @rawUpdates)
					.should.equal true
			
			it "should save the compressed ops", ->
				@MongoManager.insertCompressedUpdates
					.calledWith(@doc_id, @compressedUpdates)
					.should.equal true

			it "should call the callback", ->
				@callback.called.should.equal true

		describe "when the raw ops need appending to existing history", ->
			beforeEach ->
				@lastCompressedUpdate = { v: 11, op: "compressed-op-11" }
				@compressedUpdates = { v: 13, op: "compressed-op-12" }

				@MongoManager.popLastCompressedUpdate = sinon.stub().callsArgWith(1, null, @lastCompressedUpdate)
				@MongoManager.insertCompressedUpdates = sinon.stub().callsArg(2)
				@UpdateCompressor.compressRawUpdates = sinon.stub().returns(@compressedUpdates)

			describe "when the raw ops start where the existing history ends", ->
				beforeEach ->
					@rawUpdates = [{ v: 12, op: "mock-op-12" }, { v: 13, op: "mock-op-13" }]
					@HistoryManager.compressAndSaveRawUpdates @doc_id, @rawUpdates, @callback

				it "should try to pop the last compressed op", ->
					@MongoManager.popLastCompressedUpdate
						.calledWith(@doc_id)
						.should.equal true
				
				it "should compress the last compressed op and the raw ops", ->
					@UpdateCompressor.compressRawUpdates
						.calledWith(@lastCompressedUpdate, @rawUpdates)
						.should.equal true
				
				it "should save the compressed ops", ->
					@MongoManager.insertCompressedUpdates
						.calledWith(@doc_id, @compressedUpdates)
						.should.equal true

				it "should call the callback", ->
					@callback.called.should.equal true

			describe "when some raw ops are passed that have already been compressed", ->
				beforeEach ->
					@rawUpdates = [{ v: 10, op: "mock-op-10" }, { v: 11, op: "mock-op-11"}, { v: 12, op: "mock-op-12" }, { v: 13, op: "mock-op-13" }]

					@HistoryManager.compressAndSaveRawUpdates @doc_id, @rawUpdates, @callback

				it "should only compress the more recent raw ops", ->
					@UpdateCompressor.compressRawUpdates
						.calledWith(@lastCompressedUpdate, @rawUpdates.slice(-2))
						.should.equal true

			describe "when the raw ops do not follow from the last compressed op version", ->
				beforeEach ->
					@rawUpdates = [{ v: 13, op: "mock-op-13" }]
					@HistoryManager.compressAndSaveRawUpdates @doc_id, @rawUpdates, @callback

				it "should call the callback with an error", ->
					@callback
						.calledWith(new Error("Tried to apply raw op at version 13 to last compressed update with version 11"))
						.should.equal true

	describe "processUncompressedUpdates", ->
		describe "when there is fewer than one batch to send", ->
			beforeEach ->
				@updates = ["mock-update"]
				@RedisManager.getOldestRawUpdates = sinon.stub().callsArgWith(2, null, @updates)
				@HistoryManager.compressAndSaveRawUpdates = sinon.stub().callsArgWith(2)
				@RedisManager.deleteOldestRawUpdates = sinon.stub().callsArg(2)
				@HistoryManager.processUncompressedUpdates @doc_id, @callback

			it "should get the oldest updates", ->
				@RedisManager.getOldestRawUpdates
					.calledWith(@doc_id, @HistoryManager.REDIS_READ_BATCH_SIZE)
					.should.equal true

			it "should compress and save the updates", ->
				@HistoryManager.compressAndSaveRawUpdates
					.calledWith(@doc_id, @updates)
					.should.equal true

			it "should delete the batch of uncompressed updates that was just processed", ->
				@RedisManager.deleteOldestRawUpdates
					.calledWith(@doc_id, @updates.length)
					.should.equal true

			it "should call the callback", ->
				@callback.called.should.equal true

		describe "when there are multiple batches to send", ->
			beforeEach (done) ->
				@HistoryManager.REDIS_READ_BATCH_SIZE = 2
				@updates = ["mock-update-0", "mock-update-1", "mock-update-2", "mock-update-3", "mock-update-4"]
				@redisArray = @updates.slice()
				@RedisManager.getOldestRawUpdates = (doc_id, batchSize, callback = (error, updates) ->) =>
					updates = @redisArray.slice(0, batchSize)
					@redisArray = @redisArray.slice(batchSize)
					callback null, updates
				sinon.spy @RedisManager, "getOldestRawUpdates"
				@HistoryManager.compressAndSaveRawUpdates = sinon.stub().callsArgWith(2)
				@RedisManager.deleteOldestRawUpdates = sinon.stub().callsArg(2)
				@HistoryManager.processUncompressedUpdates @doc_id, (args...) =>
					@callback(args...)
					done()

			it "should get the oldest updates in three batches ", ->
				@RedisManager.getOldestRawUpdates.callCount.should.equal 3

			it "should compress and save the updates in batches", ->
				@HistoryManager.compressAndSaveRawUpdates
					.calledWith(@doc_id, @updates.slice(0,2))
					.should.equal true
				@HistoryManager.compressAndSaveRawUpdates
					.calledWith(@doc_id, @updates.slice(2,4))
					.should.equal true
				@HistoryManager.compressAndSaveRawUpdates
					.calledWith(@doc_id, @updates.slice(4,5))
					.should.equal true

			it "should delete the batches of uncompressed updates", ->
				@RedisManager.deleteOldestRawUpdates.callCount.should.equal 3

			it "should call the callback", ->
				@callback.called.should.equal true

	describe "processCompressedUpdatesWithLock", ->
		beforeEach ->
			@HistoryManager.processUncompressedUpdates = sinon.stub().callsArg(2)
			@LockManager.runWithLock = sinon.stub().callsArg(2)
			@HistoryManager.processUncompressedUpdatesWithLock @doc_id, @callback

		it "should run processUncompressedUpdates with the lock", ->
			@LockManager.runWithLock
				.calledWith(
					"HistoryLock:#{@doc_id}"
				)
				.should.equal true

		it "should call the callback", ->
			@callback.called.should.equal true
