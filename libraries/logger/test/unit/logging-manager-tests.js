const SandboxedModule = require('sandboxed-module')
const bunyan = require('bunyan')
const { expect } = require('chai')
const path = require('node:path')
const sinon = require('sinon')

const MODULE_PATH = path.join(__dirname, '../../logging-manager.js')

describe('LoggingManager', function () {
  beforeEach(function () {
    this.start = Date.now()
    this.bunyanLogger = {
      addStream: sinon.stub(),
      debug: sinon.stub(),
      error: sinon.stub(),
      fatal: sinon.stub(),
      info: sinon.stub(),
      level: sinon.stub(),
      warn: sinon.stub(),
    }
    this.Bunyan = {
      createLogger: sinon.stub().returns(this.bunyanLogger),
      RingBuffer: bunyan.RingBuffer,
    }
    this.stackdriverStreamConfig = { stream: 'stackdriver' }
    this.stackdriverClient = {
      stream: sinon.stub().returns(this.stackdriverStreamConfig),
    }
    this.GCPLogging = {
      LoggingBunyan: sinon.stub().returns(this.stackdriverClient),
    }
    this.FileLogLevelChecker = {
      start: sinon.stub(),
      stop: sinon.stub(),
    }
    this.GCEMetadataLogLevelChecker = {
      start: sinon.stub(),
      stop: sinon.stub(),
    }
    this.LogLevelChecker = {
      FileLogLevelChecker: sinon.stub().returns(this.FileLogLevelChecker),
      GCEMetadataLogLevelChecker: sinon
        .stub()
        .returns(this.GCEMetadataLogLevelChecker),
    }
    this.LoggingManager = SandboxedModule.require(MODULE_PATH, {
      requires: {
        bunyan: this.Bunyan,
        './log-level-checker': this.LogLevelChecker,
      },
    })
    this.loggerName = 'test'
    this.logger = this.LoggingManager.initialize(this.loggerName)
  })

  afterEach(function () {
    this.LoggingManager.removeWarningHandler()
  })

  describe('initialize', function () {
    beforeEach(function () {
      this.Bunyan.createLogger.reset()
    })

    describe('not in production', function () {
      beforeEach(function () {
        this.logger = this.LoggingManager.initialize(this.loggerName)
      })

      it('should default to log level debug', function () {
        this.Bunyan.createLogger.firstCall.args[0].streams[0].level.should.equal(
          'debug'
        )
      })

      it('should not instantiate a log level checker', function () {
        expect(this.LoggingManager.logLevelChecker).not.to.exist
      })
    })

    describe('in production', function () {
      beforeEach(function () {
        process.env.NODE_ENV = 'production'
        this.logger = this.LoggingManager.initialize(this.loggerName)
      })

      afterEach(function () {
        delete process.env.NODE_ENV
      })

      it('should default to log level info', function () {
        this.Bunyan.createLogger.firstCall.args[0].streams[0].level.should.equal(
          'info'
        )
      })

      it('should set up a file log level checker', function () {
        expect(this.logger.logLevelChecker).to.equal(this.FileLogLevelChecker)
        expect(this.FileLogLevelChecker.start).to.have.been.called
      })
    })

    describe('when LOG_LEVEL set in env', function () {
      beforeEach(function () {
        process.env.LOG_LEVEL = 'trace'
        this.LoggingManager.initialize()
      })

      afterEach(function () {
        delete process.env.LOG_LEVEL
      })

      it('should use custom log level', function () {
        this.Bunyan.createLogger.firstCall.args[0].streams[0].level.should.equal(
          'trace'
        )
      })
    })
  })

  describe('bunyan logging', function () {
    beforeEach(function () {
      this.logArgs = [{ foo: 'bar' }, 'foo', 'bar']
    })

    it('should log debug', function () {
      this.logger.debug(this.logArgs)
      this.bunyanLogger.debug.should.have.been.calledWith(this.logArgs)
    })

    it('should log error', function () {
      this.logger.error(this.logArgs)
      this.bunyanLogger.error.should.have.been.calledWith(this.logArgs)
    })

    it('should log fatal', function () {
      this.logger.fatal(this.logArgs)
      this.bunyanLogger.fatal.should.have.been.calledWith(this.logArgs)
    })

    it('should log info', function () {
      this.logger.info(this.logArgs)
      this.bunyanLogger.info.should.have.been.calledWith(this.logArgs)
    })

    it('should log warn', function () {
      this.logger.warn(this.logArgs)
      this.bunyanLogger.warn.should.have.been.calledWith(this.logArgs)
    })

    it('should log err', function () {
      this.logger.err(this.logArgs)
      this.bunyanLogger.error.should.have.been.calledWith(this.logArgs)
    })
  })

  describe('ringbuffer', function () {
    beforeEach(function () {
      this.logBufferMock = [
        { msg: 'log 1' },
        { msg: 'log 2' },
        { level: 50, msg: 'error' },
      ]
    })

    describe('when ring buffer size is positive', function () {
      beforeEach(function () {
        process.env.LOG_RING_BUFFER_SIZE = '20'
        this.logger = this.LoggingManager.initialize(this.loggerName)
        this.logger.ringBuffer.records = this.logBufferMock
        this.logger.error({}, 'error')
      })

      afterEach(function () {
        process.env.LOG_RING_BUFFER_SIZE = undefined
      })

      it('should include buffered logs in error log and filter out error logs in buffer', function () {
        this.bunyanLogger.error.lastCall.args[0].logBuffer.should.deep.equal([
          { msg: 'log 1' },
          { msg: 'log 2' },
        ])
      })
    })

    describe('when ring buffer size is zero', function () {
      beforeEach(function () {
        process.env.LOG_RING_BUFFER_SIZE = '0'
        this.logger = this.LoggingManager.initialize(this.loggerName)
        this.logger.error({}, 'error')
      })

      afterEach(function () {
        process.env.LOG_RING_BUFFER_SIZE = undefined
      })

      it('should not include buffered logs in error log', function () {
        expect(this.bunyanLogger.error.lastCall.args[0].logBuffer).be.undefined
      })
    })
  })
})
