// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const sinon = require('sinon')
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

    sinon.spy(MockProjectHistoryApi, 'flushProject')
    DocUpdaterApp.ensureRunning(done)
  })

  after(function () {
    MockProjectHistoryApi.flushProject.restore()
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
      DocUpdaterClient.preloadDoc(this.project_id, this.doc_id, error => {
        if (error != null) {
          throw error
        }
        DocUpdaterClient.sendUpdate(
          this.project_id,
          this.doc_id,
          this.update,
          error => {
            if (error != null) {
              throw error
            }
            setTimeout(() => {
              DocUpdaterClient.deleteDoc(
                this.project_id,
                this.doc_id,
                (error, res, body) => {
                  if (error) return done(error)
                  this.statusCode = res.statusCode
                  setTimeout(done, 200)
                }
              )
            }, 200)
          }
        )
      })
    })

    after(function () {
      MockWebApi.setDocument.restore()
      MockWebApi.getDocument.restore()
    })

    it('should return a 204 status code', function () {
      this.statusCode.should.equal(204)
    })

    it('should send the updated document and version to the web api', function () {
      MockWebApi.setDocument
        .calledWith(this.project_id, this.doc_id, this.result, this.version + 1)
        .should.equal(true)
    })

    it('should need to reload the doc if read again', function (done) {
      MockWebApi.getDocument.resetHistory()
      MockWebApi.getDocument.called.should.equals(false)
      DocUpdaterClient.getDoc(
        this.project_id,
        this.doc_id,
        (error, res, doc) => {
          if (error) return done(error)
          MockWebApi.getDocument
            .calledWith(this.project_id, this.doc_id)
            .should.equal(true)
          done()
        }
      )
    })

    it('should flush project history', function () {
      MockProjectHistoryApi.flushProject
        .calledWith(this.project_id)
        .should.equal(true)
    })
  })

  describe('when the doc is not in the doc updater', function () {
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
      DocUpdaterClient.deleteDoc(
        this.project_id,
        this.doc_id,
        (error, res, body) => {
          if (error) return done(error)
          this.statusCode = res.statusCode
          setTimeout(done, 200)
        }
      )
    })

    after(function () {
      MockWebApi.setDocument.restore()
      MockWebApi.getDocument.restore()
    })

    it('should return a 204 status code', function () {
      this.statusCode.should.equal(204)
    })

    it('should not need to send the updated document to the web api', function () {
      MockWebApi.setDocument.called.should.equal(false)
    })

    it('should need to reload the doc if read again', function (done) {
      MockWebApi.getDocument.called.should.equals(false)
      DocUpdaterClient.getDoc(
        this.project_id,
        this.doc_id,
        (error, res, doc) => {
          if (error) return done(error)
          MockWebApi.getDocument
            .calledWith(this.project_id, this.doc_id)
            .should.equal(true)
          done()
        }
      )
    })

    it('should flush project history', function () {
      MockProjectHistoryApi.flushProject
        .calledWith(this.project_id)
        .should.equal(true)
    })
  })
})
