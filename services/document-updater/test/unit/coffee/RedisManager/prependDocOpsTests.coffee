sinon = require('sinon')
chai = require('chai')
should = chai.should()
modulePath = "../../../../app/js/RedisManager"
SandboxedModule = require('sandboxed-module')

describe "RedisManager.prependDocOps", ->
	beforeEach ->
		@doc_id = "document-id"
		@callback = sinon.stub()
		@RedisManager = SandboxedModule.require modulePath, requires:
			"redis" : createClient: () =>
				@rclient = auth:->
			"logger-sharelatex": {}

		@rclient.lpush = sinon.stub().callsArg(2)
		@ops = [
			{ "mock" : "op-1" },
			{ "mock" : "op-2" }
		]
		@reversedJsonOps = @ops.map((op) -> JSON.stringify op).reverse()
		@RedisManager.prependDocOps(@doc_id, @ops, @callback)

	it "should push the reversed JSONed ops", ->
		@rclient.lpush
			.calledWith("DocOps:#{@doc_id}", @reversedJsonOps)
			.should.equal true
	
	it "should return the callback", ->
		@callback.called.should.equal true



