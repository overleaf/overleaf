/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const SandboxedModule = require("sandboxed-module");
const chai = require("chai");
const path = require("path");
const sinon = require("sinon");
const sinonChai = require("sinon-chai");

chai.use(sinonChai);
chai.should();

const modulePath = path.join(__dirname, '../../logging-manager.js');

describe('LoggingManager', function() {

	beforeEach(function() {
		this.start = Date.now();
		this.clock = sinon.useFakeTimers(this.start);
		this.captureException = sinon.stub();
		this.mockBunyanLogger = {
			debug: sinon.stub(),
			error: sinon.stub(),
			fatal: sinon.stub(),
			info: sinon.stub(),
			level: sinon.stub(),
			warn: sinon.stub()
		};
		this.mockRavenClient = {
			captureException: this.captureException,
			once: sinon.stub().yields()
		};
		this.LoggingManager = SandboxedModule.require(modulePath, {
			globals: { console },
			requires: {
				bunyan: (this.Bunyan = {createLogger: sinon.stub().returns(this.mockBunyanLogger)}),
				raven: (this.Raven = {Client: sinon.stub().returns(this.mockRavenClient)}),
				request: (this.Request = sinon.stub()),
			},
		});
		this.loggerName = "test";
		this.logger = this.LoggingManager.initialize(this.loggerName);
		this.logger.initializeErrorReporting("test_dsn");
	});

	afterEach(function() {
		this.clock.restore();
	});

	describe('initialize', function() {
		beforeEach(function() {
			this.checkLogLevelStub = sinon.stub(this.LoggingManager.prototype, "checkLogLevel");
			this.Bunyan.createLogger.reset();
		});

		afterEach(function () {
			this.checkLogLevelStub.restore()
		})

		describe("not in production", function() {
			beforeEach(function() {
				this.logger = this.LoggingManager.initialize(this.loggerName)
			});

			it('should default to log level debug', function() {
				this.Bunyan.createLogger.should.have.been.calledWithMatch({level: "debug"});
			});

			it('should not run checkLogLevel', function() {
				this.checkLogLevelStub.should.not.have.been.called;
			});
		});

		describe("in production", function() {
			beforeEach(function() {
				process.env.NODE_ENV = 'production';
				this.logger = this.LoggingManager.initialize(this.loggerName)
			});

			afterEach(() => delete process.env.NODE_ENV);

			it('should default to log level warn', function() {
				this.Bunyan.createLogger.should.have.been.calledWithMatch({level: "warn"});
			});

			it('should run checkLogLevel', function() {
				this.checkLogLevelStub.should.have.been.calledOnce;
			});

			describe('after 1 minute', () =>
				it('should run checkLogLevel again', function() {
					this.clock.tick(61*1000);
					this.checkLogLevelStub.should.have.been.calledTwice;
				})
			);

			describe('after 2 minutes', () =>
				it('should run checkLogLevel again', function() {
					this.clock.tick(121*1000);
					this.checkLogLevelStub.should.have.been.calledThrice;
				})
			);
		});

		describe("when LOG_LEVEL set in env", function() {
			beforeEach(function() {
				process.env.LOG_LEVEL = "trace";
				this.LoggingManager.initialize();
			});

			afterEach(() => delete process.env.LOG_LEVEL);

			it("should use custom log level", function() {
				this.Bunyan.createLogger.should.have.been.calledWithMatch({level: "trace"});
			});
		});
	});

	describe('bunyan logging', function() {
		beforeEach(function() {
			this.logArgs = [ {foo: "bar"}, "foo", "bar" ];});

		it('should log debug', function() {
			this.logger.debug(this.logArgs);
			this.mockBunyanLogger.debug.should.have.been.calledWith(this.logArgs);
		});

		it('should log error', function() {
			this.logger.error(this.logArgs);
			this.mockBunyanLogger.error.should.have.been.calledWith(this.logArgs);
		});

		it('should log fatal', function() {
			this.logger.fatal(this.logArgs);
			this.mockBunyanLogger.fatal.should.have.been.calledWith(this.logArgs);
		});

		it('should log info', function() {
			this.logger.info(this.logArgs);
			this.mockBunyanLogger.info.should.have.been.calledWith(this.logArgs);
		});

		it('should log warn', function() {
			this.logger.warn(this.logArgs);
			this.mockBunyanLogger.warn.should.have.been.calledWith(this.logArgs);
		});

		it('should log err', function() {
			this.logger.err(this.logArgs);
			this.mockBunyanLogger.error.should.have.been.calledWith(this.logArgs);
		});

		it('should log log', function() {
			this.logger.log(this.logArgs);
			this.mockBunyanLogger.info.should.have.been.calledWith(this.logArgs);
		});
	});

	describe('logger.error', function() {
		it('should report a single error to sentry', function() {
			this.logger.error({foo:'bar'}, "message");
			this.captureException.called.should.equal(true);
		});

		it('should report the same error to sentry only once', function() {
			const error1 = new Error('this is the error');
			this.logger.error({foo: error1}, "first message");
			this.logger.error({bar: error1}, "second message");
			this.captureException.callCount.should.equal(1);
		});

		it('should report two different errors to sentry individually', function() {
			const error1 = new Error('this is the error');
			const error2 = new Error('this is the error');
			this.logger.error({foo: error1}, "first message");
			this.logger.error({bar: error2}, "second message");
			this.captureException.callCount.should.equal(2);
		});

		it('should remove the path from fs errors', function() {
			const fsError = new Error("Error: ENOENT: no such file or directory, stat '/tmp/3279b8d0-da10-11e8-8255-efd98985942b'");
			fsError.path = "/tmp/3279b8d0-da10-11e8-8255-efd98985942b";
			this.logger.error({err: fsError}, "message");
			this.captureException.calledWith(sinon.match.has('message', 'Error: ENOENT: no such file or directory, stat')).should.equal(true);
		});

		it('for multiple errors should only report a maximum of 5 errors to sentry', function() {
			this.logger.error({foo:'bar'}, "message");
			this.logger.error({foo:'bar'}, "message");
			this.logger.error({foo:'bar'}, "message");
			this.logger.error({foo:'bar'}, "message");
			this.logger.error({foo:'bar'}, "message");
			this.logger.error({foo:'bar'}, "message");
			this.logger.error({foo:'bar'}, "message");
			this.logger.error({foo:'bar'}, "message");
			this.logger.error({foo:'bar'}, "message");
			this.captureException.callCount.should.equal(5);
		});

		it('for multiple errors with a minute delay should report 10 errors to sentry', function() {
			// the first five errors should be reported to sentry
			this.logger.error({foo:'bar'}, "message");
			this.logger.error({foo:'bar'}, "message");
			this.logger.error({foo:'bar'}, "message");
			this.logger.error({foo:'bar'}, "message");
			this.logger.error({foo:'bar'}, "message");
			// the following errors should not be reported
			this.logger.error({foo:'bar'}, "message");
			this.logger.error({foo:'bar'}, "message");
			this.logger.error({foo:'bar'}, "message");
			this.logger.error({foo:'bar'}, "message");
			// allow a minute to pass
			this.clock.tick(this.start+ (61*1000));
			// after a minute the next five errors should be reported to sentry
			this.logger.error({foo:'bar'}, "message");
			this.logger.error({foo:'bar'}, "message");
			this.logger.error({foo:'bar'}, "message");
			this.logger.error({foo:'bar'}, "message");
			this.logger.error({foo:'bar'}, "message");
			// the following errors should not be reported to sentry
			this.logger.error({foo:'bar'}, "message");
			this.logger.error({foo:'bar'}, "message");
			this.logger.error({foo:'bar'}, "message");
			this.logger.error({foo:'bar'}, "message");
			this.captureException.callCount.should.equal(10);
		});
	});

	describe('checkLogLevel', function() {
		it('should request log level override from google meta data service', function() {
			this.logger.checkLogLevel();
			const options = {
				headers: {
					"Metadata-Flavor": "Google"
				},
				uri: `http://metadata.google.internal/computeMetadata/v1/project/attributes/${this.loggerName}-setLogLevelEndTime`
			};
			this.Request.should.have.been.calledWithMatch(options);
		});

		describe('when request has error', function() {
			beforeEach(function() {
				this.Request.yields("error");
				this.logger.checkLogLevel();
			});

			it("should only set default level", function() {
				this.mockBunyanLogger.level.should.have.been.calledOnce.and.calledWith('debug');
			});
		});

		describe('when statusCode is not 200', function() {
			beforeEach(function() {
				this.Request.yields(null, {statusCode: 404});
				this.logger.checkLogLevel();
			});

			it("should only set default level", function() {
				this.mockBunyanLogger.level.should.have.been.calledOnce.and.calledWith('debug');
			});
		});

		describe('when time value returned that is less than current time', function() {
			beforeEach(function() {
				this.Request.yields(null, {statusCode: 200}, '1');
				this.logger.checkLogLevel();
			});

			it("should only set default level", function() {
				this.mockBunyanLogger.level.should.have.been.calledOnce.and.calledWith('debug');
			});
		});

		describe('when time value returned that is less than current time', function() {
			describe('when level is already set', function() {
				beforeEach(function() {
					this.mockBunyanLogger.level.returns(10);
					this.Request.yields(null, {statusCode: 200}, this.start + 1000);
					this.logger.checkLogLevel();
				});

				it("should set trace level", function() {
					this.mockBunyanLogger.level.should.have.been.calledOnce.and.calledWith('trace');
				});
			});

			describe('when level is not already set', function() {
				beforeEach(function() {
					this.mockBunyanLogger.level.returns(20);
					this.Request.yields(null, {statusCode: 200}, this.start + 1000);
					this.logger.checkLogLevel();
				});

				it("should set trace level", function() {
					this.mockBunyanLogger.level.should.have.been.calledOnce.and.calledWith('trace');
				});
			});
		});
	});
});
