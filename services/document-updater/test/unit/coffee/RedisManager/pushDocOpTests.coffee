sinon = require('sinon')
chai = require('chai')
should = chai.should()
modulePath = "../../../../app/js/RedisManager"
SandboxedModule = require('sandboxed-module')

describe "RedisManager.getPreviousDocOpsTests", ->
	beforeEach ->
		@callback = sinon.stub()
		@RedisManager = SandboxedModule.require modulePath, requires:
			"redis" : createClient: () =>
				@rclient =
					auth: ->
					multi: => @rclient
		@doc_id = "doc-id-123"

	beforeEach ->
		@version = 70
		@op =
			{ "mock": "op-1" }
		@jsonOp = JSON.stringify @op
		@rclient.rpush = sinon.stub().callsArgWith(2, null)
		@rclient.incr = sinon.stub().callsArgWith(1, null, @version.toString())
		@RedisManager.pushDocOp(@doc_id, @op, @callback)

	it "should push the op into redis", ->
		@rclient.rpush
			.calledWith("DocOps:#{@doc_id}", @jsonOp)
			.should.equal true

	it "should increment the version number", ->
		@rclient.incr
			.calledWith("DocVersion:#{@doc_id}")
			.should.equal true
	
	it "should call the callback with the new version", ->
		@callback.calledWith(null, @version).should.equal true
