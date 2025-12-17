const sinon = require('sinon')
const { expect } = require('chai')

const MockWebApi = require('./helpers/MockWebApi')
const DocUpdaterClient = require('./helpers/DocUpdaterClient')
const DocUpdaterApp = require('./helpers/DocUpdaterApp')
const { RequestFailedError } = require('@overleaf/fetch-utils')

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
    before(function () {
      sinon.stub(MockWebApi, 'getDocument').rejects(new Error('oops'))
    })

    after(function () {
      MockWebApi.getDocument.restore()
    })

    it('should return 500', async function () {
      const projectId = DocUpdaterClient.randomId()
      const docId = DocUpdaterClient.randomId()
      await expect(DocUpdaterClient.getDoc(projectId, docId))
        .to.be.rejectedWith(RequestFailedError)
        .and.eventually.have.nested.property('response.status', 500)
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
