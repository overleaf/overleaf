sinon = require('sinon')
chai = require('chai')
should = chai.should()
modulePath = "../../../../app/js/RealTimeRedisManager.js"
SandboxedModule = require('sandboxed-module')
Errors = require "../../../../app/js/Errors"

describe "RealTimeRedisManager", ->
	beforeEach ->
		@rclient =
			auth: () ->
			exec: sinon.stub()
		@rclient.multi = () => @rclient
		@pubsubClient =
			publish: sinon.stub()
		@RealTimeRedisManager = SandboxedModule.require modulePath, requires:
			"redis-sharelatex": createClient: (config) =>  if (config.name is 'pubsub') then @pubsubClient else @rclient
			"settings-sharelatex":
				redis:
					documentupdater: @settings =
						key_schema:
							pendingUpdates: ({doc_id}) -> "PendingUpdates:#{doc_id}"
					pubsub:
						name: "pubsub"
			"logger-sharelatex": { log: () -> }
			"crypto": @crypto = { randomBytes: sinon.stub().withArgs(4).returns(Buffer.from([0x1, 0x2, 0x3, 0x4])) }
			"os": @os = {hostname: sinon.stub().returns("somehost")}
			"./Metrics": @metrics = { summary: sinon.stub()}

		@doc_id = "doc-id-123"
		@project_id = "project-id-123"
		@callback = sinon.stub()

	describe "getPendingUpdatesForDoc", ->
		beforeEach ->
			@rclient.lrange = sinon.stub()
			@rclient.ltrim = sinon.stub()

		describe "successfully", ->
			beforeEach ->
				@updates = [
					{ op: [{ i: "foo", p: 4 }] }
					{ op: [{ i: "foo", p: 4 }] }
				]
				@jsonUpdates = @updates.map (update) -> JSON.stringify update
				@rclient.exec = sinon.stub().callsArgWith(0, null, [@jsonUpdates])
				@RealTimeRedisManager.getPendingUpdatesForDoc @doc_id, @callback

			it "should get the pending updates", ->
				@rclient.lrange
					.calledWith("PendingUpdates:#{@doc_id}", 0, 7)
					.should.equal true

			it "should delete the pending updates", ->
				@rclient.ltrim
					.calledWith("PendingUpdates:#{@doc_id}", 8, -1)
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
				@RealTimeRedisManager.getPendingUpdatesForDoc @doc_id, @callback

			it "should return an error to the callback", ->
				@callback.calledWith(new Error("JSON parse error")).should.equal true


	describe "getUpdatesLength", ->
		beforeEach ->
			@rclient.llen = sinon.stub().yields(null, @length = 3)
			@RealTimeRedisManager.getUpdatesLength @doc_id, @callback

		it "should look up the length", ->
			@rclient.llen.calledWith("PendingUpdates:#{@doc_id}").should.equal true

		it "should return the length", ->
			@callback.calledWith(null, @length).should.equal true

	describe "sendData", ->
		beforeEach ->
			@message_id = "doc:somehost:01020304-0"
			@RealTimeRedisManager.sendData({op: "thisop"})

		it "should send the op with a message id", ->
			@pubsubClient.publish.calledWith("applied-ops", JSON.stringify({op:"thisop",_id:@message_id})).should.equal true
