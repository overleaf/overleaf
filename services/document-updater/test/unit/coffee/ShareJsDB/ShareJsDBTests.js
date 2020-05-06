sinon = require('sinon')
chai = require('chai')
should = chai.should()
expect = chai.expect
modulePath = "../../../../app/js/ShareJsDB.js"
SandboxedModule = require('sandboxed-module')
Errors = require "../../../../app/js/Errors"

describe "ShareJsDB", ->
	beforeEach ->
		@doc_id = "document-id"
		@project_id = "project-id"
		@doc_key = "#{@project_id}:#{@doc_id}"
		@callback = sinon.stub()
		@ShareJsDB = SandboxedModule.require modulePath, requires:
			"./RedisManager": @RedisManager = {}

		@version = 42
		@lines = ["one", "two", "three"]
		@db = new @ShareJsDB(@project_id, @doc_id, @lines, @version)

	describe "getSnapshot", ->
		describe "successfully", ->
			beforeEach ->
				@db.getSnapshot @doc_key, @callback

			it "should return the doc lines", ->
				@callback.args[0][1].snapshot.should.equal @lines.join("\n")

			it "should return the doc version", ->
				@callback.args[0][1].v.should.equal @version

			it "should return the type as text", ->
				@callback.args[0][1].type.should.equal "text"

		describe "when the key does not match", ->
			beforeEach ->
				@db.getSnapshot "bad:key", @callback

			it "should return the callback with a NotFoundError", ->
				@callback.calledWith(new Errors.NotFoundError("not found")).should.equal true

	describe "getOps", ->
		describe "with start == end", ->
			beforeEach ->
				@start = @end = 42
				@db.getOps @doc_key, @start, @end, @callback

			it "should return an empty array", ->
				@callback.calledWith(null, []).should.equal true
		
		describe "with a non empty range", ->
			beforeEach ->
				@start = 35
				@end = 42
				@RedisManager.getPreviousDocOps = sinon.stub().callsArgWith(3, null, @ops)
				@db.getOps @doc_key, @start, @end, @callback

			it "should get the range from redis", ->
				@RedisManager.getPreviousDocOps
					.calledWith(@doc_id, @start, @end-1)
					.should.equal true

			it "should return the ops", ->
				@callback.calledWith(null, @ops).should.equal true

		describe "with no specified end", ->
			beforeEach ->
				@start = 35
				@end = null
				@RedisManager.getPreviousDocOps = sinon.stub().callsArgWith(3, null, @ops)
				@db.getOps @doc_key, @start, @end, @callback
			
			it "should get until the end of the list", ->
				@RedisManager.getPreviousDocOps
					.calledWith(@doc_id, @start, -1)
					.should.equal true

	describe "writeOps", ->
		describe "writing an op", ->
			beforeEach ->
				@opData =
					op: {p: 20, t: "foo"}
					meta: {source: "bar"}
					v: @version
				@db.writeOp @doc_key, @opData, @callback

			it "should write into appliedOps", ->
				expect(@db.appliedOps[@doc_key]).to.deep.equal [@opData]

			it "should call the callback without an error", ->
				@callback.called.should.equal true
				(@callback.args[0][0]?).should.equal false
