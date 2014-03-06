sinon = require('sinon')
chai = require('chai')
should = chai.should()
expect = chai.expect
modulePath = "../../../../app/js/UpdatesManager.js"
SandboxedModule = require('sandboxed-module')

describe "UpdatesManager", ->
	beforeEach ->
		@UpdatesManager = SandboxedModule.require modulePath, requires:
			"./UpdateCompressor": @UpdateCompressor = {}
			"./MongoManager" : @MongoManager = {}
			"./RedisManager" : @RedisManager = {}
			"./LockManager"  : @LockManager = {}
			"./WebApiManager": @WebApiManager = {}
			"logger-sharelatex": { log: sinon.stub(), error: sinon.stub() }
		@doc_id = "doc-id-123"
		@callback = sinon.stub()

	describe "compressAndSaveRawUpdates", ->
		describe "when there are no raw ops", ->
			beforeEach ->
				@MongoManager.popLastCompressedUpdate = sinon.stub()
				@MongoManager.insertCompressedUpdates = sinon.stub()
				@UpdatesManager.compressAndSaveRawUpdates @doc_id, [], @callback

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
				@UpdatesManager.compressAndSaveRawUpdates @doc_id, @rawUpdates, @callback

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
					@UpdatesManager.compressAndSaveRawUpdates @doc_id, @rawUpdates, @callback

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

					@UpdatesManager.compressAndSaveRawUpdates @doc_id, @rawUpdates, @callback

				it "should only compress the more recent raw ops", ->
					@UpdateCompressor.compressRawUpdates
						.calledWith(@lastCompressedUpdate, @rawUpdates.slice(-2))
						.should.equal true

			describe "when the raw ops do not follow from the last compressed op version", ->
				beforeEach ->
					@rawUpdates = [{ v: 13, op: "mock-op-13" }]
					@UpdatesManager.compressAndSaveRawUpdates @doc_id, @rawUpdates, @callback

				it "should call the callback with an error", ->
					@callback
						.calledWith(new Error("Tried to apply raw op at version 13 to last compressed update with version 11"))
						.should.equal true

				it "should put the popped update back into mongo", ->
					@MongoManager.insertCompressedUpdates.calledOnce.should.equal true
					@MongoManager.insertCompressedUpdates
						.calledWith(@doc_id, [@lastCompressedUpdate])
						.should.equal true

	describe "processUncompressedUpdates", ->
		describe "when there is fewer than one batch to send", ->
			beforeEach ->
				@updates = ["mock-update"]
				@RedisManager.getOldestRawUpdates = sinon.stub().callsArgWith(2, null, @updates)
				@UpdatesManager.compressAndSaveRawUpdates = sinon.stub().callsArgWith(2)
				@RedisManager.deleteOldestRawUpdates = sinon.stub().callsArg(2)
				@UpdatesManager.processUncompressedUpdates @doc_id, @callback

			it "should get the oldest updates", ->
				@RedisManager.getOldestRawUpdates
					.calledWith(@doc_id, @UpdatesManager.REDIS_READ_BATCH_SIZE)
					.should.equal true

			it "should compress and save the updates", ->
				@UpdatesManager.compressAndSaveRawUpdates
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
				@UpdatesManager.REDIS_READ_BATCH_SIZE = 2
				@updates = ["mock-update-0", "mock-update-1", "mock-update-2", "mock-update-3", "mock-update-4"]
				@redisArray = @updates.slice()
				@RedisManager.getOldestRawUpdates = (doc_id, batchSize, callback = (error, updates) ->) =>
					updates = @redisArray.slice(0, batchSize)
					@redisArray = @redisArray.slice(batchSize)
					callback null, updates
				sinon.spy @RedisManager, "getOldestRawUpdates"
				@UpdatesManager.compressAndSaveRawUpdates = sinon.stub().callsArgWith(2)
				@RedisManager.deleteOldestRawUpdates = sinon.stub().callsArg(2)
				@UpdatesManager.processUncompressedUpdates @doc_id, (args...) =>
					@callback(args...)
					done()

			it "should get the oldest updates in three batches ", ->
				@RedisManager.getOldestRawUpdates.callCount.should.equal 3

			it "should compress and save the updates in batches", ->
				@UpdatesManager.compressAndSaveRawUpdates
					.calledWith(@doc_id, @updates.slice(0,2))
					.should.equal true
				@UpdatesManager.compressAndSaveRawUpdates
					.calledWith(@doc_id, @updates.slice(2,4))
					.should.equal true
				@UpdatesManager.compressAndSaveRawUpdates
					.calledWith(@doc_id, @updates.slice(4,5))
					.should.equal true

			it "should delete the batches of uncompressed updates", ->
				@RedisManager.deleteOldestRawUpdates.callCount.should.equal 3

			it "should call the callback", ->
				@callback.called.should.equal true

	describe "processCompressedUpdatesWithLock", ->
		beforeEach ->
			@UpdatesManager.processUncompressedUpdates = sinon.stub().callsArg(2)
			@LockManager.runWithLock = sinon.stub().callsArg(2)
			@UpdatesManager.processUncompressedUpdatesWithLock @doc_id, @callback

		it "should run processUncompressedUpdates with the lock", ->
			@LockManager.runWithLock
				.calledWith(
					"HistoryLock:#{@doc_id}"
				)
				.should.equal true

		it "should call the callback", ->
			@callback.called.should.equal true

	describe "getUpdates", ->
		beforeEach ->
			@updates = ["mock-updates"]
			@options = { to: "mock-to", limit: "mock-limit" }
			@MongoManager.getUpdates = sinon.stub().callsArgWith(2, null, @updates)
			@UpdatesManager.processUncompressedUpdatesWithLock = sinon.stub().callsArg(1)
			@UpdatesManager.getUpdates @doc_id, @options, @callback

		it "should process outstanding updates", ->
			@UpdatesManager.processUncompressedUpdatesWithLock
				.calledWith(@doc_id)
				.should.equal true

		it "should get the updates from the database", ->
			@MongoManager.getUpdates
				.calledWith(@doc_id, @options)
				.should.equal true

		it "should return the updates", ->
			@callback
				.calledWith(null, @updates)
				.should.equal true

	describe "getUpdatesWithUserInfo", ->
		beforeEach ->
			@updates = ["mock-updates"]
			@options = { to: "mock-to", limit: "mock-limit" }
			@updatesWithUserInfo = ["updates-with-user-info"]
			@UpdatesManager.getUpdates = sinon.stub().callsArgWith(2, null, @updates)
			@UpdatesManager.fillUserInfo = sinon.stub().callsArgWith(1, null, @updatesWithUserInfo)
			@UpdatesManager.getUpdatesWithUserInfo @doc_id, @options, @callback

		it "should get the updates", ->
			@UpdatesManager.getUpdates
				.calledWith(@doc_id, @options)
				.should.equal true

		it "should file the updates with the user info", ->
			@UpdatesManager.fillUserInfo
				.calledWith(@updates)
				.should.equal true

		it "shoudl return the updates with the filled details", ->
			@callback.calledWith(null, @updatesWithUserInfo).should.equal true

	describe "fillUserInfo", ->
		beforeEach (done) ->
			@user_id_1 = "user-id-1"
			@user_id_2 = "user-id-2"
			@updates = [{
				meta:
					user_id: @user_id_1
				op: "mock-op-1"
			}, {
				meta:
					user_id: @user_id_1
				op: "mock-op-2"
			}, {
				meta:
					user_id: @user_id_2
				op: "mock-op-3"
			}]
			@user_info =
				"user-id-1": {
					email: "user1@sharelatex.com"
				}
				"user-id-2": {
					email: "user2@sharelatex.com"
				}
			@WebApiManager.getUserInfo = (user_id, callback = (error, userInfo) ->) =>
				callback null, @user_info[user_id]
			sinon.spy @WebApiManager, "getUserInfo"

			@UpdatesManager.fillUserInfo @updates, (error, @results) =>
				done()

		it "should only call getUserInfo once for each user_id", ->
			@WebApiManager.getUserInfo.calledTwice.should.equal true
			@WebApiManager.getUserInfo
				.calledWith(@user_id_1)
				.should.equal true
			@WebApiManager.getUserInfo
				.calledWith(@user_id_2)
				.should.equal true

		it "should return the updates with the user info filled", ->
			expect(@results).to.deep.equal [{
				meta:
					user:
						email: "user1@sharelatex.com"
				op: "mock-op-1"
			}, {
				meta:
					user:
						email: "user1@sharelatex.com"
				op: "mock-op-2"
			}, {
				meta:
					user:
						email: "user2@sharelatex.com"
				op: "mock-op-3"
			}]





