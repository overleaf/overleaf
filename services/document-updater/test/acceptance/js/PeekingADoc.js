const sinon = require('sinon')
const MockWebApi = require('./helpers/MockWebApi')
const DocUpdaterClient = require('./helpers/DocUpdaterClient')
const DocUpdaterApp = require('./helpers/DocUpdaterApp')

describe('Peeking a document', function () {
  before(function (done) {
    this.lines = ['one', 'two', 'three']
    this.version = 42
    return DocUpdaterApp.ensureRunning(done)
  })

  describe('when the document is not loaded', function () {
    before(function (done) {
      this.project_id = DocUpdaterClient.randomId()
      this.doc_id = DocUpdaterClient.randomId()
      sinon.spy(MockWebApi, 'getDocument')

      MockWebApi.insertDoc(this.project_id, this.doc_id, {
        lines: this.lines,
        version: this.version,
      })

      return DocUpdaterClient.peekDoc(
        this.project_id,
        this.doc_id,
        (error, res, returnedDoc) => {
          this.error = error
          this.res = res
          this.returnedDoc = returnedDoc
          return done()
        }
      )
    })

    after(function () {
      return MockWebApi.getDocument.restore()
    })

    it('should return a 404 response', function () {
      this.res.statusCode.should.equal(404)
    })

    it('should not load the document from the web API', function () {
      return MockWebApi.getDocument.called.should.equal(false)
    })
  })

  describe('when the document is already loaded', function () {
    before(function (done) {
      this.project_id = DocUpdaterClient.randomId()
      this.doc_id = DocUpdaterClient.randomId()

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
              if (error) return done(error)
              this.res = res
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

    it('should return a 200 response', function () {
      this.res.statusCode.should.equal(200)
    })

    it('should return the document lines', function () {
      return this.returnedDoc.lines.should.deep.equal(this.lines)
    })

    it('should return the document version', function () {
      return this.returnedDoc.version.should.equal(this.version)
    })

    it('should not load the document from the web API', function () {
      return MockWebApi.getDocument.called.should.equal(false)
    })
  })
})
