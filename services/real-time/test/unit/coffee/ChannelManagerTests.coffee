chai = require('chai')
should = chai.should()
sinon = require("sinon")
modulePath = "../../../app/js/ChannelManager.js"
SandboxedModule = require('sandboxed-module')

describe 'ChannelManager', ->
	beforeEach ->
		@rclient = {}
		@other_rclient = {}
		@ChannelManager = SandboxedModule.require modulePath, requires:
			"settings-sharelatex": @settings = {}
			"metrics-sharelatex": @metrics = {inc: sinon.stub(), summary: sinon.stub()}
			"logger-sharelatex": @logger = { log: sinon.stub(), warn: sinon.stub(), error: sinon.stub() }
	
	describe "subscribe", ->

		describe "when there is no existing subscription for this redis client", ->
			beforeEach ->
				@rclient.subscribe = sinon.stub()
				@ChannelManager.subscribe @rclient, "applied-ops", "1234567890abcdef"

			it "should subscribe to the redis channel", ->
				@rclient.subscribe.calledWithExactly("applied-ops:1234567890abcdef").should.equal true

		describe "when there is an existing subscription for this redis client", ->
			beforeEach ->
				@rclient.subscribe = sinon.stub()
				@ChannelManager.subscribe @rclient, "applied-ops", "1234567890abcdef"
				@rclient.subscribe = sinon.stub()  # discard the original stub
				@ChannelManager.subscribe @rclient, "applied-ops", "1234567890abcdef"

			it "should not subscribe to the redis channel", ->
				@rclient.subscribe.called.should.equal false

		describe "when there is an existing subscription for another redis client but not this one", ->
			beforeEach ->
				@other_rclient.subscribe = sinon.stub()
				@ChannelManager.subscribe @other_rclient, "applied-ops", "1234567890abcdef"
				@rclient.subscribe = sinon.stub()  # discard the original stub
				@ChannelManager.subscribe @rclient, "applied-ops", "1234567890abcdef"

			it "should subscribe to the redis channel on this redis client", ->
				@rclient.subscribe.calledWithExactly("applied-ops:1234567890abcdef").should.equal true

	describe "unsubscribe", ->

		describe "when there is no existing subscription for this redis client", ->
			beforeEach ->
				@rclient.unsubscribe = sinon.stub()
				@ChannelManager.unsubscribe @rclient, "applied-ops", "1234567890abcdef"

			it "should not unsubscribe from the redis channel", ->
				@rclient.unsubscribe.called.should.equal false


		describe "when there is an existing subscription for this another redis client but not this one", ->
			beforeEach ->
				@other_rclient.subscribe = sinon.stub()
				@rclient.unsubscribe = sinon.stub()  
				@ChannelManager.subscribe @other_rclient, "applied-ops", "1234567890abcdef"
				@ChannelManager.unsubscribe @rclient, "applied-ops", "1234567890abcdef"

			it "should not unsubscribe from the redis channel on this client", ->
				@rclient.unsubscribe.called.should.equal false

		describe "when there is an existing subscription for this redis client", ->
			beforeEach ->
				@rclient.subscribe = sinon.stub()
				@rclient.unsubscribe = sinon.stub()  
				@ChannelManager.subscribe @rclient, "applied-ops", "1234567890abcdef"
				@ChannelManager.unsubscribe @rclient, "applied-ops", "1234567890abcdef"

			it "should unsubscribe from the redis channel", ->
				@rclient.unsubscribe.calledWithExactly("applied-ops:1234567890abcdef").should.equal true

	describe "publish", ->

		describe "when the channel is 'all'", ->
			beforeEach ->
				@rclient.publish = sinon.stub()
				@ChannelManager.publish @rclient, "applied-ops", "all", "random-message"

			it "should publish on the base channel", ->
				@rclient.publish.calledWithExactly("applied-ops", "random-message").should.equal true

		describe "when the channel has an specific id", ->

			describe "when the individual channel setting is false", ->
				beforeEach ->
					@rclient.publish = sinon.stub()
					@settings.publishOnIndividualChannels = false
					@ChannelManager.publish @rclient, "applied-ops", "1234567890abcdef", "random-message"

				it "should publish on the per-id channel", ->
					@rclient.publish.calledWithExactly("applied-ops", "random-message").should.equal true
					@rclient.publish.calledOnce.should.equal true

			describe "when the individual channel setting is true", ->
				beforeEach ->
					@rclient.publish = sinon.stub()
					@settings.publishOnIndividualChannels = true
					@ChannelManager.publish @rclient, "applied-ops", "1234567890abcdef", "random-message"

				it "should publish on the per-id channel", ->
					@rclient.publish.calledWithExactly("applied-ops:1234567890abcdef", "random-message").should.equal true
					@rclient.publish.calledOnce.should.equal true

		describe "metrics", ->
			beforeEach ->
				@rclient.publish = sinon.stub()
				@ChannelManager.publish @rclient, "applied-ops", "all", "random-message"

			it "should track the payload size", ->
				@metrics.summary.calledWithExactly(
					"redis.publish.applied-ops",
					"random-message".length
				).should.equal true
