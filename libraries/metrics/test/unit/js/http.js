const Path = require('node:path')
const SandboxedModule = require('sandboxed-module')
const sinon = require('sinon')

const MODULE_PATH = Path.join(__dirname, '../../../http.js')

describe('http.monitor', function () {
  beforeEach(function () {
    this.req = {
      method: 'POST',
      url: '/project/1234/cleanup',
      headers: {
        'content-length': '123',
      },
      route: {
        path: '/project/:id/cleanup',
      },
    }
    this.originalResponseEnd = sinon.stub()
    this.res = {
      end: this.originalResponseEnd,
    }
    this.data = 'data'
    this.logger = {
      debug: sinon.stub(),
      info: sinon.stub(),
      warn: sinon.stub(),
    }
    this.Metrics = {
      timing: sinon.stub(),
      summary: sinon.stub(),
    }
    this.clock = sinon.useFakeTimers()

    this.http = SandboxedModule.require(MODULE_PATH, {
      requires: {
        './index': this.Metrics,
      },
    })
  })

  afterEach(function () {
    this.clock.restore()
  })

  describe('with the default options', function () {
    beforeEach('set up the monitor', function (done) {
      this.http.monitor(this.logger)(this.req, this.res, done)
    })

    describe('after a simple request', function () {
      endRequest()
      expectOriginalEndCalled()
      expectMetrics()

      it('logs the request at the DEBUG level', function () {
        sinon.assert.calledWith(
          this.logger.debug,
          { req: this.req, res: this.res, responseTimeMs: 500 },
          '%s %s',
          this.req.method,
          this.req.url
        )
      })
    })

    describe('when logging is disabled', function () {
      beforeEach('disable logging', function () {
        this.req.logger.disable()
      })

      endRequest()
      expectOriginalEndCalled()
      expectMetrics()

      it("doesn't log the request", function () {
        sinon.assert.notCalled(this.logger.debug)
      })
    })

    describe('with custom log fields', function () {
      beforeEach('add custom fields', function () {
        this.req.logger.addFields({ a: 1, b: 2 })
      })

      endRequest()

      it('logs the request with the custom log fields', function () {
        sinon.assert.calledWith(
          this.logger.debug,
          { req: this.req, res: this.res, responseTimeMs: 500, a: 1, b: 2 },
          '%s %s',
          this.req.method,
          this.req.url
        )
      })
    })

    describe('when setting the log level', function () {
      beforeEach('set custom level', function () {
        this.req.logger.setLevel('warn')
      })

      endRequest()

      it('logs the request at the custom level', function () {
        sinon.assert.calledWith(
          this.logger.warn,
          { req: this.req, res: this.res, responseTimeMs: 500 },
          '%s %s',
          this.req.method,
          this.req.url
        )
      })
    })
  })

  describe('with a different default log level', function () {
    beforeEach('set up the monitor', function (done) {
      this.http.monitor(this.logger, 'info')(this.req, this.res, done)
    })

    endRequest()

    it('logs the request at that level', function () {
      sinon.assert.calledWith(
        this.logger.info,
        { req: this.req, res: this.res, responseTimeMs: 500 },
        '%s %s',
        this.req.method,
        this.req.url
      )
    })
  })
})

function endRequest() {
  beforeEach('end the request', function () {
    this.clock.tick(500)
    this.res.end(this.data)
  })
}

function expectOriginalEndCalled() {
  it('calls the original res.end()', function () {
    sinon.assert.calledWith(this.originalResponseEnd, this.data)
  })
}

function expectMetrics() {
  it('records the response time', function () {
    sinon.assert.calledWith(this.Metrics.timing, 'http_request', 500, null, {
      method: this.req.method,
      status_code: this.res.status_code,
      path: 'project_id_cleanup',
    })
  })

  it('records the request size', function () {
    sinon.assert.calledWith(
      this.Metrics.summary,
      'http_request_size_bytes',
      123,
      {
        method: this.req.method,
        status_code: this.res.status_code,
        path: 'project_id_cleanup',
      }
    )
  })
}
