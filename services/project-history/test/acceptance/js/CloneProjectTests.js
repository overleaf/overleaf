import { expect } from 'chai'
import mongodb from 'mongodb-legacy'
import nock from 'nock'
import { expectValidationError } from '@overleaf/validation-tools/testUtils.js'
import * as ProjectHistoryClient from './helpers/ProjectHistoryClient.js'
import * as ProjectHistoryApp from './helpers/ProjectHistoryApp.js'
const { ObjectId } = mongodb

const MockHistoryStore = () => nock('http://127.0.0.1:3100')
const MockWeb = () => nock('http://127.0.0.1:3000')

describe('CloneProject', function () {
  beforeEach(async function () {
    await ProjectHistoryApp.ensureRunning()

    this.sourceProjectId = new ObjectId().toString()
    this.targetProjectId = new ObjectId().toString()
    this.sourceHistoryId = new ObjectId().toString()
    this.targetHistoryId = new ObjectId().toString()

    MockHistoryStore().post('/api/projects').reply(200, {
      projectId: this.sourceHistoryId,
    })
    await ProjectHistoryClient.initializeProject(this.sourceHistoryId)

    MockWeb()
      .get(`/project/${this.sourceProjectId}/details`)
      .reply(200, {
        name: 'Source Project',
        overleaf: { history: { id: this.sourceHistoryId } },
      })
    MockWeb()
      .get(`/project/${this.targetProjectId}/details`)
      .reply(200, {
        name: 'Target Project',
        overleaf: { history: { id: this.targetHistoryId } },
      })
  })

  afterEach(function () {
    nock.cleanAll()
  })

  it('should reject a malformed source project id', async function () {
    let err
    try {
      await ProjectHistoryClient.cloneProject(
        'not-a-valid-id',
        this.targetProjectId
      )
      expect.fail('should have thrown')
    } catch (error) {
      err = error
    }
    expectValidationError(err, 404, 'project_id')
  })

  it('should reject a request missing targetProjectId', async function () {
    let err
    try {
      await ProjectHistoryClient.cloneProject(this.sourceProjectId, undefined)
      expect.fail('should have thrown')
    } catch (error) {
      err = error
    }
    expectValidationError(err, 400, 'targetProjectId')
  })

  it('should clone the project history data', async function () {
    MockHistoryStore()
      .post(`/api/projects/${this.sourceHistoryId}/clone`, {
        targetProjectId: this.targetHistoryId,
      })
      .reply(200, '')

    const { response, body } = await ProjectHistoryClient.cloneProject(
      this.sourceProjectId,
      this.targetProjectId
    )
    expect(response.status).to.equal(200)
    expect(body).to.include('done')
  })
})
