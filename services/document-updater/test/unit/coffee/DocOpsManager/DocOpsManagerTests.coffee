sinon = require('sinon')
chai = require('chai')
should = chai.should()
modulePath = "../../../../app/js/DocOpsManager.js"
SandboxedModule = require('sandboxed-module')
ObjectId = require("../../../../app/js/mongojs").ObjectId

describe "DocOpsManager", ->
	beforeEach ->
		@doc_id = ObjectId().toString()
		@project_id = "project-id"
		@callback = sinon.stub()
		@DocOpsManager = SandboxedModule.require modulePath, requires:
			"./RedisManager": @RedisManager = {}
			"./mongojs":
				db: @db = { docOps: {} }
				ObjectId: ObjectId
			"logger-sharelatex": @logger = { log: sinon.stub(), error: sinon.stub() }
			"./Metrics": @Metrics =
				Timer: class Timer
					done: sinon.stub()
			"./TrackChangesManager": @TrackChangesManager = {}

	describe "flushDocOpsToMongo", ->
		describe "when versions are consistent", ->
			beforeEach ->
				@mongo_version = 40
				@redis_version = 42
				@ops = [ "mock-op-1", "mock-op-2" ]
				@DocOpsManager.getDocVersionInMongo = sinon.stub().callsArgWith(1, null, @mongo_version)
				@RedisManager.getDocVersion = sinon.stub().callsArgWith(1, null, @redis_version)
				@RedisManager.getPreviousDocOps = sinon.stub().callsArgWith(3, null, @ops)
				@DocOpsManager._appendDocOpsInMongo = sinon.stub().callsArg(3)
				@DocOpsManager.flushDocOpsToMongo @project_id, @doc_id, @callback

			it "should get the version from Mongo", ->
				@DocOpsManager.getDocVersionInMongo
					.calledWith(@doc_id)
					.should.equal true

			it "should get the version from REdis", ->
				@RedisManager.getDocVersion
					.calledWith(@doc_id)
					.should.equal true

			it "should get all doc ops since the version in Mongo", ->
				@RedisManager.getPreviousDocOps
					.calledWith(@doc_id, @mongo_version, -1)
					.should.equal true

			it "should update Mongo with the new ops", ->
				@DocOpsManager._appendDocOpsInMongo
					.calledWith(@doc_id, @ops, @redis_version)
					.should.equal true

			it "should call the callback", ->
				@callback.called.should.equal true

			it "should time the execution", ->
				@Metrics.Timer::done.called.should.equal true

		describe "when the number of ops does not match the difference in versions", ->
			beforeEach ->
				@mongo_version = 40
				@redis_version = 45
				@ops = [ "mock-op-1", "mock-op-2" ]
				@DocOpsManager.getDocVersionInMongo = sinon.stub().callsArgWith(1, null, @mongo_version)
				@RedisManager.getDocVersion = sinon.stub().callsArgWith(1, null, @redis_version)
				@RedisManager.getPreviousDocOps = sinon.stub().callsArgWith(3, null, @ops)
				@DocOpsManager._appendDocOpsInMongo = sinon.stub().callsArg(3)
				@DocOpsManager.flushDocOpsToMongo @project_id, @doc_id, @callback

			it "should call the callback with an error", ->
				@callback.calledWith(new Error("inconsistet versions")).should.equal true

			it "should log an error", ->
				@logger.error
					.calledWith(doc_id: @doc_id, mongoVersion: @mongo_version, redisVersion: @redis_version, opsLength: @ops.length, "version difference does not match ops length")
					.should.equal true

			it "should not modify mongo", ->
				@DocOpsManager._appendDocOpsInMongo.called.should.equal false

			it "should time the execution", ->
				@Metrics.Timer::done.called.should.equal true

		describe "when redis version is behind mongo version", ->
			beforeEach ->
				@mongo_version = 40
				@redis_version = 30
				@DocOpsManager.getDocVersionInMongo = sinon.stub().callsArgWith(1, null, @mongo_version)
				@RedisManager.getDocVersion = sinon.stub().callsArgWith(1, null, @redis_version)
				@RedisManager.getPreviousDocOps = sinon.stub().callsArgWith(3, null, @ops)
				@DocOpsManager._appendDocOpsInMongo = sinon.stub().callsArg(3)
				@DocOpsManager.flushDocOpsToMongo @project_id, @doc_id, @callback
			
			it "should call the callback with an error", ->
				@callback.calledWith(new Error("inconsistet versions")).should.equal true

			it "should log an error", ->
				@logger.error
					.calledWith(doc_id: @doc_id, mongoVersion: @mongo_version, redisVersion: @redis_version, "mongo version is ahead of redis")
					.should.equal true

			it "should not modify mongo", ->
				@DocOpsManager._appendDocOpsInMongo.called.should.equal false

			it "should time the execution", ->
				@Metrics.Timer::done.called.should.equal true

	describe "getPreviousDocOps", ->
		beforeEach ->
			@ops = [ "mock-op-1", "mock-op-2" ]
			@start = 30
			@end = 32
			@RedisManager.getPreviousDocOps = sinon.stub().callsArgWith(3, null, @ops)
			@DocOpsManager._ensureOpsAreLoaded = sinon.stub().callsArg(3)
			@DocOpsManager.getPreviousDocOps @project_id, @doc_id, @start, @end, @callback

		it "should ensure the ops are loaded back far enough", ->
			@DocOpsManager._ensureOpsAreLoaded
				.calledWith(@project_id, @doc_id, @start)
				.should.equal true

		it "should get the previous doc ops", ->
			@RedisManager.getPreviousDocOps
				.calledWith(@doc_id, @start, @end)
				.should.equal true

		it "should call the callback with the ops", ->
			@callback.calledWith(null, @ops).should.equal true

		it "should time the execution", ->
			@Metrics.Timer::done.called.should.equal true

	describe "_ensureOpsAreLoaded", ->
		describe "when the ops are not loaded", ->
			beforeEach ->
				@redisVersion = 42
				@redisOpsLength = 10
				@backToVersion = 30
				@ops = [ "mock-op-1", "mock-op-2" ]
				@RedisManager.getDocVersion = sinon.stub().callsArgWith(1, null, @redisVersion)
				@RedisManager.getDocOpsLength = sinon.stub().callsArgWith(1, null, @redisOpsLength)
				@DocOpsManager._getDocOpsFromMongo = sinon.stub().callsArgWith(3, null, @ops)
				@RedisManager.prependDocOps = sinon.stub().callsArgWith(2, null)
				@DocOpsManager._ensureOpsAreLoaded @project_id, @doc_id, @backToVersion, @callback

			it "should get the doc version from redis", ->
				@RedisManager.getDocVersion
					.calledWith(@doc_id)
					.should.equal true

			it "should get the doc ops length in redis", ->
				@RedisManager.getDocOpsLength
					.calledWith(@doc_id)
					.should.equal true

			it "should get the doc ops that need loading from Mongo", ->
				@DocOpsManager._getDocOpsFromMongo
					.calledWith(@doc_id, @backToVersion, @redisVersion - @redisOpsLength)
					.should.equal true

			it "should prepend the retrieved ops to redis", ->
				@RedisManager.prependDocOps
					.calledWith(@doc_id, @ops)
					.should.equal true

			it "should call the callback", ->
				@callback.called.should.equal true

		describe "when the ops are loaded", ->
			beforeEach ->
				@redisVersion = 42
				@redisOpsLength = 10
				@backToVersion = 35
				@RedisManager.getDocVersion = sinon.stub().callsArgWith(1, null, @redisVersion)
				@RedisManager.getDocOpsLength = sinon.stub().callsArgWith(1, null, @redisOpsLength)
				@DocOpsManager._getDocOpsFromMongo = sinon.stub().callsArgWith(3, null, @ops)
				@RedisManager.prependDocOps = sinon.stub().callsArgWith(2, null)
				@DocOpsManager._ensureOpsAreLoaded @project_id, @doc_id, @backToVersion, @callback

			it "should not need to get the docs from Mongo or put any into redis", ->
				@DocOpsManager._getDocOpsFromMongo.called.should.equal false
				@RedisManager.prependDocOps.called.should.equal false

			it "should call the callback", ->
				@callback.called.should.equal true

	describe "getDocVersionInMongo", ->
		describe "when the doc exists", ->
			beforeEach ->
				@doc =
					version: @version = 42
				@db.docOps.find = sinon.stub().callsArgWith(2, null, [@doc])
				@DocOpsManager.getDocVersionInMongo @doc_id, @callback

			it "should look for the doc in the database", ->
				@db.docOps.find
					.calledWith({ doc_id: ObjectId(@doc_id) }, {version: 1})
					.should.equal true

			it "should call the callback with the version", ->
				@callback.calledWith(null, @version).should.equal true

		describe "when the doc doesn't exist", ->
			beforeEach ->
				@db.docOps.find = sinon.stub().callsArgWith(2, null, [])
				@DocOpsManager.getDocVersionInMongo @doc_id, @callback
			
			it "should call the callback with 0", ->
				@callback.calledWith(null, 0).should.equal true

	describe "_appendDocOpsInMongo", ->
		describe "with a small set of updates", ->
			beforeEach (done) ->
				@ops = [ "mock-op-1", "mock-op-2" ]
				@version = 42
				@db.docOps.update = sinon.stub().callsArg(3)
				@DocOpsManager._appendDocOpsInMongo @doc_id, @ops, @version, (error) =>
					@callback(error)
					done()

			it "should update the database", ->
				@db.docOps.update
					.calledWith({
						doc_id: ObjectId(@doc_id)
					}, {
						$push: docOps: { $each: @ops, $slice: -100 }
						$set: version: @version
					}, {
						upsert: true
					})
					.should.equal true

			it "should call the callbak", ->
				@callback.called.should.equal true

		describe "with a large set of updates", ->
			beforeEach (done) ->
				@ops = [ "mock-op-1", "mock-op-2", "mock-op-3", "mock-op-4", "mock-op-5" ]
				@version = 42
				@DocOpsManager.APPEND_OPS_BATCH_SIZE = 2
				@db.docOps.update = sinon.stub().callsArg(3)
				@DocOpsManager._appendDocOpsInMongo @doc_id, @ops, @version, (error) =>
					@callback(error)
					done()

			it "should update the database in batches", ->
				@db.docOps.update
					.calledWith({ doc_id: ObjectId(@doc_id) }, {
						$push: docOps: { $each: @ops.slice(0,2), $slice: -100 }
						$set: version: @version - 3
					}, { upsert: true })
					.should.equal true
				@db.docOps.update
					.calledWith({ doc_id: ObjectId(@doc_id) }, {
						$push: docOps: { $each: @ops.slice(2,4), $slice: -100 }
						$set: version: @version - 1
					}, { upsert: true })
					.should.equal true
				@db.docOps.update
					.calledWith({ doc_id: ObjectId(@doc_id) }, {
						$push: docOps: { $each: @ops.slice(4,5), $slice: -100 }
						$set: version: @version
					}, { upsert: true })
					.should.equal true

			it "should call the callbak", ->
				@callback.called.should.equal true

		describe "with no updates", ->
			beforeEach (done) ->
				@ops = []
				@version = 42
				@db.docOps.update = sinon.stub().callsArg(3)
				@DocOpsManager._appendDocOpsInMongo @doc_id, @ops, @version, (error) =>
					@callback(error)
					done()

			it "should not try to update the database", ->
				@db.docOps.update.called.should.equal false

	describe "_getDocsOpsFromMongo", ->
		beforeEach ->
			@version = 42
			@start = 32
			@limit = 5
			@doc =
				docOps: ["mock-ops"]
			@DocOpsManager.getDocVersionInMongo = sinon.stub().callsArgWith(1, null, @version)
			@db.docOps.find = sinon.stub().callsArgWith(2, null, [@doc])
			@DocOpsManager._getDocOpsFromMongo @doc_id, @start, @start + @limit, @callback

		it "should get the current version", ->
			@DocOpsManager.getDocVersionInMongo
				.calledWith(@doc_id)
				.should.equal true

		it "should get the doc ops", ->
			@db.docOps.find
				.calledWith({ doc_id: ObjectId(@doc_id) }, {
					docOps: $slice: [-(@version - @start), @limit]
				})
				.should.equal true

		it "should return the ops", ->
			@callback.calledWith(null, @doc.docOps).should.equal true

	describe "pushDocOp", ->
		beforeEach ->
			@op = "mock-op"
			@RedisManager.pushDocOp = sinon.stub().callsArgWith(2, null, @version = 42)
			@TrackChangesManager.pushUncompressedHistoryOp = sinon.stub().callsArg(3)
			@DocOpsManager.pushDocOp @project_id, @doc_id, @op, @callback

		it "should push the op in to the docOps list", ->
			@RedisManager.pushDocOp
				.calledWith(@doc_id, @op)
				.should.equal true

		it "should push the op into the pushUncompressedHistoryOp", ->
			@TrackChangesManager.pushUncompressedHistoryOp
				.calledWith(@project_id, @doc_id, @op)
				.should.equal true

		it "should call the callback with the version", ->
			@callback.calledWith(null, @version).should.equal true

	
