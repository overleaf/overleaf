chai = require('chai')
should = chai.should()
expect = chai.expect
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

	describe "subscribe", ->

		describe "when there is no existing subscription for this redis client", ->
			beforeEach (done) ->
				@rclient.subscribe = sinon.stub().resolves()
				@ChannelManager.subscribe @rclient, "applied-ops", "1234567890abcdef"
				setTimeout done

			it "should subscribe to the redis channel", ->
				@rclient.subscribe.calledWithExactly("applied-ops:1234567890abcdef").should.equal true

		describe "when there is an existing subscription for this redis client", ->
			beforeEach (done) ->
				@rclient.subscribe = sinon.stub().resolves()
				@ChannelManager.subscribe @rclient, "applied-ops", "1234567890abcdef"
				@ChannelManager.subscribe @rclient, "applied-ops", "1234567890abcdef"
				setTimeout done

			it "should subscribe to the redis channel again", ->
				@rclient.subscribe.callCount.should.equal 2

		describe "when subscribe errors", ->
			beforeEach (done) ->
				@rclient.subscribe = sinon.stub()
					.onFirstCall().rejects(new Error("some redis error"))
					.onSecondCall().resolves()
				p = @ChannelManager.subscribe @rclient, "applied-ops", "1234567890abcdef"
				p.then () ->
					done(new Error('should not subscribe but fail'))
				.catch (err) =>
					err.message.should.equal "some redis error"
					@ChannelManager.getClientMapEntry(@rclient).has("applied-ops:1234567890abcdef").should.equal false
					@ChannelManager.subscribe @rclient, "applied-ops", "1234567890abcdef"
					# subscribe is wrapped in Promise, delay other assertions
					setTimeout done
				return null

			it "should have recorded the error", ->
				expect(@metrics.inc.calledWithExactly("subscribe.failed.applied-ops")).to.equal(true)

			it "should subscribe again", ->
				@rclient.subscribe.callCount.should.equal 2

			it "should cleanup", ->
				@ChannelManager.getClientMapEntry(@rclient).has("applied-ops:1234567890abcdef").should.equal false

		describe "when subscribe errors and the clientChannelMap entry was replaced", ->
			beforeEach (done) ->
				@rclient.subscribe = sinon.stub()
					.onFirstCall().rejects(new Error("some redis error"))
					.onSecondCall().resolves()
				@first = @ChannelManager.subscribe @rclient, "applied-ops", "1234567890abcdef"
				# ignore error
				@first.catch((()->))
				expect(@ChannelManager.getClientMapEntry(@rclient).get("applied-ops:1234567890abcdef")).to.equal @first

				@rclient.unsubscribe = sinon.stub().resolves()
				@ChannelManager.unsubscribe @rclient, "applied-ops", "1234567890abcdef"
				@second = @ChannelManager.subscribe @rclient, "applied-ops", "1234567890abcdef"
				# should get replaced immediately
				expect(@ChannelManager.getClientMapEntry(@rclient).get("applied-ops:1234567890abcdef")).to.equal @second

				# let the first subscribe error -> unsubscribe -> subscribe
				setTimeout done

			it "should cleanup the second subscribePromise", ->
				expect(@ChannelManager.getClientMapEntry(@rclient).has("applied-ops:1234567890abcdef")).to.equal false

		describe "when there is an existing subscription for another redis client but not this one", ->
			beforeEach (done) ->
				@other_rclient.subscribe = sinon.stub().resolves()
				@ChannelManager.subscribe @other_rclient, "applied-ops", "1234567890abcdef"
				@rclient.subscribe = sinon.stub().resolves()  # discard the original stub
				@ChannelManager.subscribe @rclient, "applied-ops", "1234567890abcdef"
				setTimeout done

			it "should subscribe to the redis channel on this redis client", ->
				@rclient.subscribe.calledWithExactly("applied-ops:1234567890abcdef").should.equal true

	describe "unsubscribe", ->

		describe "when there is no existing subscription for this redis client", ->
			beforeEach (done) ->
				@rclient.unsubscribe = sinon.stub().resolves()
				@ChannelManager.unsubscribe @rclient, "applied-ops", "1234567890abcdef"
				setTimeout done

			it "should unsubscribe from the redis channel", ->
				@rclient.unsubscribe.called.should.equal true


		describe "when there is an existing subscription for this another redis client but not this one", ->
			beforeEach (done) ->
				@other_rclient.subscribe = sinon.stub().resolves()
				@rclient.unsubscribe = sinon.stub().resolves()
				@ChannelManager.subscribe @other_rclient, "applied-ops", "1234567890abcdef"
				@ChannelManager.unsubscribe @rclient, "applied-ops", "1234567890abcdef"
				setTimeout done

			it "should still unsubscribe from the redis channel on this client", ->
				@rclient.unsubscribe.called.should.equal true

		describe "when unsubscribe errors and completes", ->
			beforeEach (done) ->
				@rclient.subscribe = sinon.stub().resolves()
				@ChannelManager.subscribe @rclient, "applied-ops", "1234567890abcdef"
				@rclient.unsubscribe = sinon.stub().rejects(new Error("some redis error"))
				@ChannelManager.unsubscribe @rclient, "applied-ops", "1234567890abcdef"
				setTimeout done
				return null

			it "should have cleaned up", ->
				@ChannelManager.getClientMapEntry(@rclient).has("applied-ops:1234567890abcdef").should.equal false

			it "should not error out when subscribing again", (done) ->
				p = @ChannelManager.subscribe @rclient, "applied-ops", "1234567890abcdef"
				p.then () ->
					done()
				.catch done
				return null

		describe "when unsubscribe errors and another client subscribes at the same time", ->
			beforeEach (done) ->
				@rclient.subscribe = sinon.stub().resolves()
				@ChannelManager.subscribe @rclient, "applied-ops", "1234567890abcdef"
				rejectSubscribe = undefined
				@rclient.unsubscribe = () ->
					return new Promise (resolve, reject) ->
						rejectSubscribe = reject
				@ChannelManager.unsubscribe @rclient, "applied-ops", "1234567890abcdef"

				setTimeout () =>
					# delay, actualUnsubscribe should not see the new subscribe request
					@ChannelManager.subscribe(@rclient, "applied-ops", "1234567890abcdef")
					.then () ->
						setTimeout done
					.catch done
					setTimeout ->
						# delay, rejectSubscribe is not defined immediately
						rejectSubscribe(new Error("redis error"))
				return null

			it "should have recorded the error", ->
				expect(@metrics.inc.calledWithExactly("unsubscribe.failed.applied-ops")).to.equal(true)

			it "should have subscribed", ->
				@rclient.subscribe.called.should.equal true

			it "should have discarded the finished Promise", ->
				@ChannelManager.getClientMapEntry(@rclient).has("applied-ops:1234567890abcdef").should.equal false

		describe "when there is an existing subscription for this redis client", ->
			beforeEach (done) ->
				@rclient.subscribe = sinon.stub().resolves()
				@rclient.unsubscribe = sinon.stub().resolves()
				@ChannelManager.subscribe @rclient, "applied-ops", "1234567890abcdef"
				@ChannelManager.unsubscribe @rclient, "applied-ops", "1234567890abcdef"
				setTimeout done

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
