sinon = require('sinon')
chai = require('chai')
should = chai.should()
modulePath = "../../../../app/js/RedisManager.js"
SandboxedModule = require('sandboxed-module')

describe "RedisManager.pushDocOp", ->
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
		@rclient.expire = sinon.stub()
		@rclient.incr = sinon.stub()
		@rclient.ltrim = sinon.stub()

	describe "successfully", ->
		beforeEach ->
			@op = { op: [{ i: "foo", p: 4 }] }
			@version = 42
			_ = null
			@rclient.exec = sinon.stub().callsArgWith(0, null, [_, _, _, @version])
			@RedisManager.pushDocOp @doc_id, @op, @callback
		
		it "should push the doc op into the doc ops list", ->
			@rclient.rpush
				.calledWith("DocOps:#{@doc_id}", JSON.stringify(@op))
				.should.equal true

		it "should renew the expiry ttl on the doc ops array", ->
			@rclient.expire
				.calledWith("DocOps:#{@doc_id}", @RedisManager.DOC_OPS_TTL)
				.should.equal true

		it "should truncate the list to 100 members", ->
			@rclient.ltrim
				.calledWith("DocOps:#{@doc_id}", -@RedisManager.DOC_OPS_MAX_LENGTH, -1)
				.should.equal true

		it "should increment the version number", ->
			@rclient.incr
				.calledWith("DocVersion:#{@doc_id}")
				.should.equal true

		it "should call the callback with the version number", ->
			@callback.calledWith(null, parseInt(@version, 10)).should.equal true



