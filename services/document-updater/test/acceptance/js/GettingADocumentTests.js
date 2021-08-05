/* eslint-disable
    camelcase,
    handle-callback-err,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const sinon = require('sinon')
const { expect } = require('chai')

const MockWebApi = require('./helpers/MockWebApi')
const DocUpdaterClient = require('./helpers/DocUpdaterClient')
const DocUpdaterApp = require('./helpers/DocUpdaterApp')

describe('Getting a document', function () {
  before(function (done) {
    this.lines = ['one', 'two', 'three']
    this.version = 42
    return DocUpdaterApp.ensureRunning(done)
  })

  describe('when the document is not loaded', function () {
    before(function (done) {
      ;[this.project_id, this.doc_id] = Array.from([
        DocUpdaterClient.randomId(),
        DocUpdaterClient.randomId(),
      ])
      sinon.spy(MockWebApi, 'getDocument')

      MockWebApi.insertDoc(this.project_id, this.doc_id, {
        lines: this.lines,
        version: this.version,
      })

      return DocUpdaterClient.getDoc(
        this.project_id,
        this.doc_id,
        (error, res, returnedDoc) => {
          this.returnedDoc = returnedDoc
          return done()
        }
      )
    })

    after(function () {
      return MockWebApi.getDocument.restore()
    })

    it('should load the document from the web API', function () {
      return MockWebApi.getDocument
        .calledWith(this.project_id, this.doc_id)
        .should.equal(true)
    })

    it('should return the document lines', function () {
      return this.returnedDoc.lines.should.deep.equal(this.lines)
    })

    return it('should return the document at its current version', function () {
      return this.returnedDoc.version.should.equal(this.version)
    })
  })

  describe('when the document is already loaded', function () {
    before(function (done) {
      ;[this.project_id, this.doc_id] = Array.from([
        DocUpdaterClient.randomId(),
        DocUpdaterClient.randomId(),
      ])

      MockWebApi.insertDoc(this.project_id, this.doc_id, {
        lines: this.lines,
        version: this.version,
      })
      return DocUpdaterClient.preloadDoc(
        this.project_id,
        this.doc_id,
        error => {
          if (error != null) {
            throw error
          }
          sinon.spy(MockWebApi, 'getDocument')
          return DocUpdaterClient.getDoc(
            this.project_id,
            this.doc_id,
            (error, res, returnedDoc) => {
              this.returnedDoc = returnedDoc
              return done()
            }
          )
        }
      )
    })

    after(function () {
      return MockWebApi.getDocument.restore()
    })

    it('should not load the document from the web API', function () {
      return MockWebApi.getDocument.called.should.equal(false)
    })

    return it('should return the document lines', function () {
      return this.returnedDoc.lines.should.deep.equal(this.lines)
    })
  })

  describe('when the request asks for some recent ops', function () {
    before(function (done) {
      ;[this.project_id, this.doc_id] = Array.from([
        DocUpdaterClient.randomId(),
        DocUpdaterClient.randomId(),
      ])
      MockWebApi.insertDoc(this.project_id, this.doc_id, {
        lines: (this.lines = ['one', 'two', 'three']),
      })

      this.updates = __range__(0, 199, true).map(v => ({
        doc_id: this.doc_id,
        op: [{ i: v.toString(), p: 0 }],
        v,
      }))

      return DocUpdaterClient.sendUpdates(
        this.project_id,
        this.doc_id,
        this.updates,
        error => {
          if (error != null) {
            throw error
          }
          sinon.spy(MockWebApi, 'getDocument')
          return done()
        }
      )
    })

    after(function () {
      return MockWebApi.getDocument.restore()
    })

    describe('when the ops are loaded', function () {
      before(function (done) {
        return DocUpdaterClient.getDocAndRecentOps(
          this.project_id,
          this.doc_id,
          190,
          (error, res, returnedDoc) => {
            this.returnedDoc = returnedDoc
            return done()
          }
        )
      })

      return it('should return the recent ops', function () {
        this.returnedDoc.ops.length.should.equal(10)
        return Array.from(this.updates.slice(190, -1)).map((update, i) =>
          this.returnedDoc.ops[i].op.should.deep.equal(update.op)
        )
      })
    })

    return describe('when the ops are not all loaded', function () {
      before(function (done) {
        // We only track 100 ops
        return DocUpdaterClient.getDocAndRecentOps(
          this.project_id,
          this.doc_id,
          10,
          (error, res, returnedDoc) => {
            this.res = res
            this.returnedDoc = returnedDoc
            return done()
          }
        )
      })

      return it('should return UnprocessableEntity', function () {
        return this.res.statusCode.should.equal(422)
      })
    })
  })

  describe('when the document does not exist', function () {
    before(function (done) {
      ;[this.project_id, this.doc_id] = Array.from([
        DocUpdaterClient.randomId(),
        DocUpdaterClient.randomId(),
      ])
      return DocUpdaterClient.getDoc(
        this.project_id,
        this.doc_id,
        (error, res, doc) => {
          this.statusCode = res.statusCode
          return done()
        }
      )
    })

    return it('should return 404', function () {
      return this.statusCode.should.equal(404)
    })
  })

  describe('when the web api returns an error', function () {
    before(function (done) {
      ;[this.project_id, this.doc_id] = Array.from([
        DocUpdaterClient.randomId(),
        DocUpdaterClient.randomId(),
      ])
      sinon
        .stub(MockWebApi, 'getDocument')
        .callsFake((project_id, doc_id, callback) => {
          if (callback == null) {
            callback = function (error, doc) {}
          }
          return callback(new Error('oops'))
        })
      return DocUpdaterClient.getDoc(
        this.project_id,
        this.doc_id,
        (error, res, doc) => {
          this.statusCode = res.statusCode
          return done()
        }
      )
    })

    after(function () {
      return MockWebApi.getDocument.restore()
    })

    return it('should return 500', function () {
      return this.statusCode.should.equal(500)
    })
  })

  return describe('when the web api http request takes a long time', function () {
    before(function (done) {
      this.timeout = 10000
      ;[this.project_id, this.doc_id] = Array.from([
        DocUpdaterClient.randomId(),
        DocUpdaterClient.randomId(),
      ])
      sinon
        .stub(MockWebApi, 'getDocument')
        .callsFake((project_id, doc_id, callback) => {
          if (callback == null) {
            callback = function (error, doc) {}
          }
          return setTimeout(callback, 30000)
        })
      return done()
    })

    after(function () {
      return MockWebApi.getDocument.restore()
    })

    return it('should return quickly(ish)', function (done) {
      const start = Date.now()
      return DocUpdaterClient.getDoc(
        this.project_id,
        this.doc_id,
        (error, res, doc) => {
          res.statusCode.should.equal(500)
          const delta = Date.now() - start
          expect(delta).to.be.below(20000)
          return done()
        }
      )
    })
  })
})

function __range__(left, right, inclusive) {
  const range = []
  const ascending = left < right
  const end = !inclusive ? right : ascending ? right + 1 : right - 1
  for (let i = left; ascending ? i < end : i > end; ascending ? i++ : i--) {
    range.push(i)
  }
  return range
}
