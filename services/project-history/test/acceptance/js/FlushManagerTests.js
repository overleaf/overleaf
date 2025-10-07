import nock from 'nock'
import { expect } from 'chai'
import { fetchNothing, fetchJsonWithResponse } from '@overleaf/fetch-utils'
import assert from 'node:assert'
import mongodb from 'mongodb-legacy'
import * as ProjectHistoryClient from './helpers/ProjectHistoryClient.js'
import * as ProjectHistoryApp from './helpers/ProjectHistoryApp.js'
import Settings from '@overleaf/settings'
const { ObjectId } = mongodb

const MockHistoryStore = () => nock('http://127.0.0.1:3100')
const MockWeb = () => nock('http://127.0.0.1:3000')

describe('Flushing old queues', function () {
  const historyId = new ObjectId().toString()

  beforeEach(async function () {
    this.timestamp = new Date()

    await ProjectHistoryApp.ensureRunning()
    this.projectId = new ObjectId().toString()
    this.docId = new ObjectId().toString()
    this.fileId = new ObjectId().toString()

    MockHistoryStore().post('/api/projects').reply(200, {
      projectId: historyId,
    })
    MockWeb()
      .get(`/project/${this.projectId}/details`)
      .reply(200, {
        name: 'Test Project',
        overleaf: {
          history: {
            id: historyId,
          },
        },
      })
    MockHistoryStore()
      .get(`/api/projects/${historyId}/latest/history`)
      .reply(200, {
        chunk: {
          startVersion: 0,
          history: {
            changes: [],
          },
        },
      })
    await ProjectHistoryClient.initializeProject(historyId)
  })

  afterEach(function () {
    nock.cleanAll()
  })

  describe('retrying an unflushed project', function () {
    describe('when the update is older than the cutoff', function () {
      beforeEach(async function () {
        this.flushCall = MockHistoryStore()
          .put(
            `/api/projects/${historyId}/blobs/0a207c060e61f3b88eaee0a8cd0696f46fb155eb`
          )
          .reply(201)
          .post(`/api/projects/${historyId}/legacy_changes?end_version=0`)
          .reply(200)
        const update = {
          pathname: '/main.tex',
          docLines: 'a\nb',
          doc: this.docId,
          meta: { user_id: this.user_id, ts: new Date() },
        }
        await ProjectHistoryClient.pushRawUpdate(this.projectId, update)
        await ProjectHistoryClient.setFirstOpTimestamp(
          this.projectId,
          Date.now() - 24 * 3600 * 1000
        )
      })

      it('flushes the project history queue', async function () {
        const response = await fetchNothing(
          'http://127.0.0.1:3054/flush/old?maxAge=10800',
          {
            method: 'POST',
          }
        )
        expect(response.status).to.equal(200)
        assert(
          this.flushCall.isDone(),
          'made calls to history service to store updates'
        )
      })

      it('flushes the project history queue in the background when requested', async function () {
        const { json, response } = await fetchJsonWithResponse(
          'http://127.0.0.1:3054/flush/old?maxAge=10800&background=1',
          {
            method: 'POST',
          }
        )
        expect(response.status).to.equal(200)
        expect(json).to.deep.equal({
          message: 'running flush in background',
        })
        assert(
          !this.flushCall.isDone(),
          'did not make calls to history service to store updates in the foreground'
        )

        await new Promise(resolve => setTimeout(resolve, 1000))
        assert(
          this.flushCall.isDone(),
          'made calls to history service to store updates in the background'
        )
      })
    })

    describe('when the update is newer than the cutoff', function () {
      beforeEach(async function () {
        this.flushCall = MockHistoryStore()
          .put(
            `/api/projects/${historyId}/blobs/0a207c060e61f3b88eaee0a8cd0696f46fb155eb`
          )
          .reply(201)
          .post(`/api/projects/${historyId}/legacy_changes?end_version=0`)
          .reply(200)
        const update = {
          pathname: '/main.tex',
          docLines: 'a\nb',
          doc: this.docId,
          meta: { user_id: this.user_id, ts: new Date() },
        }
        await ProjectHistoryClient.pushRawUpdate(this.projectId, update)
        await ProjectHistoryClient.setFirstOpTimestamp(
          this.projectId,
          Date.now() - 60 * 1000
        )
      })

      it('does not flush the project history queue', async function () {
        const response = await fetchNothing(
          `http://127.0.0.1:3054/flush/old?maxAge=${3 * 3600}`,
          {
            method: 'POST',
          }
        )
        expect(response.status).to.equal(200)
        assert(
          !this.flushCall.isDone(),
          'did not make calls to history service to store updates'
        )
      })
    })

    describe('when the update is newer than the cutoff and project has short queue', function () {
      beforeEach(function () {
        Settings.shortHistoryQueues.push(this.projectId)
      })
      afterEach(function () {
        Settings.shortHistoryQueues.length = 0
      })
      beforeEach(async function () {
        this.flushCall = MockHistoryStore()
          .put(
            `/api/projects/${historyId}/blobs/0a207c060e61f3b88eaee0a8cd0696f46fb155eb`
          )
          .reply(201)
          .post(`/api/projects/${historyId}/legacy_changes?end_version=0`)
          .reply(200)
        const update = {
          pathname: '/main.tex',
          docLines: 'a\nb',
          doc: this.docId,
          meta: { user_id: this.user_id, ts: new Date() },
        }
        await ProjectHistoryClient.pushRawUpdate(this.projectId, update)
        await ProjectHistoryClient.setFirstOpTimestamp(
          this.projectId,
          Date.now() - 60 * 1000
        )
      })

      it('flushes the project history queue', async function () {
        const response = await fetchNothing(
          `http://127.0.0.1:3054/flush/old?maxAge=${3 * 3600}`,
          {
            method: 'POST',
          }
        )
        expect(response.status).to.equal(200)
        assert(
          this.flushCall.isDone(),
          'made calls to history service to store updates'
        )
      })

      it('flushes the project history queue in the background when requested', async function () {
        const { json, response } = await fetchJsonWithResponse(
          `http://127.0.0.1:3054/flush/old?maxAge=${3 * 3600}&background=1`,
          {
            method: 'POST',
          }
        )
        expect(response.status).to.equal(200)
        expect(json).to.deep.equal({
          message: 'running flush in background',
        })
        assert(
          !this.flushCall.isDone(),
          'did not make calls to history service to store updates in the foreground'
        )

        await new Promise(resolve => setTimeout(resolve, 1000))
        assert(
          this.flushCall.isDone(),
          'made calls to history service to store updates in the background'
        )
      })
    })

    describe('when the update does not have a timestamp', function () {
      beforeEach(async function () {
        this.flushCall = MockHistoryStore()
          .put(
            `/api/projects/${historyId}/blobs/0a207c060e61f3b88eaee0a8cd0696f46fb155eb`
          )
          .reply(201)
          .post(`/api/projects/${historyId}/legacy_changes?end_version=0`)
          .reply(200)
        const update = {
          pathname: '/main.tex',
          docLines: 'a\nb',
          doc: this.docId,
          meta: { user_id: this.user_id, ts: new Date() },
        }
        this.startDate = Date.now()
        await ProjectHistoryClient.pushRawUpdate(this.projectId, update)
        await ProjectHistoryClient.clearFirstOpTimestamp(this.projectId)
      })

      it('flushes the project history queue anyway', async function () {
        const response = await fetchNothing(
          `http://127.0.0.1:3054/flush/old?maxAge=${3 * 3600}`,
          {
            method: 'POST',
          }
        )
        expect(response.status).to.equal(200)
        assert(
          this.flushCall.isDone(),
          'made calls to history service to store updates'
        )

        const result = await ProjectHistoryClient.getFirstOpTimestamp(
          this.projectId
        )
        expect(result).to.be.null
      })
    })
  })
})
