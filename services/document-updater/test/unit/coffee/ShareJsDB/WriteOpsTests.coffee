sinon = require('sinon')
chai = require('chai')
should = chai.should()
modulePath = "../../../../app/js/ShareJsDB.js"
SandboxedModule = require('sandboxed-module')

describe "ShareJsDB.writeOps", ->
	beforeEach ->
		@project_id = "project-id"
		@doc_id = "document-id"
		@doc_key = "#{@project_id}:#{@doc_id}"
		@callback = sinon.stub()
		@opData =
			op: {p: 20, t: "foo"}
			meta: {source: "bar"}
		@ShareJsDB = SandboxedModule.require modulePath, requires:
			"./RedisManager": @RedisManager = {}
			"./DocOpsManager": @DocOpsManager = {}
			"./DocumentManager": {}

	describe "writing an op", ->
		beforeEach ->
			@version = 42
			@opData.v = @version
			@DocOpsManager.pushDocOp = sinon.stub().callsArgWith(3, null, @version+1)
			@ShareJsDB.writeOp @doc_key, @opData, @callback

		it "should write the op to redis", ->
			@DocOpsManager.pushDocOp
				.calledWith(@project_id, @doc_id, @opData)
				.should.equal true

		it "should call the callback without an error", ->
			@callback.called.should.equal true
			(@callback.args[0][0]?).should.equal false

	describe "writing an op at the wrong version", ->
		beforeEach ->
			@version = 42
			@mismatch = 5
			@opData.v = @version
			@DocOpsManager.pushDocOp = sinon.stub().callsArgWith(3, null, @version + @mismatch)
			@ShareJsDB.writeOp @doc_key, @opData, @callback

		it "should call the callback with an error", ->
			@callback.calledWith(new Error()).should.equal true


	

