require('chai').should()
expect = require("chai").expect
SandboxedModule = require('sandboxed-module')
modulePath = '../../../app/js/EventLogger'
sinon = require("sinon")
tk = require "timekeeper"

describe 'EventLogger', ->
	beforeEach ->
		@start = Date.now()
		tk.freeze(new Date(@start))
		@EventLogger = SandboxedModule.require modulePath, requires:
			"logger-sharelatex": @logger = {error: sinon.stub(), warn: sinon.stub()}
			"metrics-sharelatex": @metrics = {inc: sinon.stub()}
		@channel = "applied-ops"
		@id_1 = "random-hostname:abc-1"
		@message_1 = "message-1"
		@id_2 = "random-hostname:abc-2"
		@message_2 = "message-2"

	afterEach ->
		tk.reset()

	describe 'checkEventOrder', ->

		describe 'when the events are in order', ->
			beforeEach ->
				@EventLogger.checkEventOrder(@channel, @id_1, @message_1)
				@status = @EventLogger.checkEventOrder(@channel, @id_2, @message_2)

			it 'should accept events in order', ->
				expect(@status).to.be.undefined

			it 'should increment the valid event metric', ->
				@metrics.inc.calledWith("event.#{@channel}.valid", 1)
					.should.equal.true

		describe 'when there is a duplicate events', ->
			beforeEach ->
				@EventLogger.checkEventOrder(@channel, @id_1, @message_1)
				@status = @EventLogger.checkEventOrder(@channel, @id_1, @message_1)

			it 'should return "duplicate" for the same event', ->
				expect(@status).to.equal "duplicate"

			it 'should increment the duplicate event metric', ->
				@metrics.inc.calledWith("event.#{@channel}.duplicate", 1)
					.should.equal.true

		describe 'when there are out of order events', ->
			beforeEach ->
				@EventLogger.checkEventOrder(@channel, @id_1, @message_1)
				@EventLogger.checkEventOrder(@channel, @id_2, @message_2)
				@status = @EventLogger.checkEventOrder(@channel, @id_1, @message_1)

			it 'should return "out-of-order" for the event', ->
				expect(@status).to.equal "out-of-order"

			it 'should increment the out-of-order event metric', ->
				@metrics.inc.calledWith("event.#{@channel}.out-of-order", 1)
					.should.equal.true

		describe 'after MAX_STALE_TIME_IN_MS', ->
			it 'should flush old entries', ->
				@EventLogger.MAX_EVENTS_BEFORE_CLEAN = 10
				@EventLogger.checkEventOrder(@channel, @id_1, @message_1)
				for i in [1..8]
					status = @EventLogger.checkEventOrder(@channel, @id_1, @message_1)
					expect(status).to.equal "duplicate"
				# the next event should flush the old entries aboce
				@EventLogger.MAX_STALE_TIME_IN_MS=1000
				tk.freeze(new Date(@start + 5 * 1000))
				# because we flushed the entries this should not be a duplicate
				@EventLogger.checkEventOrder(@channel, 'other-1', @message_2)
				status = @EventLogger.checkEventOrder(@channel, @id_1, @message_1)
				expect(status).to.be.undefined