/* eslint-disable
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
const MockTrackChangesApi = require('./helpers/MockTrackChangesApi')
const MockProjectHistoryApi = require('./helpers/MockProjectHistoryApi')
const MockWebApi = require('./helpers/MockWebApi')
const DocUpdaterClient = require('./helpers/DocUpdaterClient')
const DocUpdaterApp = require('./helpers/DocUpdaterApp')

describe('Deleting a document', function () {
  before(function (done) {
    this.lines = ['one', 'two', 'three']
    this.version = 42
    this.update = {
      doc: this.doc_id,
      op: [
        {
          i: 'one and a half\n',
          p: 4,
        },
      ],
      v: this.version,
    }
    this.result = ['one', 'one and a half', 'two', 'three']

    sinon.spy(MockTrackChangesApi, 'flushDoc')
    sinon.spy(MockProjectHistoryApi, 'flushProject')
    return DocUpdaterApp.ensureRunning(done)
  })

  after(function () {
    MockTrackChangesApi.flushDoc.restore()
    return MockProjectHistoryApi.flushProject.restore()
  })

  describe('when the updated doc exists in the doc updater', function () {
    before(function (done) {
      ;[this.project_id, this.doc_id] = Array.from([
        DocUpdaterClient.randomId(),
        DocUpdaterClient.randomId(),
      ])
      sinon.spy(MockWebApi, 'setDocument')
      sinon.spy(MockWebApi, 'getDocument')

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
          return DocUpdaterClient.sendUpdate(
            this.project_id,
            this.doc_id,
            this.update,
            error => {
              if (error != null) {
                throw error
              }
              return setTimeout(() => {
                return DocUpdaterClient.deleteDoc(
                  this.project_id,
                  this.doc_id,
                  (error, res, body) => {
                    this.statusCode = res.statusCode
                    return setTimeout(done, 200)
                  }
                )
              }, 200)
            }
          )
        }
      )
    })

    after(function () {
      MockWebApi.setDocument.restore()
      return MockWebApi.getDocument.restore()
    })

    it('should return a 204 status code', function () {
      return this.statusCode.should.equal(204)
    })

    it('should send the updated document and version to the web api', function () {
      return MockWebApi.setDocument
        .calledWith(this.project_id, this.doc_id, this.result, this.version + 1)
        .should.equal(true)
    })

    it('should need to reload the doc if read again', function (done) {
      MockWebApi.getDocument.resetHistory()
      MockWebApi.getDocument.called.should.equals(false)
      return DocUpdaterClient.getDoc(
        this.project_id,
        this.doc_id,
        (error, res, doc) => {
          MockWebApi.getDocument
            .calledWith(this.project_id, this.doc_id)
            .should.equal(true)
          return done()
        }
      )
    })

    it('should flush track changes', function () {
      return MockTrackChangesApi.flushDoc
        .calledWith(this.doc_id)
        .should.equal(true)
    })

    return it('should flush project history', function () {
      return MockProjectHistoryApi.flushProject
        .calledWith(this.project_id)
        .should.equal(true)
    })
  })

  return describe('when the doc is not in the doc updater', function () {
    before(function (done) {
      ;[this.project_id, this.doc_id] = Array.from([
        DocUpdaterClient.randomId(),
        DocUpdaterClient.randomId(),
      ])
      MockWebApi.insertDoc(this.project_id, this.doc_id, {
        lines: this.lines,
      })
      sinon.spy(MockWebApi, 'setDocument')
      sinon.spy(MockWebApi, 'getDocument')
      return DocUpdaterClient.deleteDoc(
        this.project_id,
        this.doc_id,
        (error, res, body) => {
          this.statusCode = res.statusCode
          return setTimeout(done, 200)
        }
      )
    })

    after(function () {
      MockWebApi.setDocument.restore()
      return MockWebApi.getDocument.restore()
    })

    it('should return a 204 status code', function () {
      return this.statusCode.should.equal(204)
    })

    it('should not need to send the updated document to the web api', function () {
      return MockWebApi.setDocument.called.should.equal(false)
    })

    it('should need to reload the doc if read again', function (done) {
      MockWebApi.getDocument.called.should.equals(false)
      return DocUpdaterClient.getDoc(
        this.project_id,
        this.doc_id,
        (error, res, doc) => {
          MockWebApi.getDocument
            .calledWith(this.project_id, this.doc_id)
            .should.equal(true)
          return done()
        }
      )
    })

    it('should flush track changes', function () {
      return MockTrackChangesApi.flushDoc
        .calledWith(this.doc_id)
        .should.equal(true)
    })

    return it('should flush project history', function () {
      return MockProjectHistoryApi.flushProject
        .calledWith(this.project_id)
        .should.equal(true)
    })
  })
})
