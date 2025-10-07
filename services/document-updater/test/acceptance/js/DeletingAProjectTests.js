const sinon = require('sinon')
const { setTimeout } = require('node:timers/promises')

const MockProjectHistoryApi = require('./helpers/MockProjectHistoryApi')
const MockWebApi = require('./helpers/MockWebApi')
const DocUpdaterClient = require('./helpers/DocUpdaterClient')
const DocUpdaterApp = require('./helpers/DocUpdaterApp')

describe('Deleting a project', function () {
  beforeEach(async function () {
    let docId0, docId1
    this.project_id = DocUpdaterClient.randomId()
    this.docs = [
      {
        id: (docId0 = DocUpdaterClient.randomId()),
        lines: ['one', 'two', 'three'],
        update: {
          doc: docId0,
          op: [
            {
              i: 'one and a half\n',
              p: 4,
            },
          ],
          v: 0,
        },
        updatedLines: ['one', 'one and a half', 'two', 'three'],
      },
      {
        id: (docId1 = DocUpdaterClient.randomId()),
        lines: ['four', 'five', 'six'],
        update: {
          doc: docId1,
          op: [
            {
              i: 'four and a half\n',
              p: 5,
            },
          ],
          v: 0,
        },
        updatedLines: ['four', 'four and a half', 'five', 'six'],
      },
    ]
    for (const doc of this.docs) {
      MockWebApi.insertDoc(this.project_id, doc.id, {
        lines: doc.lines,
        version: doc.update.v,
      })
    }

    await DocUpdaterApp.ensureRunning()
  })

  describe('without updates', function () {
    beforeEach(async function () {
      sinon.spy(MockWebApi, 'setDocument')
      sinon.spy(MockProjectHistoryApi, 'flushProject')

      for (const doc of this.docs) {
        await DocUpdaterClient.preloadDoc(this.project_id, doc.id)
      }
      await setTimeout(200)
      const res = await DocUpdaterClient.deleteProject(this.project_id)
      this.statusCode = res.status
    })

    afterEach(function () {
      MockWebApi.setDocument.restore()
      MockProjectHistoryApi.flushProject.restore()
    })

    it('should return a 204 status code', function () {
      this.statusCode.should.equal(204)
    })

    it('should not send any document to the web api', function () {
      MockWebApi.setDocument.should.not.have.been.called
    })

    it('should need to reload the docs if read again', async function () {
      sinon.spy(MockWebApi, 'getDocument')
      for (const doc of this.docs) {
        MockWebApi.getDocument
          .calledWith(this.project_id, doc.id)
          .should.equal(false)
        await DocUpdaterClient.getDoc(this.project_id, doc.id)
        MockWebApi.getDocument
          .calledWith(this.project_id, doc.id)
          .should.equal(true)
      }
      MockWebApi.getDocument.restore()
    })

    it('should flush each doc in project history', function () {
      MockProjectHistoryApi.flushProject
        .calledWith(this.project_id)
        .should.equal(true)
    })
  })

  describe('with documents which have been updated', function () {
    beforeEach(async function () {
      sinon.spy(MockWebApi, 'setDocument')
      sinon.spy(MockProjectHistoryApi, 'flushProject')
      for (const doc of this.docs) {
        await DocUpdaterClient.preloadDoc(this.project_id, doc.id)
        await DocUpdaterClient.sendUpdate(this.project_id, doc.id, doc.update)
      }
      await setTimeout(200)
      const res = await DocUpdaterClient.deleteProject(this.project_id)
      this.statusCode = res.status
    })

    afterEach(function () {
      MockWebApi.setDocument.restore()
      MockProjectHistoryApi.flushProject.restore()
    })

    it('should return a 204 status code', function () {
      this.statusCode.should.equal(204)
    })

    it('should send each document to the web api', function () {
      for (const doc of this.docs) {
        MockWebApi.setDocument
          .calledWith(this.project_id, doc.id, doc.updatedLines)
          .should.equal(true)
      }
    })

    it('should need to reload the docs if read again', async function () {
      sinon.spy(MockWebApi, 'getDocument')
      for (const doc of this.docs) {
        MockWebApi.getDocument
          .calledWith(this.project_id, doc.id)
          .should.equal(false)
        await DocUpdaterClient.getDoc(this.project_id, doc.id)
        MockWebApi.getDocument
          .calledWith(this.project_id, doc.id)
          .should.equal(true)
      }
      MockWebApi.getDocument.restore()
    })

    it('should flush each doc in project history', function () {
      MockProjectHistoryApi.flushProject
        .calledWith(this.project_id)
        .should.equal(true)
    })
  })

  describe('with the background=true parameter from realtime and no request to flush the queue', function () {
    beforeEach(async function () {
      sinon.spy(MockWebApi, 'setDocument')
      sinon.spy(MockProjectHistoryApi, 'flushProject')
      for (const doc of this.docs) {
        await DocUpdaterClient.preloadDoc(this.project_id, doc.id)
        await DocUpdaterClient.sendUpdate(this.project_id, doc.id, doc.update)
      }
      await setTimeout(200)
      const res = await DocUpdaterClient.deleteProjectOnShutdown(
        this.project_id
      )
      this.statusCode = res.status
    })

    afterEach(function () {
      MockWebApi.setDocument.restore()
      MockProjectHistoryApi.flushProject.restore()
    })

    it('should return a 204 status code', function () {
      this.statusCode.should.equal(204)
    })

    it('should not send any documents to the web api', function () {
      MockWebApi.setDocument.called.should.equal(false)
    })

    it('should not flush to project history', function () {
      MockProjectHistoryApi.flushProject.called.should.equal(false)
    })
  })

  describe('with the background=true parameter from realtime and a request to flush the queue', function () {
    beforeEach(async function () {
      sinon.spy(MockWebApi, 'setDocument')
      sinon.spy(MockProjectHistoryApi, 'flushProject')
      for (const doc of this.docs) {
        await DocUpdaterClient.preloadDoc(this.project_id, doc.id)
        await DocUpdaterClient.sendUpdate(this.project_id, doc.id, doc.update)
      }
      await setTimeout(200)
      const res = await DocUpdaterClient.deleteProjectOnShutdown(
        this.project_id
      )
      this.statusCode = res.status
      // after deleting the project and putting it in the queue, flush the queue
      await setTimeout(2000)
      await DocUpdaterClient.flushOldProjects()
    })

    afterEach(function () {
      MockWebApi.setDocument.restore()
      MockProjectHistoryApi.flushProject.restore()
    })

    it('should return a 204 status code', function () {
      this.statusCode.should.equal(204)
    })

    it('should send each document to the web api', function () {
      for (const doc of this.docs) {
        MockWebApi.setDocument
          .calledWith(this.project_id, doc.id, doc.updatedLines)
          .should.equal(true)
      }
    })

    it('should flush to project history', function () {
      MockProjectHistoryApi.flushProject.called.should.equal(true)
    })
  })
})
