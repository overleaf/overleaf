sinon = require('sinon')
chai = require('chai')
should = chai.should()
modulePath = "../../../../app/js/RedisManager.js"
SandboxedModule = require('sandboxed-module')

describe "RedisManager.pushUncompressedHistoryOp", ->
	beforeEach ->
		@RedisManager = SandboxedModule.require modulePath, requires:
			"redis": createClient: () =>
				@rclient =
					auth: () ->
					multi: () => @rclient
			"logger-sharelatex": @logger = {log: sinon.stub()}
		@doc_id = "doc-id-123"
		@callback = sinon.stub()
		@rclient.rpush = sinon.stub()

	describe "successfully", ->
		beforeEach ->
			@op = { op: [{ i: "foo", p: 4 }] }
			@rclient.rpush = sinon.stub().callsArg(2)
			@RedisManager.pushUncompressedHistoryOp @doc_id, @op, @callback
		
		it "should push the doc op into the doc ops list", ->
			@rclient.rpush
				.calledWith("UncompressedHistoryOps:#{@doc_id}", JSON.stringify(@op))
				.should.equal true

		it "should call the callback", ->
			@callback.called.should.equal true



