sinon = require('sinon')
chai = require('chai')
should = chai.should()
expect = chai.expect
modulePath = "../../../../app/js/RedisManager.js"
SandboxedModule = require('sandboxed-module')

describe "RedisManager", ->
	beforeEach ->
		@RedisManager = SandboxedModule.require modulePath, requires:
			"redis-sharelatex" : 
				createClient: () => @rclient =
					auth: sinon.stub()
					multi: () => @rclient
			"settings-sharelatex":
				redis:
					web:{}
		@doc_id = "doc-id-123"
		@project_id = "project-id-123"
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
			@rclient.ltrim = sinon.stub()
			@rclient.srem = sinon.stub()
			@rclient.exec = sinon.stub().callsArgWith(0)
			@RedisManager.deleteOldestRawUpdates @project_id, @doc_id, @batchSize, @callback

		it "should delete the updates from redis", ->
			@rclient.ltrim
				.calledWith("UncompressedHistoryOps:#{@doc_id}", @batchSize, -1)
				.should.equal true

		it "should delete the doc from the set of docs with history ops", ->
			@rclient.srem
				.calledWith("DocsWithHistoryOps:#{@project_id}", @doc_id)
				.should.equal true

		it "should call the callback ", ->
			@callback.called.should.equal true

	describe "getDocIdsWithHistoryOps", ->
		beforeEach ->
			@doc_ids = ["mock-id-1", "mock-id-2"]
			@rclient.smembers = sinon.stub().callsArgWith(1, null, @doc_ids)
			@RedisManager.getDocIdsWithHistoryOps @project_id, @callback

		it "should read the doc_ids from redis", ->
			@rclient.smembers
				.calledWith("DocsWithHistoryOps:#{@project_id}")
				.should.equal true

		it "should call the callback with the doc_ids", ->
			@callback.calledWith(null, @doc_ids).should.equal true