sinon = require('sinon')
chai = require('chai')
should = chai.should()
modulePath = "../../../../app/js/RedisManager"
SandboxedModule = require('sandboxed-module')

describe "RedisManager.getPreviousDocOpsTests", ->
	beforeEach ->
		@callback = sinon.stub()
		@RedisManager = SandboxedModule.require modulePath, requires:
			"redis-sharelatex" : createClient: () =>
				@rclient ?=
					auth: ->
					multi: => @rclient
			"logger-sharelatex": @logger = { error: sinon.stub(), log: sinon.stub() }
		@doc_id = "doc-id-123"

	describe "with a start and an end value", ->
		beforeEach ->
			@first_version_in_redis = 30
			@version = 70
			@length = @version - @first_version_in_redis
			@start  = 50
			@end    = 60
			@ops = [
				{ "mock": "op-1" },
				{ "mock": "op-2" }
			]
			@jsonOps = @ops.map (op) -> JSON.stringify op
			@rclient.llen = sinon.stub().callsArgWith(1, null, @length)
			@rclient.get = sinon.stub().callsArgWith(1, null, @version.toString())
			@rclient.lrange = sinon.stub().callsArgWith(3, null, @jsonOps)
			@RedisManager.getPreviousDocOps(@doc_id, @start, @end, @callback)

		it "should get the length of the existing doc ops", ->
			@rclient.llen
				.calledWith("DocOps:#{@doc_id}")
				.should.equal true

		it "should get the current version of the doc", ->
			@rclient.get
				.calledWith("DocVersion:#{@doc_id}")
				.should.equal true

		it "should get the appropriate docs ops", ->
			@rclient.lrange
				.calledWith("DocOps:#{@doc_id}", @start - @first_version_in_redis, @end - @first_version_in_redis)
				.should.equal true

		it "should return the docs with the doc ops deserialized", ->
			@callback.calledWith(null, @ops).should.equal true

	describe "with an end value of -1", ->
		beforeEach ->
			@first_version_in_redis = 30
			@version = 70
			@length = @version - @first_version_in_redis
			@start  = 50
			@end    = -1
			@ops = [
				{ "mock": "op-1" },
				{ "mock": "op-2" }
			]
			@jsonOps = @ops.map (op) -> JSON.stringify op
			@rclient.llen = sinon.stub().callsArgWith(1, null, @length)
			@rclient.get = sinon.stub().callsArgWith(1, null, @version.toString())
			@rclient.lrange = sinon.stub().callsArgWith(3, null, @jsonOps)
			@RedisManager.getPreviousDocOps(@doc_id, @start, @end, @callback)

		it "should get the appropriate docs ops to the end of list", ->
			@rclient.lrange
				.calledWith("DocOps:#{@doc_id}", @start - @first_version_in_redis, -1)
				.should.equal true

		it "should return the docs with the doc ops deserialized", ->
			@callback.calledWith(null, @ops).should.equal true

	describe "when the requested range is not in Redis", ->
		beforeEach ->
			@first_version_in_redis = 30
			@version = 70
			@length = @version - @first_version_in_redis
			@start  = 20
			@end    = -1
			@ops = [
				{ "mock": "op-1" },
				{ "mock": "op-2" }
			]
			@jsonOps = @ops.map (op) -> JSON.stringify op
			@rclient.llen = sinon.stub().callsArgWith(1, null, @length)
			@rclient.get = sinon.stub().callsArgWith(1, null, @version.toString())
			@rclient.lrange = sinon.stub().callsArgWith(3, null, @jsonOps)
			@RedisManager.getPreviousDocOps(@doc_id, @start, @end, @callback)
			
		it "should return an error", ->
			@callback.calledWith(new Error("range is not loaded in redis")).should.equal true

		it "should log out the problem", ->
			@logger.error.called.should.equal true
