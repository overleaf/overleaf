sinon = require('sinon')
chai = require('chai')
should = chai.should()
modulePath = "../../../../app/js/DocOpsManager.js"
SandboxedModule = require('sandboxed-module')
{ObjectId} = require "mongojs"

describe "DocOpsManager", ->
	beforeEach ->
		@doc_id = ObjectId().toString()
		@project_id = ObjectId().toString()
		@callback = sinon.stub()
		@DocOpsManager = SandboxedModule.require modulePath, requires:
			"./RedisManager": @RedisManager = {}
			"./TrackChangesManager": @TrackChangesManager = {}

	describe "getPreviousDocOps", ->
		beforeEach ->
			@ops = [ "mock-op-1", "mock-op-2" ]
			@start = 30
			@end = 32
			@RedisManager.getPreviousDocOps = sinon.stub().callsArgWith(3, null, @ops)
			@DocOpsManager.getPreviousDocOps @project_id, @doc_id, @start, @end, @callback

		it "should get the previous doc ops", ->
			@RedisManager.getPreviousDocOps
				.calledWith(@doc_id, @start, @end)
				.should.equal true

		it "should call the callback with the ops", ->
			@callback.calledWith(null, @ops).should.equal true

	describe "pushDocOp", ->
		beforeEach ->
			@op = "mock-op"
			@RedisManager.pushDocOp = sinon.stub().callsArgWith(2, null, @version = 42)
			@TrackChangesManager.pushUncompressedHistoryOp = sinon.stub().callsArg(3)
			@DocOpsManager.pushDocOp @project_id, @doc_id, @op, @callback

		it "should push the op in to the docOps list", ->
			@RedisManager.pushDocOp
				.calledWith(@doc_id, @op)
				.should.equal true

		it "should push the op into the pushUncompressedHistoryOp", ->
			@TrackChangesManager.pushUncompressedHistoryOp
				.calledWith(@project_id, @doc_id, @op)
				.should.equal true

		it "should call the callback with the version", ->
			@callback.calledWith(null, @version).should.equal true

