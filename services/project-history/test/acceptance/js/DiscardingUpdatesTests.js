import mongodb from 'mongodb-legacy'
import nock from 'nock'
import * as ProjectHistoryClient from './helpers/ProjectHistoryClient.js'
import * as ProjectHistoryApp from './helpers/ProjectHistoryApp.js'
const { ObjectId } = mongodb

const MockHistoryStore = () => nock('http://127.0.0.1:3100')
const MockWeb = () => nock('http://127.0.0.1:3000')

describe('DiscardingUpdates', function () {
  beforeEach(async function () {
    this.timestamp = new Date()

    await ProjectHistoryApp.ensureRunning()
    this.user_id = new ObjectId().toString()
    this.project_id = new ObjectId().toString()
    this.doc_id = new ObjectId().toString()

    MockHistoryStore().post('/api/projects').reply(200, {
      projectId: 0,
    })
    MockWeb()
      .get(`/project/${this.project_id}/details`)
      .reply(200, { name: 'Test Project' })
    await ProjectHistoryClient.initializeProject(this.project_id)
  })

  it('should discard updates', async function () {
    const update = {
      pathname: '/main.tex',
      docLines: 'a\nb',
      doc: this.doc_id,
      meta: { user_id: this.user_id, ts: new Date() },
    }
    await ProjectHistoryClient.pushRawUpdate(this.project_id, update)
    await ProjectHistoryClient.flushProject(this.project_id)
  })
})
