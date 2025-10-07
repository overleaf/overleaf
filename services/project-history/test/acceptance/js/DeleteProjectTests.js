import { expect } from 'chai'
import nock from 'nock'
import mongodb from 'mongodb-legacy'
import * as ProjectHistoryApp from './helpers/ProjectHistoryApp.js'
import * as ProjectHistoryClient from './helpers/ProjectHistoryClient.js'
const { ObjectId } = mongodb

const MockHistoryStore = () => nock('http://127.0.0.1:3100')
const MockWeb = () => nock('http://127.0.0.1:3000')
const fixture = path => new URL(`../fixtures/${path}`, import.meta.url)

describe('Deleting project', function () {
  beforeEach(async function () {
    this.projectId = new ObjectId().toString()
    this.historyId = new ObjectId().toString()
    MockWeb()
      .get(`/project/${this.projectId}/details`)
      .reply(200, {
        name: 'Test Project',
        overleaf: { history: { id: this.historyId } },
      })
    MockHistoryStore()
      .get(`/api/projects/${this.historyId}/latest/history`)
      .replyWithFile(200, fixture('chunks/0-3.json'))
    MockHistoryStore().delete(`/api/projects/${this.historyId}`).reply(204)
    await ProjectHistoryApp.ensureRunning()
  })

  describe('when the project has no pending updates', function () {
    it('successfully deletes the project', async function () {
      await ProjectHistoryClient.deleteProject(this.projectId)
    })
  })

  describe('when the project has pending updates', function () {
    beforeEach(async function () {
      await ProjectHistoryClient.pushRawUpdate(this.projectId, {
        pathname: '/main.tex',
        docLines: 'hello',
        doc: this.docId,
        meta: { userId: this.userId, ts: new Date() },
      })
      await ProjectHistoryClient.setFirstOpTimestamp(this.projectId, Date.now())
      await ProjectHistoryClient.deleteProject(this.projectId)
    })

    it('clears pending updates', async function () {
      const dump = await ProjectHistoryClient.getDump(this.projectId)
      expect(dump.updates).to.deep.equal([])
    })

    it('clears the first op timestamp', async function () {
      const ts = await ProjectHistoryClient.getFirstOpTimestamp(this.projectId)
      expect(ts).to.be.null
    })
  })
})
