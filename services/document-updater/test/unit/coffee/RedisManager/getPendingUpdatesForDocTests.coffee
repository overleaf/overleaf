sinon = require('sinon')
chai = require('chai')
should = chai.should()
modulePath = "../../../../app/js/RedisManager.js"
SandboxedModule = require('sandboxed-module')

describe "RedisManager.getPendingUpdatesForDoc", ->
	beforeEach ->
		@RedisManager = SandboxedModule.require modulePath, requires:
			"./ZipManager": {}
			"redis-sharelatex": createClient: () =>
				@rclient =
					auth: () ->
					multi: () => @rclient
			"logger-sharelatex": @logger = {log: sinon.stub()}
		@project_id = "project-id-123"
		@doc_id = "doc-id-123"
		@callback = sinon.stub()
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
			@RedisManager.getPendingUpdatesForDoc @doc_id, @callback
		
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
			@RedisManager.getPendingUpdatesForDoc @doc_id, @callback

		it "should return an error to the callback", ->
			@callback.calledWith(new Error("JSON parse error")).should.equal true


