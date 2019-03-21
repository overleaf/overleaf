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
			"logger-sharelatex": @logger = {error: sinon.stub()}
		@id_1 = "abc-1"
		@message_1 = "message-1"
		@id_2 = "abc-2"
		@message_2 = "message-2"

	afterEach ->
		tk.reset()

	describe 'checkEventOrder', ->

		it 'should accept events in order', ->
			@EventLogger.checkEventOrder(@id_1, @message_1)
			status = @EventLogger.checkEventOrder(@id_2, @message_2)
			expect(status).to.be.undefined

		it 'should return "duplicate" for the same event', ->
			@EventLogger.checkEventOrder(@id_1, @message_1)
			status = @EventLogger.checkEventOrder(@id_1, @message_1)
			expect(status).to.equal "duplicate"

		it 'should log an error for out of order events', ->
			@EventLogger.checkEventOrder(@id_1, @message_1)
			@EventLogger.checkEventOrder(@id_2, @message_2)
			status = @EventLogger.checkEventOrder(@id_1, @message_1)
			expect(status).to.be.undefined

		it 'should flush old entries', ->
			@EventLogger.MAX_EVENTS_BEFORE_CLEAN = 10
			@EventLogger.checkEventOrder(@id_1, @message_1)
			for i in [1..8]
				status = @EventLogger.checkEventOrder(@id_1, @message_1)
				expect(status).to.equal "duplicate"
			# the next event should flush the old entries aboce
			@EventLogger.MAX_STALE_TIME_IN_MS=1000
			tk.freeze(new Date(@start + 5 * 1000))
			# because we flushed the entries this should not be a duplicate
			@EventLogger.checkEventOrder('other-1', @message_2)
			status = @EventLogger.checkEventOrder(@id_1, @message_1)
			expect(status).to.be.undefined