import nock from 'nock'
import { expect } from 'chai'
import { fetchStringWithResponse } from '@overleaf/fetch-utils'
import assert from 'node:assert'
import mongodb from 'mongodb-legacy'
import * as ProjectHistoryClient from './helpers/ProjectHistoryClient.js'
import * as ProjectHistoryApp from './helpers/ProjectHistoryApp.js'
const { ObjectId } = mongodb

const MockHistoryStore = () => nock('http://127.0.0.1:3100')
const MockWeb = () => nock('http://127.0.0.1:3000')

const MockCallback = () => nock('http://127.0.0.1')

describe('Retrying failed projects', function () {
  const historyId = new ObjectId().toString()

  beforeEach(async function () {
    this.timestamp = new Date()

    await ProjectHistoryApp.ensureRunning()

    this.project_id = new ObjectId().toString()
    this.doc_id = new ObjectId().toString()
    this.file_id = new ObjectId().toString()

    MockHistoryStore().post('/api/projects').reply(200, {
      projectId: historyId,
    })
    MockWeb()
      .get(`/project/${this.project_id}/details`)
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

  describe('retrying project history', function () {
    describe('when there is a soft failure', function () {
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
          doc: this.doc_id,
          meta: { user_id: this.user_id, ts: new Date() },
        }

        await ProjectHistoryClient.pushRawUpdate(this.project_id, update)
        await ProjectHistoryClient.setFailure({
          project_id: this.project_id,
          attempts: 1,
          error: 'soft-error',
        })
      })

      it('flushes the project history queue', async function () {
        const { response } = await fetchStringWithResponse(
          'http://127.0.0.1:3054/retry/failures?failureType=soft&limit=1&timeout=10000',
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

      it('retries in the background when requested', async function () {
        this.callback = MockCallback()
          .matchHeader('Authorization', '123')
          .get('/ping')
          .reply(200)

        const { body, response } = await fetchStringWithResponse(
          'http://127.0.0.1:3054/retry/failures?failureType=soft&limit=1&timeout=10000&callbackUrl=http%3A%2F%2F127.0.0.1%2Fping',
          {
            method: 'POST',
            headers: {
              'X-CALLBACK-Authorization': '123',
            },
          }
        )

        expect(response.status).to.equal(200)
        expect(body).to.equal(
          '{"retryStatus":"running retryFailures in background"}'
        )
        assert(
          !this.flushCall.isDone(),
          'did not make calls to history service to store updates in the foreground'
        )

        await new Promise(resolve => setTimeout(resolve, 100))

        assert(
          this.flushCall.isDone(),
          'made calls to history service to store updates in the background'
        )
        assert(this.callback.isDone(), 'hit the callback url')
      })
    })

    describe('when there is a hard failure', function () {
      beforeEach(async function () {
        MockWeb()
          .get(`/project/${this.project_id}/details`)
          .reply(200, {
            name: 'Test Project',
            overleaf: {
              history: {
                id: historyId,
              },
            },
          })
        await ProjectHistoryClient.setFailure({
          project_id: this.project_id,
          attempts: 100,
          error: 'hard-error',
        })
      })

      it('calls web to resync the project', async function () {
        const resyncCall = MockWeb()
          .post(`/project/${this.project_id}/history/resync`)
          .reply(200)

        const { response } = await fetchStringWithResponse(
          'http://127.0.0.1:3054/retry/failures?failureType=hard&limit=1&timeout=10000',
          {
            method: 'POST',
          }
        )

        expect(response.status).to.equal(200)
        assert(resyncCall.isDone(), 'made a call to web to resync project')
      })
    })
  })
})
