import { expect } from 'chai'
import mongodb from 'mongodb-legacy'
import nock from 'nock'
import * as ProjectHistoryClient from './helpers/ProjectHistoryClient.js'
import * as ProjectHistoryApp from './helpers/ProjectHistoryApp.js'
const { ObjectId } = mongodb

const MockHistoryStore = () => nock('http://127.0.0.1:3100')
const MockWeb = () => nock('http://127.0.0.1:3000')

describe('DebugInfo', function () {
  beforeEach(async function () {
    await ProjectHistoryApp.ensureRunning()

    this.historyId = new ObjectId().toString()
    this.projectId = new ObjectId().toString()

    MockHistoryStore().post('/api/projects').reply(200, {
      projectId: this.historyId,
    })
    MockWeb()
      .get(`/project/${this.projectId}/details`)
      .reply(200, {
        name: 'Test Project',
        overleaf: { history: { id: this.historyId } },
      })
    await ProjectHistoryClient.initializeProject(this.historyId)
  })

  afterEach(function () {
    nock.cleanAll()
  })

  describe('getDebugInfo', function () {
    it('should return the sync state and failure record for a project', async function () {
      const info = await ProjectHistoryClient.getDebugInfo(this.projectId)
      expect(info.failureRecord).to.be.null
      expect(info.syncState.resyncPending).to.equal(false)
      expect(info.syncState.resyncCount).to.equal(0)
    })
  })

  describe('forceDebugProject', function () {
    it('should set the forceDebug flag and return the failure record', async function () {
      const result = await ProjectHistoryClient.forceDebugProject(
        this.projectId
      )
      expect(result.forceDebug).to.equal(true)
    })

    it('should clear the forceDebug flag when clear=true', async function () {
      await ProjectHistoryClient.forceDebugProject(this.projectId)
      const result = await ProjectHistoryClient.forceDebugProject(
        this.projectId,
        { clear: true }
      )
      expect(result.forceDebug).to.equal(false)
    })
  })
})

describe('Status', function () {
  beforeEach(async function () {
    await ProjectHistoryApp.ensureRunning()
  })

  describe('getQueueCounts', function () {
    it('should return the count of queued projects', async function () {
      const counts = await ProjectHistoryClient.getQueueCounts()
      expect(counts).to.have.property('queuedProjects')
    })
  })

  describe('getFailuresFull', function () {
    it('should return the full failure records', async function () {
      const projectId = new ObjectId().toString()
      await ProjectHistoryClient.setFailures([
        { project_id: projectId, attempts: 1, error: 'Error: some-error' },
      ])
      const failures = await ProjectHistoryClient.getFailuresFull()
      expect(failures).to.be.an('array')
      const failure = failures.find(f => f.project_id === projectId)
      expect(failure).to.include({ project_id: projectId, attempts: 1 })
    })
  })
})
