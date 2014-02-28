sinon = require('sinon')
chai = require('chai')
should = chai.should()
modulePath = "../../../../app/js/RedisManager.js"
SandboxedModule = require('sandboxed-module')

describe "RedisManager.getHistoryLoadManagerThreshold", ->
	beforeEach ->
		@RedisManager = SandboxedModule.require modulePath, requires:
			"redis": createClient: () =>
				@rclient =
					auth: () ->
			"logger-sharelatex": @logger = {log: sinon.stub()}
		@callback = sinon.stub()

	describe "with no value", ->
		beforeEach ->
			@rclient.get = sinon.stub().callsArgWith(1, null, null)
			@RedisManager.getHistoryLoadManagerThreshold @callback
		
		it "should get the value", ->
			@rclient.get
				.calledWith("HistoryLoadManagerThreshold")
				.should.equal true

		it "should call the callback with 0", ->
			@callback.calledWith(null, 0).should.equal true

	describe "with a value", ->
		beforeEach ->
			@rclient.get = sinon.stub().callsArgWith(1, null, "42")
			@RedisManager.getHistoryLoadManagerThreshold @callback
		
		it "should get the value", ->
			@rclient.get
				.calledWith("HistoryLoadManagerThreshold")
				.should.equal true

		it "should call the callback with the numeric value", ->
			@callback.calledWith(null, 42).should.equal true



