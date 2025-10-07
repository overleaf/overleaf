const sinon = require('sinon')
const MockProjectHistoryApi = require('./helpers/MockProjectHistoryApi')
const MockWebApi = require('./helpers/MockWebApi')
const DocUpdaterClient = require('./helpers/DocUpdaterClient')
const DocUpdaterApp = require('./helpers/DocUpdaterApp')
const { setTimeout } = require('node:timers/promises')

describe('Deleting a document', function () {
  before(async function () {
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
    await DocUpdaterApp.ensureRunning()
  })

  after(function () {
    MockProjectHistoryApi.flushProject.restore()
  })

  describe('when the updated doc exists in the doc updater', function () {
    before(async function () {
      this.project_id = DocUpdaterClient.randomId()
      this.doc_id = DocUpdaterClient.randomId()
      sinon.spy(MockWebApi, 'setDocument')
      sinon.spy(MockWebApi, 'getDocument')

      MockWebApi.insertDoc(this.project_id, this.doc_id, {
        lines: this.lines,
        version: this.version,
      })
      await DocUpdaterClient.preloadDoc(this.project_id, this.doc_id)
      await DocUpdaterClient.sendUpdate(
        this.project_id,
        this.doc_id,
        this.update
      )
      await setTimeout(200)
      const res = await DocUpdaterClient.deleteDoc(this.project_id, this.doc_id)
      this.statusCode = res.status
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

    it('should need to reload the doc if read again', async function () {
      MockWebApi.getDocument.resetHistory()
      MockWebApi.getDocument.called.should.equals(false)
      await DocUpdaterClient.getDoc(this.project_id, this.doc_id)
      MockWebApi.getDocument
        .calledWith(this.project_id, this.doc_id)
        .should.equal(true)
    })

    it('should flush project history', function () {
      MockProjectHistoryApi.flushProject
        .calledWith(this.project_id)
        .should.equal(true)
    })
  })

  describe('when the doc is not in the doc updater', function () {
    before(async function () {
      this.project_id = DocUpdaterClient.randomId()
      this.doc_id = DocUpdaterClient.randomId()
      MockWebApi.insertDoc(this.project_id, this.doc_id, {
        lines: this.lines,
      })
      sinon.spy(MockWebApi, 'setDocument')
      sinon.spy(MockWebApi, 'getDocument')
      const res = await DocUpdaterClient.deleteDoc(this.project_id, this.doc_id)
      this.statusCode = res.status
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

    it('should need to reload the doc if read again', async function () {
      MockWebApi.getDocument.called.should.equals(false)
      await DocUpdaterClient.getDoc(this.project_id, this.doc_id)
      MockWebApi.getDocument
        .calledWith(this.project_id, this.doc_id)
        .should.equal(true)
    })

    it('should flush project history', function () {
      MockProjectHistoryApi.flushProject
        .calledWith(this.project_id)
        .should.equal(true)
    })
  })
})
