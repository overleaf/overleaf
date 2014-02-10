sinon = require('sinon')
chai = require('chai')
should = chai.should()
modulePath = "../../../../app/js/DocOpsManager.js"
SandboxedModule = require('sandboxed-module')

describe "DocOpsManager", ->
	beforeEach ->
		@doc_id = "doc-id"
		@project_id = "project-id"
		@callback = sinon.stub()
		@DocOpsManager = SandboxedModule.require modulePath, requires:
			"./RedisManager": @RedisManager = {}
			"logger-sharelatex": @logger = { log: sinon.stub(), error: sinon.stub() }

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
