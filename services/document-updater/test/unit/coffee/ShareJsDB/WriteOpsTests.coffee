sinon = require('sinon')
chai = require('chai')
expect = chai.expect
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
			"logger-sharelatex": @logger = {error: sinon.stub()}
		@db = new @ShareJsDB()

	describe "writing an op", ->
		beforeEach ->
			@version = 42
			@opData.v = @version
			@db.writeOp @doc_key, @opData, @callback

		it "should write into appliedOps", ->
			expect(@db.appliedOps[@doc_key]).to.deep.equal [@opData]

		it "should call the callback without an error", ->
			@callback.called.should.equal true
			(@callback.args[0][0]?).should.equal false


	

