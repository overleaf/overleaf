# run this with 
# ./node_modules/.bin/mocha --reporter tap --compilers coffee:coffee-script/register test/unit/coffee/loggingManagerTests.coffee

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

	it 'should report the same error to sentry only once', () ->
		error1 = new Error('this is the error')
		@logger.error {foo: error1}, "first message"
		@logger.error {bar: error1}, "second message"
		@captureException.callCount.should.equal 1

	it 'should report two different errors to sentry individually', () ->
		error1 = new Error('this is the error')
		error2 = new Error('this is the error')
		@logger.error {foo: error1}, "first message"
		@logger.error {bar: error2}, "second message"
		@captureException.callCount.should.equal 2

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
