import { expect } from 'chai'
import nock from 'nock'
import request from 'request'
import * as ProjectHistoryApp from './helpers/ProjectHistoryApp.js'
import * as ProjectHistoryClient from './helpers/ProjectHistoryClient.js'

const MockHistoryStore = () => nock('http://127.0.0.1:3100')
const MockWeb = () => nock('http://127.0.0.1:3000')

const fixture = path => new URL(`../fixtures/${path}`, import.meta.url)

/**
 * These tests verify that endpoints accept numeric project IDs (in addition to ObjectId strings).
 * This is needed for v1 history projects which use numeric project IDs.
 */
describe('NumericProjectId', function () {
  beforeEach(async function () {
    await ProjectHistoryApp.ensureRunning()

    // Use a numeric project ID (simulating v1 history projects)
    this.numericProjectId = 123456

    MockHistoryStore().post('/api/projects').reply(200, {
      projectId: this.numericProjectId,
    })

    const olProject = await ProjectHistoryClient.initializeProject(
      this.numericProjectId
    )
    this.historyId = olProject.id

    MockWeb()
      .get(`/project/${this.numericProjectId}/details`)
      .reply(200, {
        name: 'Test Project',
        overleaf: { history: { id: this.historyId } },
      })
      .persist()

    MockHistoryStore()
      .get(`/api/projects/${this.historyId}/latest/history`)
      .replyWithFile(200, fixture('chunks/7-8.json'))
      .persist()

    MockHistoryStore()
      .get(`/api/projects/${this.historyId}/versions/7/history`)
      .replyWithFile(200, fixture('chunks/7-8.json'))
      .persist()

    MockHistoryStore()
      .get(`/api/projects/${this.historyId}/versions/8/history`)
      .replyWithFile(200, fixture('chunks/7-8.json'))
      .persist()
  })

  afterEach(function () {
    nock.cleanAll()
  })

  function makeRequest(options) {
    return new Promise((resolve, reject) => {
      request(options, (error, response, body) => {
        if (error) return reject(error)
        resolve({ response, body })
      })
    })
  }

  it('should accept numeric project_id for flush', async function () {
    const { response } = await makeRequest({
      method: 'POST',
      url: `http://127.0.0.1:3054/project/${this.numericProjectId}/flush`,
    })
    expect(response.statusCode).to.equal(204)
  })

  it('should accept numeric project_id for dump', async function () {
    const { response } = await makeRequest({
      method: 'GET',
      url: `http://127.0.0.1:3054/project/${this.numericProjectId}/dump`,
    })
    expect(response.statusCode).to.equal(200)
  })

  it('should accept numeric project_id for filetree diff', async function () {
    const { response } = await makeRequest({
      method: 'GET',
      url: `http://127.0.0.1:3054/project/${this.numericProjectId}/filetree/diff`,
      qs: { from: 7, to: 8 },
    })
    expect(response.statusCode).to.equal(200)
  })

  it('should accept numeric project_id for updates', async function () {
    const { response } = await makeRequest({
      method: 'GET',
      url: `http://127.0.0.1:3054/project/${this.numericProjectId}/updates`,
      qs: { min_count: 1 },
    })
    expect(response.statusCode).to.equal(200)
  })

  it('should accept numeric project_id for version', async function () {
    const { response } = await makeRequest({
      method: 'GET',
      url: `http://127.0.0.1:3054/project/${this.numericProjectId}/version`,
    })
    expect(response.statusCode).to.equal(200)
  })

  it('should accept numeric project_id for snapshot', async function () {
    const { response } = await makeRequest({
      method: 'GET',
      url: `http://127.0.0.1:3054/project/${this.numericProjectId}/snapshot`,
    })
    expect(response.statusCode).to.equal(200)
  })

  it('should accept numeric project_id for getLabels', async function () {
    const { response } = await makeRequest({
      method: 'GET',
      url: `http://127.0.0.1:3054/project/${this.numericProjectId}/labels`,
    })
    expect(response.statusCode).to.equal(200)
  })

  it('should accept numeric project_id for createLabel', async function () {
    const { response } = await makeRequest({
      method: 'POST',
      url: `http://127.0.0.1:3054/project/${this.numericProjectId}/labels`,
      json: {
        comment: 'test label',
        version: 7,
        user_id: '507f1f77bcf86cd799439011',
      },
    })
    expect(response.statusCode).to.equal(200)
  })

  it('should accept numeric history_id for getProjectBlob', async function () {
    const blobHash = 'a'.repeat(40)
    const blobContent = 'test blob content'

    MockHistoryStore()
      .get(`/api/projects/${this.historyId}/blobs/${blobHash}`)
      .reply(200, blobContent)

    const { response, body } = await makeRequest({
      method: 'GET',
      url: `http://127.0.0.1:3054/project/${this.historyId}/blob/${blobHash}`,
    })
    expect(response.statusCode).to.equal(200)
    expect(body).to.equal(blobContent)
  })
})
