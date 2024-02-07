const sinon = require('sinon')
const modulePath = '../../../../app/js/PersistenceManager.js'
const SandboxedModule = require('sandboxed-module')
const Errors = require('../../../../app/js/Errors')

describe('PersistenceManager', function () {
  beforeEach(function () {
    this.request = sinon.stub()
    this.request.defaults = () => this.request
    this.Metrics = {
      Timer: class Timer {},
      inc: sinon.stub(),
    }
    this.Metrics.Timer.prototype.done = sinon.stub()
    this.Settings = {}

    this.PersistenceManager = SandboxedModule.require(modulePath, {
      requires: {
        requestretry: this.request,
        '@overleaf/settings': this.Settings,
        './Metrics': this.Metrics,
        './Errors': Errors,
      },
    })
    this.project_id = 'project-id-123'
    this.projectHistoryId = 'history-id-123'
    this.doc_id = 'doc-id-123'
    this.lines = ['one', 'two', 'three']
    this.version = 42
    this.callback = sinon.stub()
    this.ranges = { comments: 'mock', entries: 'mock' }
    this.pathname = '/a/b/c.tex'
    this.lastUpdatedAt = Date.now()
    this.lastUpdatedBy = 'last-author-id'
    this.historyRangesSupport = false
    this.Settings.apis = {
      web: {
        url: (this.url = 'www.example.com'),
        user: (this.user = 'overleaf'),
        pass: (this.pass = 'password'),
      },
    }
  })

  describe('getDoc', function () {
    beforeEach(function () {
      this.webResponse = {
        lines: this.lines,
        version: this.version,
        ranges: this.ranges,
        pathname: this.pathname,
        projectHistoryId: this.projectHistoryId,
        historyRangesSupport: this.historyRangesSupport,
      }
    })

    describe('with a successful response from the web api', function () {
      beforeEach(function () {
        this.request.callsArgWith(
          1,
          null,
          { statusCode: 200 },
          JSON.stringify(this.webResponse)
        )
        this.PersistenceManager.getDoc(
          this.project_id,
          this.doc_id,
          this.callback
        )
      })

      it('should call the web api', function () {
        this.request
          .calledWith({
            url: `${this.url}/project/${this.project_id}/doc/${this.doc_id}`,
            method: 'GET',
            headers: {
              accept: 'application/json',
            },
            auth: {
              user: this.user,
              pass: this.pass,
              sendImmediately: true,
            },
            jar: false,
            timeout: 5000,
          })
          .should.equal(true)
      })

      it('should call the callback with the doc lines, version and ranges', function () {
        this.callback
          .calledWith(
            null,
            this.lines,
            this.version,
            this.ranges,
            this.pathname,
            this.projectHistoryId,
            this.historyRangesSupport
          )
          .should.equal(true)
      })

      it('should time the execution', function () {
        this.Metrics.Timer.prototype.done.called.should.equal(true)
      })

      it('should increment the metric', function () {
        this.Metrics.inc
          .calledWith('getDoc', 1, { status: 200 })
          .should.equal(true)
      })
    })

    describe('with the peek option', function () {
      beforeEach(function () {
        this.request.yields(
          null,
          { statusCode: 200 },
          JSON.stringify(this.webResponse)
        )
        this.PersistenceManager.getDoc(
          this.project_id,
          this.doc_id,
          { peek: true },
          this.callback
        )
      })

      it('should call the web api with a peek param', function () {
        this.request
          .calledWith({
            url: `${this.url}/project/${this.project_id}/doc/${this.doc_id}`,
            qs: { peek: 'true' },
            method: 'GET',
            headers: {
              accept: 'application/json',
            },
            auth: {
              user: this.user,
              pass: this.pass,
              sendImmediately: true,
            },
            jar: false,
            timeout: 5000,
          })
          .should.equal(true)
      })
    })

    describe('when request returns an error', function () {
      beforeEach(function () {
        this.error = new Error('oops')
        this.error.code = 'EOOPS'
        this.request.callsArgWith(1, this.error, null, null)
        this.PersistenceManager.getDoc(
          this.project_id,
          this.doc_id,
          this.callback
        )
      })

      it('should return a generic connection error', function () {
        this.callback
          .calledWith(
            sinon.match
              .instanceOf(Error)
              .and(sinon.match.has('message', 'error connecting to web API'))
          )
          .should.equal(true)
      })

      it('should time the execution', function () {
        this.Metrics.Timer.prototype.done.called.should.equal(true)
      })

      it('should increment the metric', function () {
        this.Metrics.inc
          .calledWith('getDoc', 1, { status: 'EOOPS' })
          .should.equal(true)
      })
    })

    describe('when the request returns 404', function () {
      beforeEach(function () {
        this.request.callsArgWith(1, null, { statusCode: 404 }, '')
        this.PersistenceManager.getDoc(
          this.project_id,
          this.doc_id,
          this.callback
        )
      })

      it('should return a NotFoundError', function () {
        this.callback
          .calledWith(sinon.match.instanceOf(Errors.NotFoundError))
          .should.equal(true)
      })

      it('should time the execution', function () {
        this.Metrics.Timer.prototype.done.called.should.equal(true)
      })

      it('should increment the metric', function () {
        this.Metrics.inc
          .calledWith('getDoc', 1, { status: 404 })
          .should.equal(true)
      })
    })

    describe('when the request returns 413', function () {
      beforeEach(function () {
        this.request.callsArgWith(1, null, { statusCode: 413 }, '')
        this.PersistenceManager.getDoc(
          this.project_id,
          this.doc_id,
          this.callback
        )
      })

      it('should return a FileTooLargeError', function () {
        this.callback
          .calledWith(sinon.match.instanceOf(Errors.FileTooLargeError))
          .should.equal(true)
      })

      it('should time the execution', function () {
        this.Metrics.Timer.prototype.done.called.should.equal(true)
      })

      it('should increment the metric', function () {
        this.Metrics.inc
          .calledWith('getDoc', 1, { status: 413 })
          .should.equal(true)
      })
    })

    describe('when the request returns an error status code', function () {
      beforeEach(function () {
        this.request.callsArgWith(1, null, { statusCode: 500 }, '')
        this.PersistenceManager.getDoc(
          this.project_id,
          this.doc_id,
          this.callback
        )
      })

      it('should return an error', function () {
        this.callback
          .calledWith(sinon.match.instanceOf(Error))
          .should.equal(true)
      })

      it('should time the execution', function () {
        this.Metrics.Timer.prototype.done.called.should.equal(true)
      })

      it('should increment the metric', function () {
        this.Metrics.inc
          .calledWith('getDoc', 1, { status: 500 })
          .should.equal(true)
      })
    })

    describe('when request returns an doc without lines', function () {
      beforeEach(function () {
        delete this.webResponse.lines
        this.request.callsArgWith(
          1,
          null,
          { statusCode: 200 },
          JSON.stringify(this.webResponse)
        )
        this.PersistenceManager.getDoc(
          this.project_id,
          this.doc_id,
          this.callback
        )
      })

      it('should return and error', function () {
        this.callback
          .calledWith(sinon.match.instanceOf(Error))
          .should.equal(true)
      })
    })

    describe('when request returns an doc without a version', function () {
      beforeEach(function () {
        delete this.webResponse.version
        this.request.callsArgWith(
          1,
          null,
          { statusCode: 200 },
          JSON.stringify(this.webResponse)
        )
        this.PersistenceManager.getDoc(
          this.project_id,
          this.doc_id,
          this.callback
        )
      })

      it('should return and error', function () {
        this.callback
          .calledWith(sinon.match.instanceOf(Error))
          .should.equal(true)
      })
    })

    describe('when request returns an doc without a pathname', function () {
      beforeEach(function () {
        delete this.webResponse.pathname
        this.request.callsArgWith(
          1,
          null,
          { statusCode: 200 },
          JSON.stringify(this.webResponse)
        )
        this.PersistenceManager.getDoc(
          this.project_id,
          this.doc_id,
          this.callback
        )
      })

      it('should return and error', function () {
        this.callback
          .calledWith(sinon.match.instanceOf(Error))
          .should.equal(true)
      })
    })
  })

  describe('setDoc', function () {
    describe('with a successful response from the web api', function () {
      beforeEach(function () {
        this.request.callsArgWith(1, null, { statusCode: 200 })
        this.PersistenceManager.setDoc(
          this.project_id,
          this.doc_id,
          this.lines,
          this.version,
          this.ranges,
          this.lastUpdatedAt,
          this.lastUpdatedBy,
          this.callback
        )
      })

      it('should call the web api', function () {
        this.request
          .calledWith({
            url: `${this.url}/project/${this.project_id}/doc/${this.doc_id}`,
            json: {
              lines: this.lines,
              version: this.version,
              ranges: this.ranges,
              lastUpdatedAt: this.lastUpdatedAt,
              lastUpdatedBy: this.lastUpdatedBy,
            },
            method: 'POST',
            auth: {
              user: this.user,
              pass: this.pass,
              sendImmediately: true,
            },
            jar: false,
            timeout: 5000,
          })
          .should.equal(true)
      })

      it('should call the callback without error', function () {
        this.callback.calledWith(null).should.equal(true)
      })

      it('should time the execution', function () {
        this.Metrics.Timer.prototype.done.called.should.equal(true)
      })

      it('should increment the metric', function () {
        this.Metrics.inc
          .calledWith('setDoc', 1, { status: 200 })
          .should.equal(true)
      })
    })

    describe('when request returns an error', function () {
      beforeEach(function () {
        this.error = new Error('oops')
        this.error.code = 'EOOPS'
        this.request.callsArgWith(1, this.error, null, null)
        this.PersistenceManager.setDoc(
          this.project_id,
          this.doc_id,
          this.lines,
          this.version,
          this.ranges,
          this.lastUpdatedAt,
          this.lastUpdatedBy,
          this.callback
        )
      })

      it('should return a generic connection error', function () {
        this.callback
          .calledWith(
            sinon.match
              .instanceOf(Error)
              .and(sinon.match.has('message', 'error connecting to web API'))
          )
          .should.equal(true)
      })

      it('should time the execution', function () {
        this.Metrics.Timer.prototype.done.called.should.equal(true)
      })

      it('should increment the metric', function () {
        this.Metrics.inc
          .calledWith('setDoc', 1, { status: 'EOOPS' })
          .should.equal(true)
      })
    })

    describe('when the request returns 404', function () {
      beforeEach(function () {
        this.request.callsArgWith(1, null, { statusCode: 404 }, '')
        this.PersistenceManager.setDoc(
          this.project_id,
          this.doc_id,
          this.lines,
          this.version,
          this.ranges,
          this.lastUpdatedAt,
          this.lastUpdatedBy,
          this.callback
        )
      })

      it('should return a NotFoundError', function () {
        this.callback
          .calledWith(sinon.match.instanceOf(Errors.NotFoundError))
          .should.equal(true)
      })

      it('should time the execution', function () {
        this.Metrics.Timer.prototype.done.called.should.equal(true)
      })

      it('should increment the metric', function () {
        this.Metrics.inc
          .calledWith('setDoc', 1, { status: 404 })
          .should.equal(true)
      })
    })

    describe('when the request returns 413', function () {
      beforeEach(function () {
        this.request.callsArgWith(1, null, { statusCode: 413 }, '')
        this.PersistenceManager.setDoc(
          this.project_id,
          this.doc_id,
          this.lines,
          this.version,
          this.ranges,
          this.lastUpdatedAt,
          this.lastUpdatedBy,
          this.callback
        )
      })

      it('should return a FileTooLargeError', function () {
        this.callback
          .calledWith(sinon.match.instanceOf(Errors.FileTooLargeError))
          .should.equal(true)
      })

      it('should time the execution', function () {
        this.Metrics.Timer.prototype.done.called.should.equal(true)
      })

      it('should increment the metric', function () {
        this.Metrics.inc
          .calledWith('setDoc', 1, { status: 413 })
          .should.equal(true)
      })
    })

    describe('when the request returns an error status code', function () {
      beforeEach(function () {
        this.request.callsArgWith(1, null, { statusCode: 500 }, '')
        this.PersistenceManager.setDoc(
          this.project_id,
          this.doc_id,
          this.lines,
          this.version,
          this.ranges,
          this.lastUpdatedAt,
          this.lastUpdatedBy,
          this.callback
        )
      })

      it('should return an error', function () {
        this.callback
          .calledWith(sinon.match.instanceOf(Error))
          .should.equal(true)
      })

      it('should time the execution', function () {
        this.Metrics.Timer.prototype.done.called.should.equal(true)
      })

      it('should increment the metric', function () {
        this.Metrics.inc
          .calledWith('setDoc', 1, { status: 500 })
          .should.equal(true)
      })
    })
  })
})
