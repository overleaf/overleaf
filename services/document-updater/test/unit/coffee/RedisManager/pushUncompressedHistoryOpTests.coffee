sinon = require('sinon')
chai = require('chai')
should = chai.should()
modulePath = "../../../../app/js/RedisManager.js"
SandboxedModule = require('sandboxed-module')

describe "RedisManager.pushUncompressedHistoryOp", ->
	beforeEach ->
		@RedisManager = SandboxedModule.require modulePath, requires:
			"./ZipManager": {}
			"redis-sharelatex": createClient: () =>
				@rclient ?=
					auth: () ->
			"logger-sharelatex": @logger = {log: sinon.stub()}
		@doc_id = "doc-id-123"
		@project_id = "project-id-123"
		@callback = sinon.stub()

	describe "successfully", ->
		beforeEach (done) ->
			@op = { op: [{ i: "foo", p: 4 }] }
			@rclient.rpush = sinon.stub().yields(null, @length = 42)
			@rclient.sadd = sinon.stub().yields()
			@RedisManager.pushUncompressedHistoryOp @project_id, @doc_id, @op, (args...) =>
				@callback(args...)
				done()
		
		it "should push the doc op into the doc ops list", ->
			@rclient.rpush
				.calledWith("UncompressedHistoryOps:#{@doc_id}", JSON.stringify(@op))
				.should.equal true

		it "should add the doc_id to the set of which records the project docs", ->
			@rclient.sadd
				.calledWith("DocsWithHistoryOps:#{@project_id}", @doc_id)
				.should.equal true

		it "should call the callback with the length", ->
			@callback.calledWith(undefined, @length).should.equal true



