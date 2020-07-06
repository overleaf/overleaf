const SandboxedModule = require('sandboxed-module')
const bunyan = require('bunyan')
const chai = require('chai')
const path = require('path')
const sinon = require('sinon')
const sinonChai = require('sinon-chai')

chai.use(sinonChai)
chai.should()
const expect = chai.expect

const modulePath = path.join(__dirname, '../../logging-manager.js')

describe('LoggingManager', function () {
  beforeEach(function () {
    this.start = Date.now()
    this.clock = sinon.useFakeTimers(this.start)
    this.captureException = sinon.stub()
    this.bunyanLogger = {
      addStream: sinon.stub(),
      debug: sinon.stub(),
      error: sinon.stub(),
      fatal: sinon.stub(),
      info: sinon.stub(),
      level: sinon.stub(),
      warn: sinon.stub()
    }
    this.ravenClient = {
      captureException: this.captureException,
      once: sinon.stub().yields()
    }
    this.fetchResponse = {
      text: sinon.stub().resolves('')
    }
    this.Bunyan = {
      createLogger: sinon.stub().returns(this.bunyanLogger),
      RingBuffer: bunyan.RingBuffer,
      stdSerializers: {
        req: sinon.stub(),
        res: sinon.stub()
      }
    }
    this.Raven = {
      Client: sinon.stub().returns(this.ravenClient)
    }
    this.Fetch = {
      fetch: sinon.stub().resolves(this.fetchResponse)
    }
    this.Fs = {
      readFile: sinon.stub(),
      access: sinon.stub()
    }
    this.stackdriverStreamConfig = { stream: 'stackdriver' }
    this.stackdriverClient = {
      stream: sinon.stub().returns(this.stackdriverStreamConfig)
    }
    this.GCPLogging = {
      LoggingBunyan: sinon.stub().returns(this.stackdriverClient)
    }
    this.LoggingManager = SandboxedModule.require(modulePath, {
      globals: { console, process },
      requires: {
        bunyan: this.Bunyan,
        raven: this.Raven,
        'node-fetch': this.Fetch,
        fs: this.Fs,
        '@google-cloud/logging-bunyan': this.GCPLogging
      }
    })
    this.loggerName = 'test'
    this.logger = this.LoggingManager.initialize(this.loggerName)
    this.logger.initializeErrorReporting('test_dsn')
  })

  afterEach(function () {
    this.clock.restore()
  })

  describe('initialize', function () {
    beforeEach(function () {
      this.checkLogLevelStub = sinon.stub(this.LoggingManager, 'checkLogLevel')
      this.Bunyan.createLogger.reset()
    })

    afterEach(function () {
      this.checkLogLevelStub.restore()
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

      it('should not run checkLogLevel', function () {
        this.checkLogLevelStub.should.not.have.been.called
      })
    })

    describe('in production', function () {
      beforeEach(function () {
        process.env.NODE_ENV = 'production'
        this.logger = this.LoggingManager.initialize(this.loggerName)
      })

      afterEach(() => delete process.env.NODE_ENV)

      it('should default to log level warn', function () {
        this.Bunyan.createLogger.firstCall.args[0].streams[0].level.should.equal(
          'warn'
        )
      })

      it('should run checkLogLevel', function () {
        this.checkLogLevelStub.should.have.been.calledOnce
      })

      describe('after 1 minute', () =>
        it('should run checkLogLevel again', function () {
          this.clock.tick(61 * 1000)
          this.checkLogLevelStub.should.have.been.calledTwice
        }))

      describe('after 2 minutes', () =>
        it('should run checkLogLevel again', function () {
          this.clock.tick(121 * 1000)
          this.checkLogLevelStub.should.have.been.calledThrice
        }))
    })

    describe('when LOG_LEVEL set in env', function () {
      beforeEach(function () {
        process.env.LOG_LEVEL = 'trace'
        this.LoggingManager.initialize()
      })

      afterEach(() => delete process.env.LOG_LEVEL)

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

    it('should log log', function () {
      this.logger.log(this.logArgs)
      this.bunyanLogger.info.should.have.been.calledWith(this.logArgs)
    })
  })

  describe('logger.error', function () {
    it('should report a single error to sentry', function () {
      this.logger.error({ foo: 'bar' }, 'message')
      this.captureException.called.should.equal(true)
    })

    it('should report the same error to sentry only once', function () {
      const error1 = new Error('this is the error')
      this.logger.error({ foo: error1 }, 'first message')
      this.logger.error({ bar: error1 }, 'second message')
      this.captureException.callCount.should.equal(1)
    })

    it('should report two different errors to sentry individually', function () {
      const error1 = new Error('this is the error')
      const error2 = new Error('this is the error')
      this.logger.error({ foo: error1 }, 'first message')
      this.logger.error({ bar: error2 }, 'second message')
      this.captureException.callCount.should.equal(2)
    })

    it('should remove the path from fs errors', function () {
      const fsError = new Error(
        "Error: ENOENT: no such file or directory, stat '/tmp/3279b8d0-da10-11e8-8255-efd98985942b'"
      )
      fsError.path = '/tmp/3279b8d0-da10-11e8-8255-efd98985942b'
      this.logger.error({ err: fsError }, 'message')
      this.captureException
        .calledWith(
          sinon.match.has(
            'message',
            'Error: ENOENT: no such file or directory, stat'
          )
        )
        .should.equal(true)
    })

    it('for multiple errors should only report a maximum of 5 errors to sentry', function () {
      this.logger.error({ foo: 'bar' }, 'message')
      this.logger.error({ foo: 'bar' }, 'message')
      this.logger.error({ foo: 'bar' }, 'message')
      this.logger.error({ foo: 'bar' }, 'message')
      this.logger.error({ foo: 'bar' }, 'message')
      this.logger.error({ foo: 'bar' }, 'message')
      this.logger.error({ foo: 'bar' }, 'message')
      this.logger.error({ foo: 'bar' }, 'message')
      this.logger.error({ foo: 'bar' }, 'message')
      this.captureException.callCount.should.equal(5)
    })

    it('for multiple errors with a minute delay should report 10 errors to sentry', function () {
      // the first five errors should be reported to sentry
      this.logger.error({ foo: 'bar' }, 'message')
      this.logger.error({ foo: 'bar' }, 'message')
      this.logger.error({ foo: 'bar' }, 'message')
      this.logger.error({ foo: 'bar' }, 'message')
      this.logger.error({ foo: 'bar' }, 'message')
      // the following errors should not be reported
      this.logger.error({ foo: 'bar' }, 'message')
      this.logger.error({ foo: 'bar' }, 'message')
      this.logger.error({ foo: 'bar' }, 'message')
      this.logger.error({ foo: 'bar' }, 'message')
      // allow a minute to pass
      this.clock.tick(this.start + 61 * 1000)
      // after a minute the next five errors should be reported to sentry
      this.logger.error({ foo: 'bar' }, 'message')
      this.logger.error({ foo: 'bar' }, 'message')
      this.logger.error({ foo: 'bar' }, 'message')
      this.logger.error({ foo: 'bar' }, 'message')
      this.logger.error({ foo: 'bar' }, 'message')
      // the following errors should not be reported to sentry
      this.logger.error({ foo: 'bar' }, 'message')
      this.logger.error({ foo: 'bar' }, 'message')
      this.logger.error({ foo: 'bar' }, 'message')
      this.logger.error({ foo: 'bar' }, 'message')
      this.captureException.callCount.should.equal(10)
    })

    describe('reportedToSentry', function () {
      it('should mark the error as reported to sentry', function () {
        const err = new Error()
        this.logger.error({ err }, 'message')
        expect(this.captureException.called).to.equal(true)
        expect(err.reportedToSentry).to.equal(true)
      })

      it('should mark two errors as reported to sentry', function () {
        const err1 = new Error()
        const err2 = new Error()
        this.logger.error({ err: err1, err2 }, 'message')
        expect(this.captureException.called).to.equal(true)
        expect(err1.reportedToSentry).to.equal(true)
        expect(err2.reportedToSentry).to.equal(true)
      })

      it('should not mark arbitrary objects as reported to sentry', function () {
        const err = new Error()
        const ctx = { foo: 'bar' }
        this.logger.error({ err, ctx }, 'message')
        expect(this.captureException.called).to.equal(true)
        expect(ctx.reportedToSentry).to.equal(undefined)
      })
    })
  })

  describe('checkLogLevel', function () {
    beforeEach(function () {
      this.Fs.access.yields(null)
    })


    it('should request log level override from the config map', function () {
      this.logger.checkLogLevel()
      this.Fs.access.should.have.been.calledWithMatch(
        '/logging'
      )
      this.Fs.readFile.should.have.been.calledWithMatch(
        '/logging/tracingEndTime'
      )
    })

    describe('when read errors', function () {
      beforeEach(function () {
        this.Fs.readFile.yields(new Error('error'))
        this.logger.checkLogLevel()
      })

      it('should only set default level', function () {
        this.bunyanLogger.level.should.have.been.calledOnce.and.calledWith(
          'debug'
        )
      })
    })

    describe('when the file is empty', function () {
      beforeEach(function () {
        this.Fs.readFile.yields(null, '')
        this.logger.checkLogLevel()
      })

      it('should only set default level', function () {
        this.bunyanLogger.level.should.have.been.calledOnce.and.calledWith(
          'debug'
        )
      })
    })

    describe('when time value returned that is less than current time', function () {
      beforeEach(function () {
        this.Fs.readFile.yields(null, '1')
        this.logger.checkLogLevel()
      })

      it('should only set default level', function () {
        this.bunyanLogger.level.should.have.been.calledOnce.and.calledWith(
          'debug'
        )
      })
    })

    describe('when time value returned that is more than current time', function () {
      describe('when level is already set', function () {
        beforeEach(function () {
          this.bunyanLogger.level.returns(10)
          this.Fs.readFile.yields(null, (this.start + 1000).toString())
          this.logger.checkLogLevel()
        })

        it('should set trace level', function () {
          this.bunyanLogger.level.should.have.been.calledOnce.and.calledWith(
            'trace'
          )
        })
      })

      describe('when level is not already set', function () {
        beforeEach(function () {
          this.bunyanLogger.level.returns(20)
          this.Fs.readFile.yields(null, (this.start + 1000).toString())
          this.logger.checkLogLevel()
        })

        it('should set trace level', function () {
          this.bunyanLogger.level.should.have.been.calledOnce.and.calledWith(
            'trace'
          )
        })
      })

      describe('when /logging does not exist', function () {
        beforeEach(function () {
          this.Fs.access.yields(new Error)
        })

        describe('checkLogLevel', function() {
          it('should request log level override from google meta data service', function() {
            this.logger.checkLogLevel()
            const options = {
              headers: {
                'Metadata-Flavor': 'Google'
              } 
            }
            const uri = `http://metadata.google.internal/computeMetadata/v1/project/attributes/${this.loggerName}-setLogLevelEndTime`
            this.Fetch.fetch.should.have.been.calledWithMatch(uri,options)
          })
      
          describe('when request has error', function() {
            beforeEach(function() {
              this.Request.yields('error')
              this.logger.checkLogLevel()
            })
      
            it('should only set default level', function() {
              this.bunyanLogger.level.should.have.been.calledOnce.and.calledWith(
                'debug'
              )
            })
          })
      
          describe('when statusCode is not 200', function() {
            beforeEach(function() {
              this.Request.yields(null, { statusCode: 404 })
              this.logger.checkLogLevel()
            })
      
            it('should only set default level', function() {
              this.bunyanLogger.level.should.have.been.calledOnce.and.calledWith(
                'debug'
              )
            })
          })
      
          describe('when time value returned that is less than current time', function() {
            beforeEach(function() {
              this.Request.yields(null, { statusCode: 200 }, '1')
              this.logger.checkLogLevel()
            })
      
            it('should only set default level', function() {
              this.bunyanLogger.level.should.have.been.calledOnce.and.calledWith(
                'debug'
              )
            })
          })
      
          describe('when time value returned that is more than current time', function() {
            describe('when level is already set', function() {
              beforeEach(function() {
                this.bunyanLogger.level.returns(10)
                this.Request.yields(null, { statusCode: 200 }, this.start + 1000)
                this.logger.checkLogLevel()
              })
      
              it('should set trace level', function() {
                this.bunyanLogger.level.should.have.been.calledOnce.and.calledWith(
                  'trace'
                )
              })
            })
      
            describe('when level is not already set', function() {
              beforeEach(function() {
                this.bunyanLogger.level.returns(20)
                this.fetchResponse.text = sinon.stub().resolves(this.start + 1000)
                this.Fetch.fetch = sinon.stub().resolves(this.fetchResponse)
                //this.Request.yields(null, { statusCode: 200 }, this.start + 1000)
                //this.fetchResponse = sinon.stub().resolves
                
                
                //{data: this.start + 1000, status: 200}
                this.logger.checkLogLevel()
              })
      
              it('should set trace level', function() {
                this.bunyanLogger.level.should.have.been.calledOnce.and.calledWith(
                  'trace'
                )
              })
            })
          })
        })





        
      })
    })
  })

  describe('ringbuffer', function () {
    beforeEach(function () {
      this.logBufferMock = [
        { msg: 'log 1' },
        { msg: 'log 2' },
        { level: 50, msg: 'error' }
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
          { msg: 'log 2' }
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

  describe('stackdriver logging', function () {
    describe('when STACKDRIVER_LOGGING is unset', function () {
      beforeEach(function () {
        process.env.STACKDRIVER_LOGGING = undefined
        this.LoggingManager.initialize(this.loggerName)
      })

      it('is disabled', function () {
        expect(this.bunyanLogger.addStream).not.to.have.been.calledWith(
          this.stackdriverStreamConfig
        )
      })
    })

    describe('when STACKDRIVER_LOGGING is true', function () {
      beforeEach(function () {
        process.env.STACKDRIVER_LOGGING = 'true'
        this.LoggingManager.initialize(this.loggerName)
      })

      it('is enabled', function () {
        expect(this.bunyanLogger.addStream).to.have.been.calledWith(
          this.stackdriverStreamConfig
        )
      })

      it('is configured properly', function () {
        expect(this.GCPLogging.LoggingBunyan).to.have.been.calledWith({
          logName: this.loggerName,
          serviceContext: { service: this.loggerName }
        })
      })
    })
  })
})
