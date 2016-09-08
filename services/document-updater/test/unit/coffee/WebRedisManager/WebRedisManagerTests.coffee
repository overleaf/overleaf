sinon = require('sinon')
chai = require('chai')
should = chai.should()
modulePath = "../../../../app/js/WebRedisManager.js"
SandboxedModule = require('sandboxed-module')
Errors = require "../../../../app/js/Errors"

describe "WebRedisManager", ->
	beforeEach ->
		@rclient =
			auth: () ->
			exec: sinon.stub()
		@rclient.multi = () => @rclient
		@WebRedisManager = SandboxedModule.require modulePath, requires:
			"redis-sharelatex": createClient: () => @rclient
			"settings-sharelatex": redis: web: @settings = {"mock": "settings"}
		@doc_id = "doc-id-123"
		@project_id = "project-id-123"
		@callback = sinon.stub()
	
	describe "getPendingUpdatesForDoc", ->
		beforeEach ->
			@rclient.lrange = sinon.stub()
			@rclient.del = sinon.stub()

		describe "successfully", ->
			beforeEach ->
				@updates = [
					{ op: [{ i: "foo", p: 4 }] }
					{ op: [{ i: "foo", p: 4 }] }
				]
				@jsonUpdates = @updates.map (update) -> JSON.stringify update
				@rclient.exec = sinon.stub().callsArgWith(0, null, [@jsonUpdates])
				@WebRedisManager.getPendingUpdatesForDoc @doc_id, @callback
			
			it "should get the pending updates", ->
				@rclient.lrange
					.calledWith("PendingUpdates:#{@doc_id}", 0, -1)
					.should.equal true

			it "should delete the pending updates", ->
				@rclient.del
					.calledWith("PendingUpdates:#{@doc_id}")
					.should.equal true

			it "should call the callback with the updates", ->
				@callback.calledWith(null, @updates).should.equal true

		describe "when the JSON doesn't parse", ->
			beforeEach ->
				@jsonUpdates = [
					JSON.stringify { op: [{ i: "foo", p: 4 }] }
					"broken json"
				]
				@rclient.exec = sinon.stub().callsArgWith(0, null, [@jsonUpdates])
				@WebRedisManager.getPendingUpdatesForDoc @doc_id, @callback

			it "should return an error to the callback", ->
				@callback.calledWith(new Error("JSON parse error")).should.equal true


	describe "getUpdatesLength", ->
		beforeEach ->
			@rclient.llen = sinon.stub().yields(null, @length = 3)
			@WebRedisManager.getUpdatesLength @doc_id, @callback
		
		it "should look up the length", ->
			@rclient.llen.calledWith("PendingUpdates:#{@doc_id}").should.equal true
		
		it "should return the length", ->
			@callback.calledWith(null, @length).should.equal true

	describe "pushUncompressedHistoryOps", ->
		beforeEach ->
			@ops = [{ op: [{ i: "foo", p: 4 }] },{ op: [{ i: "bar", p: 56 }] }]
			@rclient.rpush = sinon.stub().yields(null, @length = 42)
			@rclient.sadd = sinon.stub().yields()
		
		describe "with ops", ->
			beforeEach (done) ->
				@WebRedisManager.pushUncompressedHistoryOps @project_id, @doc_id, @ops, (args...) =>
					@callback(args...)
					done()
			
			it "should push the doc op into the doc ops list as JSON", ->
				@rclient.rpush
					.calledWith("UncompressedHistoryOps:#{@doc_id}", JSON.stringify(@ops[0]), JSON.stringify(@ops[1]))
					.should.equal true

			it "should add the doc_id to the set of which records the project docs", ->
				@rclient.sadd
					.calledWith("DocsWithHistoryOps:#{@project_id}", @doc_id)
					.should.equal true

			it "should call the callback with the length", ->
				@callback.calledWith(null, @length).should.equal true
		
		describe "with no ops", ->
			beforeEach (done) ->
				@WebRedisManager.pushUncompressedHistoryOps @project_id, @doc_id, [], (args...) =>
					@callback(args...)
					done()
			
			it "should not push the doc op into the doc ops list as JSON", ->
				@rclient.rpush
					.called
					.should.equal false

			it "should not add the doc_id to the set of which records the project docs", ->
				@rclient.sadd
					.called
					.should.equal false

			it "should call the callback with the length", ->
				@callback.calledWith(null, 0).should.equal true
