SandboxedModule = require("sandboxed-module")
chai = require("chai")
path = require("path")
sinon = require("sinon")
sinonChai = require("sinon-chai")

chai.use(sinonChai)
chai.should()

modulePath = path.join __dirname, '../../../logging-manager.coffee'

describe 'LoggingManager', ->

	beforeEach ->
		@start = Date.now()
		@clock = sinon.useFakeTimers(@start)
		@captureException = sinon.stub()
		@mockBunyanLogger =
			debug: sinon.stub()
			error: sinon.stub()
			fatal: sinon.stub()
			info: sinon.stub()
			level: sinon.stub()
			warn: sinon.stub()
		@mockRavenClient =
			captureException: @captureException
			once: sinon.stub().yields()
		@LoggingManager = SandboxedModule.require modulePath, requires:
			bunyan: @Bunyan = createLogger: sinon.stub().returns(@mockBunyanLogger)
			raven:  @Raven = Client: sinon.stub().returns(@mockRavenClient)
			request: @Request = sinon.stub()
		@loggerName = "test"
		@logger = @LoggingManager.initialize(@loggerName)
		@logger.initializeErrorReporting("test_dsn")

	afterEach ->
		@clock.restore()

	describe 'initialize', ->
		beforeEach ->
			@LoggingManager.checkLogLevel = sinon.stub()
			@Bunyan.createLogger.reset()

		describe "not in production", ->
			beforeEach ->
				@LoggingManager.initialize()

			it 'should default to log level debug', ->
				@Bunyan.createLogger.should.have.been.calledWithMatch level: "debug"

			it 'should not run checkLogLevel', ->
				@LoggingManager.checkLogLevel.should.not.have.been.called

		describe "in production", ->
			beforeEach ->
				process.env.NODE_ENV = 'production'
				@LoggingManager.initialize()

			afterEach ->
				delete process.env.NODE_ENV

			it 'should default to log level warn', ->
				@Bunyan.createLogger.should.have.been.calledWithMatch level: "warn"

			it 'should run checkLogLevel', ->
				@LoggingManager.checkLogLevel.should.have.been.calledOnce

			describe 'after 1 minute', ->
				it 'should run checkLogLevel again', ->
					@clock.tick(61*1000)
					@LoggingManager.checkLogLevel.should.have.been.calledTwice

			describe 'after 2 minutes', ->
				it 'should run checkLogLevel again', ->
					@clock.tick(121*1000)
					@LoggingManager.checkLogLevel.should.have.been.calledThrice

		describe "when LOG_LEVEL set in env", ->
			beforeEach ->
				process.env.LOG_LEVEL = "trace"
				@LoggingManager.initialize()

			afterEach ->
				delete process.env.LOG_LEVEL

			it "should use custom log level", ->
				@Bunyan.createLogger.should.have.been.calledWithMatch level: "trace"

	describe 'bunyan logging', ->
		beforeEach ->
			@logArgs = [ foo: "bar", "foo", "bar" ]

		it 'should log debug', ->
			@logger.debug @logArgs
			@mockBunyanLogger.debug.should.have.been.calledWith @logArgs

		it 'should log error', ->
			@logger.error @logArgs
			@mockBunyanLogger.error.should.have.been.calledWith @logArgs

		it 'should log fatal', ->
			@logger.fatal @logArgs
			@mockBunyanLogger.fatal.should.have.been.calledWith @logArgs

		it 'should log info', ->
			@logger.info @logArgs
			@mockBunyanLogger.info.should.have.been.calledWith @logArgs

		it 'should log warn', ->
			@logger.warn @logArgs
			@mockBunyanLogger.warn.should.have.been.calledWith @logArgs

		it 'should log err', ->
			@logger.err @logArgs
			@mockBunyanLogger.error.should.have.been.calledWith @logArgs

		it 'should log log', ->
			@logger.log @logArgs
			@mockBunyanLogger.info.should.have.been.calledWith @logArgs

	describe 'logger.error', ->
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

		it 'should remove the path from fs errors', () ->
			fsError = new Error("Error: ENOENT: no such file or directory, stat '/tmp/3279b8d0-da10-11e8-8255-efd98985942b'")
			fsError.path = "/tmp/3279b8d0-da10-11e8-8255-efd98985942b"
			@logger.error {err: fsError}, "message"
			@captureException.calledWith(sinon.match.has('message', 'Error: ENOENT: no such file or directory, stat')).should.equal true

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
			@clock.tick(@start+ 61*1000)
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

	describe 'checkLogLevel', ->
		it 'should request log level override from google meta data service', ->
			@LoggingManager.checkLogLevel()
			options =
				headers:
					"Metadata-Flavor": "Google"
				uri: "http://metadata.google.internal/computeMetadata/v1/project/attributes/#{@loggerName}-setLogLevelEndTime"
			@Request.should.have.been.calledWithMatch options

		describe 'when request has error', ->
			beforeEach ->
				@Request.yields "error"
				@LoggingManager.checkLogLevel()

			it "should only set default level", ->
				@mockBunyanLogger.level.should.have.been.calledOnce.and.calledWith('debug')

		describe 'when statusCode is not 200', ->
			beforeEach ->
				@Request.yields null, statusCode: 404
				@LoggingManager.checkLogLevel()

			it "should only set default level", ->
				@mockBunyanLogger.level.should.have.been.calledOnce.and.calledWith('debug')

		describe 'when time value returned that is less than current time', ->
			beforeEach ->
				@Request.yields null, statusCode: 200, '1'
				@LoggingManager.checkLogLevel()

			it "should only set default level", ->
				@mockBunyanLogger.level.should.have.been.calledOnce.and.calledWith('debug')

		describe 'when time value returned that is less than current time', ->
			describe 'when level is already set', ->
				beforeEach ->
					@mockBunyanLogger.level.returns(10)
					@Request.yields null, statusCode: 200, @start + 1000
					@LoggingManager.checkLogLevel()

				it "should set trace level", ->
					@mockBunyanLogger.level.should.have.been.calledOnce.and.calledWith('trace')

			describe 'when level is not already set', ->
				beforeEach ->
					@mockBunyanLogger.level.returns(20)
					@Request.yields null, statusCode: 200, @start + 1000
					@LoggingManager.checkLogLevel()

				it "should set trace level", ->
					@mockBunyanLogger.level.should.have.been.calledOnce.and.calledWith('trace')
