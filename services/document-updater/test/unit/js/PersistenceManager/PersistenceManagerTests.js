/* eslint-disable
    no-return-assign,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const sinon = require('sinon')
const modulePath = '../../../../app/js/PersistenceManager.js'
const SandboxedModule = require('sandboxed-module')
const Errors = require('../../../../app/js/Errors')

describe('PersistenceManager', function () {
  beforeEach(function () {
    let Timer
    this.request = sinon.stub()
    this.request.defaults = () => this.request
    this.PersistenceManager = SandboxedModule.require(modulePath, {
      requires: {
        requestretry: this.request,
        '@overleaf/settings': (this.Settings = {}),
        './Metrics': (this.Metrics = {
          Timer: (Timer = (function () {
            Timer = class Timer {
              static initClass() {
                this.prototype.done = sinon.stub()
              }
            }
            Timer.initClass()
            return Timer
          })()),
          inc: sinon.stub(),
        }),
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
    return (this.Settings.apis = {
      web: {
        url: (this.url = 'www.example.com'),
        user: (this.user = 'sharelatex'),
        pass: (this.pass = 'password'),
      },
    })
  })

  describe('getDoc', function () {
    beforeEach(function () {
      return (this.webResponse = {
        lines: this.lines,
        version: this.version,
        ranges: this.ranges,
        pathname: this.pathname,
        projectHistoryId: this.projectHistoryId,
      })
    })

    describe('with a successful response from the web api', function () {
      beforeEach(function () {
        this.request.callsArgWith(
          1,
          null,
          { statusCode: 200 },
          JSON.stringify(this.webResponse)
        )
        return this.PersistenceManager.getDoc(
          this.project_id,
          this.doc_id,
          this.callback
        )
      })

      it('should call the web api', function () {
        return this.request
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
        return this.callback
          .calledWith(
            null,
            this.lines,
            this.version,
            this.ranges,
            this.pathname,
            this.projectHistoryId
          )
          .should.equal(true)
      })

      it('should time the execution', function () {
        return this.Metrics.Timer.prototype.done.called.should.equal(true)
      })

      return it('should increment the metric', function () {
        return this.Metrics.inc
          .calledWith('getDoc', 1, { status: 200 })
          .should.equal(true)
      })
    })

    describe('when request returns an error', function () {
      beforeEach(function () {
        this.error = new Error('oops')
        this.error.code = 'EOOPS'
        this.request.callsArgWith(1, this.error, null, null)
        return this.PersistenceManager.getDoc(
          this.project_id,
          this.doc_id,
          this.callback
        )
      })

      it('should return a generic connection error', function () {
        return this.callback
          .calledWith(
            sinon.match
              .instanceOf(Error)
              .and(sinon.match.has('message', 'error connecting to web API'))
          )
          .should.equal(true)
      })

      it('should time the execution', function () {
        return this.Metrics.Timer.prototype.done.called.should.equal(true)
      })

      return it('should increment the metric', function () {
        return this.Metrics.inc
          .calledWith('getDoc', 1, { status: 'EOOPS' })
          .should.equal(true)
      })
    })

    describe('when the request returns 404', function () {
      beforeEach(function () {
        this.request.callsArgWith(1, null, { statusCode: 404 }, '')
        return this.PersistenceManager.getDoc(
          this.project_id,
          this.doc_id,
          this.callback
        )
      })

      it('should return a NotFoundError', function () {
        return this.callback
          .calledWith(sinon.match.instanceOf(Errors.NotFoundError))
          .should.equal(true)
      })

      it('should time the execution', function () {
        return this.Metrics.Timer.prototype.done.called.should.equal(true)
      })

      return it('should increment the metric', function () {
        return this.Metrics.inc
          .calledWith('getDoc', 1, { status: 404 })
          .should.equal(true)
      })
    })

    describe('when the request returns an error status code', function () {
      beforeEach(function () {
        this.request.callsArgWith(1, null, { statusCode: 500 }, '')
        return this.PersistenceManager.getDoc(
          this.project_id,
          this.doc_id,
          this.callback
        )
      })

      it('should return an error', function () {
        return this.callback
          .calledWith(sinon.match.instanceOf(Error))
          .should.equal(true)
      })

      it('should time the execution', function () {
        return this.Metrics.Timer.prototype.done.called.should.equal(true)
      })

      return it('should increment the metric', function () {
        return this.Metrics.inc
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
        return this.PersistenceManager.getDoc(
          this.project_id,
          this.doc_id,
          this.callback
        )
      })

      return it('should return and error', function () {
        return this.callback
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
        return this.PersistenceManager.getDoc(
          this.project_id,
          this.doc_id,
          this.callback
        )
      })

      return it('should return and error', function () {
        return this.callback
          .calledWith(sinon.match.instanceOf(Error))
          .should.equal(true)
      })
    })

    return describe('when request returns an doc without a pathname', function () {
      beforeEach(function () {
        delete this.webResponse.pathname
        this.request.callsArgWith(
          1,
          null,
          { statusCode: 200 },
          JSON.stringify(this.webResponse)
        )
        return this.PersistenceManager.getDoc(
          this.project_id,
          this.doc_id,
          this.callback
        )
      })

      return it('should return and error', function () {
        return this.callback
          .calledWith(sinon.match.instanceOf(Error))
          .should.equal(true)
      })
    })
  })

  return describe('setDoc', function () {
    describe('with a successful response from the web api', function () {
      beforeEach(function () {
        this.request.callsArgWith(1, null, { statusCode: 200 })
        return this.PersistenceManager.setDoc(
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
        return this.request
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
        return this.callback.calledWith(null).should.equal(true)
      })

      it('should time the execution', function () {
        return this.Metrics.Timer.prototype.done.called.should.equal(true)
      })

      return it('should increment the metric', function () {
        return this.Metrics.inc
          .calledWith('setDoc', 1, { status: 200 })
          .should.equal(true)
      })
    })

    describe('when request returns an error', function () {
      beforeEach(function () {
        this.error = new Error('oops')
        this.error.code = 'EOOPS'
        this.request.callsArgWith(1, this.error, null, null)
        return this.PersistenceManager.setDoc(
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
        return this.callback
          .calledWith(
            sinon.match
              .instanceOf(Error)
              .and(sinon.match.has('message', 'error connecting to web API'))
          )
          .should.equal(true)
      })

      it('should time the execution', function () {
        return this.Metrics.Timer.prototype.done.called.should.equal(true)
      })

      return it('should increment the metric', function () {
        return this.Metrics.inc
          .calledWith('setDoc', 1, { status: 'EOOPS' })
          .should.equal(true)
      })
    })

    describe('when the request returns 404', function () {
      beforeEach(function () {
        this.request.callsArgWith(1, null, { statusCode: 404 }, '')
        return this.PersistenceManager.setDoc(
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
        return this.callback
          .calledWith(sinon.match.instanceOf(Errors.NotFoundError))
          .should.equal(true)
      })

      it('should time the execution', function () {
        return this.Metrics.Timer.prototype.done.called.should.equal(true)
      })

      return it('should increment the metric', function () {
        return this.Metrics.inc
          .calledWith('setDoc', 1, { status: 404 })
          .should.equal(true)
      })
    })

    return describe('when the request returns an error status code', function () {
      beforeEach(function () {
        this.request.callsArgWith(1, null, { statusCode: 500 }, '')
        return this.PersistenceManager.setDoc(
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
        return this.callback
          .calledWith(sinon.match.instanceOf(Error))
          .should.equal(true)
      })

      it('should time the execution', function () {
        return this.Metrics.Timer.prototype.done.called.should.equal(true)
      })

      return it('should increment the metric', function () {
        return this.Metrics.inc
          .calledWith('setDoc', 1, { status: 500 })
          .should.equal(true)
      })
    })
  })
})
