import { expect } from 'chai'
import settings from '@overleaf/settings'
import { fetchNothing } from '@overleaf/fetch-utils'
import mongodb from 'mongodb-legacy'
import nock from 'nock'
import * as ProjectHistoryClient from './helpers/ProjectHistoryClient.js'
import * as ProjectHistoryApp from './helpers/ProjectHistoryApp.js'
const { ObjectId } = mongodb

const MockHistoryStore = () => nock('http://127.0.0.1:3100')
const MockWeb = () => nock('http://127.0.0.1:3000')

describe('Health Check', function () {
  beforeEach(async function () {
    const projectId = new ObjectId()
    const historyId = new ObjectId().toString()
    settings.history.healthCheck = { project_id: projectId }

    await ProjectHistoryApp.ensureRunning()

    MockHistoryStore().post('/api/projects').reply(200, {
      projectId: historyId,
    })
    MockHistoryStore()
      .get(`/api/projects/${historyId}/latest/history`)
      .reply(200, {
        chunk: {
          startVersion: 0,
          history: {
            snapshot: {},
            changes: [],
          },
        },
      })
    MockWeb()
      .get(`/project/${projectId}/details`)
      .reply(200, {
        name: 'Test Project',
        overleaf: {
          history: {
            id: historyId,
          },
        },
      })

    await ProjectHistoryClient.initializeProject(historyId)
  })

  it('should respond to the health check', async function () {
    const response = await fetchNothing('http://127.0.0.1:3054/health_check')
    expect(response.status).to.equal(200)
  })
})
