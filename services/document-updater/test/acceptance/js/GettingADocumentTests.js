const sinon = require('sinon')
const { expect } = require('chai')

const MockWebApi = require('./helpers/MockWebApi')
const DocUpdaterClient = require('./helpers/DocUpdaterClient')
const DocUpdaterApp = require('./helpers/DocUpdaterApp')
const { RequestFailedError } = require('@overleaf/fetch-utils')
const PersistenceManager = require('../../../app/js/PersistenceManager')

describe('Getting a document', function () {
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

      this.returnedDoc = await DocUpdaterClient.getDoc(
        this.project_id,
        this.doc_id
      )
    })

    after(function () {
      MockWebApi.getDocument.restore()
    })

    it('should load the document from the web API', function () {
      MockWebApi.getDocument
        .calledWith(this.project_id, this.doc_id)
        .should.equal(true)
    })

    it('should return the document lines', function () {
      this.returnedDoc.lines.should.deep.equal(this.lines)
    })

    it('should return the document at its current version', function () {
      this.returnedDoc.version.should.equal(this.version)
    })
  })

  describe('when the document is not loaded and the peek option is used', function () {
    before(async function () {
      const origGetDocumentController =
        MockWebApi.getDocumentController.bind(MockWebApi)
      sinon
        .stub(MockWebApi, 'getDocumentController')
        .callsFake((req, res, next) => {
          expect(req.query.peek).to.equal('true')
          return origGetDocumentController(req, res, next)
        })
      this.project_id = DocUpdaterClient.randomId()
      this.doc_id = DocUpdaterClient.randomId()
      sinon.spy(MockWebApi, 'getDocument')

      MockWebApi.insertDoc(this.project_id, this.doc_id, {
        lines: this.lines,
        version: this.version,
      })
      // This is only used by the resync code and not exposed on the HTTP
      // api so we are calling it directly.
      this.returnedDoc = await PersistenceManager.promises.getDoc(
        this.project_id,
        this.doc_id,
        { peek: true }
      )
    })

    after(function () {
      MockWebApi.getDocumentController.restore()
      MockWebApi.getDocument.restore()
    })

    it('should load the document from the web API with peek=true', function () {
      MockWebApi.getDocument
        .calledWith(this.project_id, this.doc_id)
        .should.equal(true)
    })

    it('should return the document lines', function () {
      this.returnedDoc.lines.should.deep.equal(this.lines)
    })

    it('should return the document at its current version', function () {
      this.returnedDoc.version.should.equal(this.version)
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
      this.returnedDoc = await DocUpdaterClient.getDoc(
        this.project_id,
        this.doc_id
      )
    })

    after(function () {
      MockWebApi.getDocument.restore()
    })

    it('should not load the document from the web API', function () {
      MockWebApi.getDocument.called.should.equal(false)
    })

    it('should return the document lines', function () {
      this.returnedDoc.lines.should.deep.equal(this.lines)
    })
  })

  describe('when the request asks for some recent ops', function () {
    before(async function () {
      this.project_id = DocUpdaterClient.randomId()
      this.doc_id = DocUpdaterClient.randomId()
      MockWebApi.insertDoc(this.project_id, this.doc_id, {
        lines: (this.lines = ['one', 'two', 'three']),
      })

      this.updates = __range__(0, 199, true).map(v => ({
        doc_id: this.doc_id,
        op: [{ i: v.toString(), p: 0 }],
        v,
      }))

      await DocUpdaterClient.sendUpdates(
        this.project_id,
        this.doc_id,
        this.updates
      )
      sinon.spy(MockWebApi, 'getDocument')
    })

    after(function () {
      MockWebApi.getDocument.restore()
    })

    describe('when the ops are loaded', function () {
      before(async function () {
        this.returnedDoc = await DocUpdaterClient.getDocAndRecentOps(
          this.project_id,
          this.doc_id,
          190
        )
      })

      it('should return the recent ops', function () {
        this.returnedDoc.ops.length.should.equal(10)
        for (const [i, update] of this.updates.slice(190, -1).entries()) {
          this.returnedDoc.ops[i].op.should.deep.equal(update.op)
        }
      })
    })

    describe('when the ops are not all loaded', function () {
      it('should return UnprocessableEntity', async function () {
        // We only track 100 ops
        await expect(
          DocUpdaterClient.getDocAndRecentOps(this.project_id, this.doc_id, 10)
        )
          .to.be.rejectedWith(RequestFailedError)
          .and.eventually.have.nested.property('response.status', 422)
      })
    })
  })

  describe('when the document does not exist', function () {
    it('should return 404', async function () {
      const projectId = DocUpdaterClient.randomId()
      const docId = DocUpdaterClient.randomId()
      await expect(DocUpdaterClient.getDoc(projectId, docId))
        .to.be.rejectedWith(RequestFailedError)
        .and.eventually.have.nested.property('response.status', 404)
    })
  })

  describe('when the web api returns an error', function () {
    beforeEach(function () {
      sinon.stub(MockWebApi, 'getDocument').rejects(new Error('oops'))
    })

    afterEach(function () {
      MockWebApi.getDocument.restore()
    })

    it('should return 500', async function () {
      const projectId = DocUpdaterClient.randomId()
      const docId = DocUpdaterClient.randomId()
      await expect(DocUpdaterClient.getDoc(projectId, docId))
        .to.be.rejectedWith(RequestFailedError)
        .and.eventually.have.nested.property('response.status', 500)
    })

    it('should retry the request', async function () {
      const projectId = DocUpdaterClient.randomId()
      const docId = DocUpdaterClient.randomId()
      await expect(DocUpdaterClient.getDoc(projectId, docId))
        .to.be.rejectedWith(RequestFailedError)
        .and.eventually.have.nested.property('response.status', 500)
      expect(MockWebApi.getDocument).to.be.calledTwice
    })
  })

  describe('when the web api returns a retryable error on the first attempt', function () {
    beforeEach(function () {
      const origGetDocumentController =
        MockWebApi.getDocumentController.bind(MockWebApi)
      const getDocumentStub = sinon
        .stub(MockWebApi, 'getDocumentController')
        .onCall(0)
        .callsFake((req, res, next) => {
          res.destroy() // simulate a network error
        })
      getDocumentStub.onCall(1).callsFake(origGetDocumentController)
    })

    afterEach(function () {
      MockWebApi.getDocumentController.restore()
    })

    it('should return 200', async function () {
      const projectId = DocUpdaterClient.randomId()
      const docId = DocUpdaterClient.randomId()
      MockWebApi.insertDoc(projectId, docId, {
        lines: this.lines,
        version: this.version,
      })

      await expect(
        DocUpdaterClient.getDoc(projectId, docId)
      ).to.eventually.deep.include({ lines: this.lines, version: this.version })
    })

    it('should retry the request', async function () {
      const projectId = DocUpdaterClient.randomId()
      const docId = DocUpdaterClient.randomId()
      MockWebApi.insertDoc(projectId, docId, {
        lines: this.lines,
        version: this.version,
      })
      await expect(
        DocUpdaterClient.getDoc(projectId, docId)
      ).to.eventually.deep.include({ lines: this.lines, version: this.version })

      expect(MockWebApi.getDocumentController).to.be.calledTwice
    })
  })

  describe('when the web api returns a 413 error', function () {
    beforeEach(function () {
      sinon
        .stub(MockWebApi, 'getDocumentController')
        .callsFake((req, res, next) => {
          res.sendStatus(413)
        })
    })

    afterEach(function () {
      MockWebApi.getDocumentController.restore()
    })

    it('should return 413', async function () {
      const projectId = DocUpdaterClient.randomId()
      const docId = DocUpdaterClient.randomId()
      await expect(DocUpdaterClient.getDoc(projectId, docId))
        .to.be.rejectedWith(RequestFailedError)
        .and.eventually.have.nested.property('response.status', 413)
    })

    it('should not retry the request', async function () {
      const projectId = DocUpdaterClient.randomId()
      const docId = DocUpdaterClient.randomId()
      await expect(DocUpdaterClient.getDoc(projectId, docId))
        .to.be.rejectedWith(RequestFailedError)
        .and.eventually.have.nested.property('response.status', 413)
      expect(MockWebApi.getDocumentController).to.be.calledOnce
    })
  })

  describe('when the web api returns an incomplete doc', function () {
    afterEach(function () {
      MockWebApi.getDocument.restore()
    })

    it('should return an error for missing lines', async function () {
      const projectId = DocUpdaterClient.randomId()
      const docId = DocUpdaterClient.randomId()
      sinon
        .stub(MockWebApi, 'getDocument')
        .resolves({ version: 123, pathname: 'test' })

      await expect(DocUpdaterClient.getDoc(projectId, docId))
        .to.be.rejectedWith(RequestFailedError)
        .and.eventually.have.nested.property('response.status', 422)
    })

    it('should return an error for missing version', async function () {
      const projectId = DocUpdaterClient.randomId()
      const docId = DocUpdaterClient.randomId()
      sinon
        .stub(MockWebApi, 'getDocument')
        .resolves({ lines: [''], pathname: 'test' })

      await expect(DocUpdaterClient.getDoc(projectId, docId))
        .to.be.rejectedWith(RequestFailedError)
        .and.eventually.have.nested.property('response.status', 422)
    })

    it('should return an error for missing pathname', async function () {
      const projectId = DocUpdaterClient.randomId()
      const docId = DocUpdaterClient.randomId()
      sinon
        .stub(MockWebApi, 'getDocument')
        .resolves({ lines: [''], version: 123 })

      await expect(DocUpdaterClient.getDoc(projectId, docId))
        .to.be.rejectedWith(RequestFailedError)
        .and.eventually.have.nested.property('response.status', 422)
    })
  })

  describe('when the web api http request takes a long time', function () {
    before(function (done) {
      this.timeout = 10000
      sinon.stub(MockWebApi, 'getDocument').returns(
        new Promise(resolve => {
          setTimeout(() => resolve(null), 30000)
        })
      )
      done()
    })

    after(function () {
      MockWebApi.getDocument.restore()
    })

    it('should return quickly(ish)', async function () {
      const projectId = DocUpdaterClient.randomId()
      const docId = DocUpdaterClient.randomId()
      const start = Date.now()
      await expect(DocUpdaterClient.getDoc(projectId, docId))
        .to.be.rejectedWith(RequestFailedError)
        .and.eventually.have.nested.property('response.status', 500)
      const delta = Date.now() - start
      expect(delta).to.be.below(20000)
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
