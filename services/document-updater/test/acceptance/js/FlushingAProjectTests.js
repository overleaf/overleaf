const sinon = require('sinon')
const { setTimeout } = require('node:timers/promises')

const MockWebApi = require('./helpers/MockWebApi')
const DocUpdaterClient = require('./helpers/DocUpdaterClient')
const DocUpdaterApp = require('./helpers/DocUpdaterApp')

describe('Flushing a project', function () {
  before(async function () {
    this.project_id = DocUpdaterClient.randomId()
    const docId0 = DocUpdaterClient.randomId()
    const docId1 = DocUpdaterClient.randomId()
    this.docs = [
      {
        id: docId0,
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
        id: docId1,
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

  describe('with documents which have been updated', function () {
    before(async function () {
      sinon.spy(MockWebApi, 'setDocument')
      for (const doc of this.docs) {
        await DocUpdaterClient.preloadDoc(this.project_id, doc.id)
        await DocUpdaterClient.sendUpdate(this.project_id, doc.id, doc.update)
      }
      await setTimeout(200)
      const res = await DocUpdaterClient.flushProject(this.project_id)
      this.statusCode = res.status
    })

    after(function () {
      MockWebApi.setDocument.restore()
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

    it('should update the lines in the doc updater', async function () {
      for (const doc of this.docs) {
        const returnedDoc = await DocUpdaterClient.getDoc(
          this.project_id,
          doc.id
        )
        returnedDoc.lines.should.deep.equal(doc.updatedLines)
      }
    })
  })
})
