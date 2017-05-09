sinon = require('sinon')
chai = require('chai')
should = chai.should()
modulePath = "../../../../app/js/HistoryRedisManager.js"
SandboxedModule = require('sandboxed-module')
Errors = require "../../../../app/js/Errors"

describe "HistoryRedisManager", ->
	beforeEach ->
		@rclient =
			auth: () ->
			exec: sinon.stub()
		@rclient.multi = () => @rclient
		@HistoryRedisManager = SandboxedModule.require modulePath, requires:
			"redis-sharelatex": createClient: () => @rclient
			"settings-sharelatex":
				redis:
					history: @settings =
						key_schema:
							uncompressedHistoryOps: ({doc_id}) -> "UncompressedHistoryOps:#{doc_id}"
							docsWithHistoryOps: ({project_id}) -> "DocsWithHistoryOps:#{project_id}"
			"logger-sharelatex": { log: () -> }
		@doc_id = "doc-id-123"
		@project_id = "project-id-123"
		@callback = sinon.stub()

	describe "recordDocHasHistoryOps", ->
		beforeEach ->
			@ops = [{ op: [{ i: "foo", p: 4 }] },{ op: [{ i: "bar", p: 56 }] }]
			@rclient.sadd = sinon.stub().yields()
		
		describe "with ops", ->
			beforeEach (done) ->
				@HistoryRedisManager.recordDocHasHistoryOps @project_id, @doc_id, @ops, (args...) =>
					@callback(args...)
					done()
			
			it "should add the doc_id to the set of which records the project docs", ->
				@rclient.sadd
					.calledWith("DocsWithHistoryOps:#{@project_id}", @doc_id)
					.should.equal true

		describe "with no ops", ->
			beforeEach (done) ->
				@HistoryRedisManager.recordDocHasHistoryOps @project_id, @doc_id, [], (args...) =>
					@callback(args...)
					done()
			
			it "should not add the doc_id to the set of which records the project docs", ->
				@rclient.sadd
					.called
					.should.equal false

			it "should call the callback with an error", ->
				@callback.calledWith(new Error("cannot push no ops")).should.equal true
