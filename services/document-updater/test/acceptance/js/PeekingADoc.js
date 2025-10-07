const sinon = require('sinon')
const MockWebApi = require('./helpers/MockWebApi')
const DocUpdaterClient = require('./helpers/DocUpdaterClient')
const DocUpdaterApp = require('./helpers/DocUpdaterApp')
const { expect } = require('chai')
const { RequestFailedError } = require('@overleaf/fetch-utils')

describe('Peeking a document', function () {
  before(async function () {
    this.lines = ['one', 'two', 'three']
    this.version = 42
    await DocUpdaterApp.ensureRunning()
  })

  describe('when the document is not loaded', function () {
    before(async function () {
      this.project_id = DocUpdaterClient.randomId()
      this.doc_id = DocUpdaterClient.randomId()
      sinon.spy(MockWebApi, 'getDocument')

      MockWebApi.insertDoc(this.project_id, this.doc_id, {
        lines: this.lines,
        version: this.version,
      })
    })

    after(function () {
      MockWebApi.getDocument.restore()
    })

    it('should not load the document from the web API and should return a 404 response', async function () {
      await expect(DocUpdaterClient.peekDoc(this.project_id, this.doc_id))
        .to.be.rejectedWith(RequestFailedError)
        .and.eventually.have.nested.property('response.status', 404)
      MockWebApi.getDocument.called.should.equal(false)
    })
  })

  describe('when the document is already loaded', function () {
    before(async function () {
      this.project_id = DocUpdaterClient.randomId()
      this.doc_id = DocUpdaterClient.randomId()

      MockWebApi.insertDoc(this.project_id, this.doc_id, {
        lines: this.lines,
        version: this.version,
      })
      await DocUpdaterClient.preloadDoc(this.project_id, this.doc_id)
      sinon.spy(MockWebApi, 'getDocument')
      this.returnedDoc = await DocUpdaterClient.peekDoc(
        this.project_id,
        this.doc_id
      )
    })

    after(function () {
      MockWebApi.getDocument.restore()
    })

    it('should return the document lines', function () {
      this.returnedDoc.lines.should.deep.equal(this.lines)
    })

    it('should return the document version', function () {
      this.returnedDoc.version.should.equal(this.version)
    })

    it('should not load the document from the web API', function () {
      MockWebApi.getDocument.called.should.equal(false)
    })
  })
})
