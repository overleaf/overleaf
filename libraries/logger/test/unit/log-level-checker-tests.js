const Path = require('node:path')
const { promisify } = require('node:util')
const SandboxedModule = require('sandboxed-module')
const sinon = require('sinon')
const { expect } = require('chai')

const MODULE_PATH = Path.join(__dirname, '../../log-level-checker.js')
const DEFAULT_LEVEL = 'warn'
const TRACE_LEVEL = 'trace'
const TRACING_END_TIME_FILE = '/logging/tracingEndTime'
const NOW = 10000
const PAST = NOW - 1000
const FUTURE = NOW + 1000

const delay = promisify(setTimeout)

describe('LogLevelChecker', function () {
  beforeEach(function () {
    this.logger = {
      level: sinon.stub(),
      fields: { name: 'myapp' },
    }
    this.FetchUtils = {
      fetchString: sinon.stub(),
    }
    this.fetchLogLevelEndTimeStub = this.FetchUtils.fetchString.withArgs(
      'http://metadata.google.internal/computeMetadata/v1/project/attributes/myapp-setLogLevelEndTime',
      { headers: { 'Metadata-Flavor': 'Google' } }
    )
    this.fetchLogLevelEndTimeStub.resolves('')

    this.fs = {
      promises: {
        readFile: sinon.stub(),
      },
    }

    this.clock = sinon.useFakeTimers(NOW)

    this.module = SandboxedModule.require(MODULE_PATH, {
      requires: {
        '@overleaf/fetch-utils': this.FetchUtils,
        fs: this.fs,
      },
    })
  })

  afterEach(function () {
    this.clock.restore()
  })

  describe('FileLogLevelChecker', function () {
    beforeEach(function () {
      this.logLevelChecker = new this.module.FileLogLevelChecker(
        this.logger,
        DEFAULT_LEVEL
      )
    })

    describe('when the file is empty', function () {
      setupTracingEndTimeFile('')
      checkLogLevel()
      expectLevelSetTo(DEFAULT_LEVEL)
    })

    describe("when the file can't be read", function () {
      beforeEach(async function () {
        this.fs.promises.readFile.rejects(new Error('Read error!'))
      })
      checkLogLevel()
      expectLevelSetTo(DEFAULT_LEVEL)
    })

    describe('when the file has a timestamp in the future', function () {
      setupTracingEndTimeFile(FUTURE.toString())
      checkLogLevel()
      expectLevelSetTo(TRACE_LEVEL)
    })

    describe('when the file has a timestamp in the past', function () {
      setupTracingEndTimeFile(PAST.toString())
      checkLogLevel()
      expectLevelSetTo(DEFAULT_LEVEL)
    })

    describe('interval checker', function () {
      beforeEach(function () {
        this.fs.promises.readFile.resolves('')
        this.logLevelChecker.start()
      })

      afterEach(function () {
        this.logLevelChecker.stop()
      })

      it('checks the file every minute', async function () {
        this.clock.tick(1000)
        // Yield to the event loop
        await delay(0)
        expect(this.logger.level).to.have.been.calledOnceWithExactly(
          DEFAULT_LEVEL
        )
        this.logger.level.reset()

        // Trace until 1.5 minutes in the future
        const traceUntil = NOW + 90000
        this.fs.promises.readFile.resolves(traceUntil.toString())

        this.clock.tick(61000)
        await delay(0)
        expect(this.logger.level).to.have.been.calledOnceWithExactly(
          TRACE_LEVEL
        )
        this.logger.level.reset()

        this.clock.tick(60000)
        await delay(0)
        expect(this.logger.level).to.have.been.calledOnceWithExactly(
          DEFAULT_LEVEL
        )
      })
    })
  })

  describe('GCEMetadataLogLevelChecker', function () {
    beforeEach(function () {
      this.logLevelChecker = new this.module.GCEMetadataLogLevelChecker(
        this.logger,
        DEFAULT_LEVEL
      )
    })

    describe('when the response is empty', function () {
      setupTracingEndTimeGCE('')
      checkLogLevel()
      expectLevelSetTo(DEFAULT_LEVEL)
    })

    describe('when the request errors', function () {
      beforeEach(async function () {
        this.FetchUtils.fetchString.rejects(new Error('Read error!'))
      })
      checkLogLevel()
      expectLevelSetTo(DEFAULT_LEVEL)
    })

    describe('when the response is a timestamp in the future', function () {
      setupTracingEndTimeGCE(FUTURE.toString())
      checkLogLevel()
      expectLevelSetTo(TRACE_LEVEL)
    })

    describe('when the response is a timestamp in the past', function () {
      setupTracingEndTimeGCE(PAST.toString())
      checkLogLevel()
      expectLevelSetTo(DEFAULT_LEVEL)
    })
  })
})

function setupTracingEndTimeFile(contents) {
  beforeEach(`set tracing end time in file to ${contents}`, function () {
    this.fs.promises.readFile.withArgs(TRACING_END_TIME_FILE).resolves(contents)
  })
}

function setupTracingEndTimeGCE(contents) {
  beforeEach(
    `set tracing end time in GCE metadata to ${contents}`,
    function () {
      this.fetchLogLevelEndTimeStub.resolves(contents)
    }
  )
}

function checkLogLevel() {
  beforeEach('Check log level', async function () {
    await this.logLevelChecker.checkLogLevel()
  })
}

function expectLevelSetTo(level) {
  it(`sets the log level to ${level}`, function () {
    expect(this.logger.level).to.have.been.calledWith(level)
  })
}
