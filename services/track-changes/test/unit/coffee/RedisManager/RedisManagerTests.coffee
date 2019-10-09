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
					history:
						key_schema:
							uncompressedHistoryOps: ({doc_id}) -> "UncompressedHistoryOps:#{doc_id}"
							docsWithHistoryOps: ({project_id}) -> "DocsWithHistoryOps:#{project_id}"
		@doc_id = "doc-id-123"
		@project_id = "project-id-123"
		@batchSize = 100
		@callback = sinon.stub()

	describe "getOldestDocUpdates", ->
		beforeEach ->
			@rawUpdates = [ {v: 42, op: "mock-op-42"}, { v: 45, op: "mock-op-45" }]
			@jsonUpdates = (JSON.stringify(update) for update in @rawUpdates)
			@rclient.lrange = sinon.stub().callsArgWith(3, null, @jsonUpdates)
			@RedisManager.getOldestDocUpdates @doc_id, @batchSize, @callback

		it "should read the updates from redis", ->
			@rclient.lrange
				.calledWith("UncompressedHistoryOps:#{@doc_id}", 0, @batchSize - 1)
				.should.equal true

		it "should call the callback with the unparsed ops", ->
			@callback.calledWith(null, @jsonUpdates).should.equal true


		describe "expandDocUpdates", ->
			beforeEach ->
				@RedisManager.expandDocUpdates @jsonUpdates, @callback

			it "should call the callback with the parsed ops", ->
				@callback.calledWith(null, @rawUpdates).should.equal true


		describe "deleteAppliedDocUpdates", ->
			beforeEach ->
				@rclient.lrem = sinon.stub()
				@rclient.srem = sinon.stub()
				@rclient.exec = sinon.stub().callsArgWith(0)
				@RedisManager.deleteAppliedDocUpdates @project_id, @doc_id, @jsonUpdates, @callback

			it "should delete the first update from redis", ->
				@rclient.lrem
					.calledWith("UncompressedHistoryOps:#{@doc_id}", 1, @jsonUpdates[0])
					.should.equal true

			it "should delete the second update from redis", ->
				@rclient.lrem
					.calledWith("UncompressedHistoryOps:#{@doc_id}", 1, @jsonUpdates[1])
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
