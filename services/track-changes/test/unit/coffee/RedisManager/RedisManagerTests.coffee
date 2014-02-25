sinon = require('sinon')
chai = require('chai')
should = chai.should()
expect = chai.expect
modulePath = "../../../../app/js/RedisManager.js"
SandboxedModule = require('sandboxed-module')

describe "RedisManager", ->
	beforeEach ->
		@RedisManager = SandboxedModule.require modulePath, requires:
			"redis" : 
				createClient: () => @rclient =
					auth: sinon.stub()
			"settings-sharelatex": {}
		@doc_id = "doc-id-123"
		@batchSize = 100
		@callback = sinon.stub()

	describe "getOldestRawUpdates", ->
		beforeEach ->
			@rawUpdates = [ {v: 42, op: "mock-op-42"}, { v: 45, op: "mock-op-45" }]
			@jsonUpdates = (JSON.stringify(update) for update in @rawUpdates)
			@rclient.lrange = sinon.stub().callsArgWith(3, null, @jsonUpdates)
			@RedisManager.getOldestRawUpdates @doc_id, @batchSize, @callback

		it "should read the updates from redis", ->
			@rclient.lrange
				.calledWith("UncompressedHistoryOps:#{@doc_id}", 0, @batchSize - 1)
				.should.equal true

		it "should call the callback with the parsed ops", ->
			@callback.calledWith(null, @rawUpdates).should.equal true

	describe "deleteOldestRawUpdates", ->
		beforeEach ->
			@rclient.ltrim = sinon.stub().callsArg(3)
			@RedisManager.deleteOldestRawUpdates @doc_id, @batchSize, @callback

		it "should delete the updates from redis", ->
			@rclient.ltrim
				.calledWith("UncompressedHistoryOps:#{@doc_id}", @batchSize, -1)
				.should.equal true

		it "should call the callback", ->
			@callback.called.should.equal true
