const sinon = require('sinon')
const { expect } = require('chai')
const { setTimeout } = require('node:timers/promises')

const MockWebApi = require('./helpers/MockWebApi')
const DocUpdaterClient = require('./helpers/DocUpdaterClient')
const DocUpdaterApp = require('./helpers/DocUpdaterApp')

describe('Flushing a doc to Mongo', function () {
  before(async function () {
    this.lines = ['one', 'two', 'three']
    this.version = 42
    this.update = {
      doc: this.doc_id,
      meta: { user_id: 'last-author-fake-id' },
      op: [
        {
          i: 'one and a half\n',
          p: 4,
        },
      ],
      v: this.version,
    }
    this.result = ['one', 'one and a half', 'two', 'three']
    await DocUpdaterApp.ensureRunning()
  })

  describe('when the updated doc exists in the doc updater', function () {
    before(async function () {
      this.project_id = DocUpdaterClient.randomId()
      this.doc_id = DocUpdaterClient.randomId()
      sinon.spy(MockWebApi, 'setDocument')

      MockWebApi.insertDoc(this.project_id, this.doc_id, {
        lines: this.lines,
        version: this.version,
      })
      await DocUpdaterClient.sendUpdates(this.project_id, this.doc_id, [
        this.update,
      ])
      await setTimeout(200)
      await DocUpdaterClient.flushDoc(this.project_id, this.doc_id)
    })

    after(function () {
      MockWebApi.setDocument.restore()
    })

    it('should flush the updated doc lines and version to the web api', function () {
      MockWebApi.setDocument
        .calledWith(this.project_id, this.doc_id, this.result, this.version + 1)
        .should.equal(true)
    })

    it('should flush the last update author and time to the web api', function () {
      const lastUpdatedAt = MockWebApi.setDocument.lastCall.args[5]
      parseInt(lastUpdatedAt).should.be.closeTo(new Date().getTime(), 30000)

      const lastUpdatedBy = MockWebApi.setDocument.lastCall.args[6]
      lastUpdatedBy.should.equal('last-author-fake-id')
    })
  })

  describe('when the doc does not exist in the doc updater', function () {
    before(async function () {
      this.project_id = DocUpdaterClient.randomId()
      this.doc_id = DocUpdaterClient.randomId()
      MockWebApi.insertDoc(this.project_id, this.doc_id, {
        lines: this.lines,
      })
      sinon.spy(MockWebApi, 'setDocument')
      await DocUpdaterClient.flushDoc(this.project_id, this.doc_id)
    })

    after(function () {
      MockWebApi.setDocument.restore()
    })

    it('should not flush the doc to the web api', function () {
      MockWebApi.setDocument.called.should.equal(false)
    })
  })

  describe('when the web api http request takes a long time on first request', function () {
    before(async function () {
      this.project_id = DocUpdaterClient.randomId()
      this.doc_id = DocUpdaterClient.randomId()
      MockWebApi.insertDoc(this.project_id, this.doc_id, {
        lines: this.lines,
        version: this.version,
      })
      let t = 30000
      sinon
        .stub(MockWebApi, 'setDocument')
        .callsFake(
          (
            projectId,
            docId,
            lines,
            version,
            ranges,
            lastUpdatedAt,
            lastUpdatedBy,
            callback
          ) => {
            if (!callback) {
              callback = function () {}
            }
            setTimeout(callback, t)
            t = 0
          }
        )
      await DocUpdaterClient.preloadDoc(this.project_id, this.doc_id)
    })

    after(function () {
      MockWebApi.setDocument.restore()
    })

    it('should still work', async function () {
      const start = Date.now()
      const res = await DocUpdaterClient.flushDoc(this.project_id, this.doc_id)
      res.status.should.equal(204)
      const delta = Date.now() - start
      expect(delta).to.be.below(20000)
    })
  })
})
