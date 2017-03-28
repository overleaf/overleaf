require('coffee-script')
chai = require('chai')
should = chai.should()
expect = chai.expect
path = require('path')
modulePath = path.join __dirname, '../../../logging-manager.coffee'
SandboxedModule = require('sandboxed-module')
sinon = require("sinon")
tk = require("timekeeper")

describe 'logger.error', ->

	beforeEach ->
		@captureException = sinon.stub()
		@start = Date.now()
		tk.travel(new Date(@start))
		@LoggingManager = SandboxedModule.require modulePath, requires:
			'bunyan': {createLogger: sinon.stub().returns({error:sinon.stub()})}
			'raven': {Client: sinon.stub().returns({captureException:@captureException})}
		@logger = @LoggingManager.initialize("test")
		@logger.initializeErrorReporting("test_dsn")

	it 'should report a single error to sentry', () ->
		@logger.error {foo:'bar'}, "message"
		@captureException.called.should.equal true


	it 'for multiple errors should only report a maximum of 5 errors to sentry', () ->
		@logger.error {foo:'bar'}, "message"
		@logger.error {foo:'bar'}, "message"
		@logger.error {foo:'bar'}, "message"
		@logger.error {foo:'bar'}, "message"
		@logger.error {foo:'bar'}, "message"
		@logger.error {foo:'bar'}, "message"
		@logger.error {foo:'bar'}, "message"
		@logger.error {foo:'bar'}, "message"
		@logger.error {foo:'bar'}, "message"
		@captureException.callCount.should.equal 5

	it 'for multiple errors with a minute delay should report 10 errors to sentry', () ->
		# the first five errors should be reported to sentry
		@logger.error {foo:'bar'}, "message"
		@logger.error {foo:'bar'}, "message"
		@logger.error {foo:'bar'}, "message"
		@logger.error {foo:'bar'}, "message"
		@logger.error {foo:'bar'}, "message"
		# the following errors should not be reported
		@logger.error {foo:'bar'}, "message"
		@logger.error {foo:'bar'}, "message"
		@logger.error {foo:'bar'}, "message"
		@logger.error {foo:'bar'}, "message"
		# allow a minute to pass
		tk.travel(new Date(@start + 61*10000));
		# after a minute the next five errors should be reported to sentry
		@logger.error {foo:'bar'}, "message"
		@logger.error {foo:'bar'}, "message"
		@logger.error {foo:'bar'}, "message"
		@logger.error {foo:'bar'}, "message"
		@logger.error {foo:'bar'}, "message"
		# the following errors should not be reported to sentry
		@logger.error {foo:'bar'}, "message"
		@logger.error {foo:'bar'}, "message"
		@logger.error {foo:'bar'}, "message"
		@logger.error {foo:'bar'}, "message"
		@captureException.callCount.should.equal 10
