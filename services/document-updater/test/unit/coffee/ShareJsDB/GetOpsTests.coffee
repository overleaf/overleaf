sinon = require('sinon')
chai = require('chai')
should = chai.should()
modulePath = "../../../../app/js/ShareJsDB.js"
SandboxedModule = require('sandboxed-module')

describe "ShareJsDB.getOps", ->
	beforeEach ->
		@doc_id = "document-id"
		@project_id = "project-id"
		@doc_key = "#{@project_id}:#{@doc_id}"
		@callback = sinon.stub()
		@ops = [{p: 20, t: "foo"}]
		@redis_ops = (JSON.stringify(op) for op in @ops)
		@ShareJsDB = SandboxedModule.require modulePath, requires:
			"./RedisManager": @RedisManager = {}
			"./DocumentManager":{}
			"logger-sharelatex": {}
		@db = new @ShareJsDB()

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

