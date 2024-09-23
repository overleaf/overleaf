import { expect } from 'chai'
import mongodb from 'mongodb-legacy'
import nock from 'nock'
import Core from 'overleaf-editor-core'
import * as ProjectHistoryClient from './helpers/ProjectHistoryClient.js'
import * as ProjectHistoryApp from './helpers/ProjectHistoryApp.js'
import latestChunk from '../fixtures/chunks/7-8.json' with { type: 'json' }
import previousChunk from '../fixtures/chunks/4-6.json' with { type: 'json' }
import firstChunk from '../fixtures/chunks/0-3.json' with { type: 'json' }
const { ObjectId } = mongodb

const MockHistoryStore = () => nock('http://127.0.0.1:3100')
const MockWeb = () => nock('http://127.0.0.1:3000')

const fixture = path => new URL(`../fixtures/${path}`, import.meta.url)

describe('GetChangesInChunkSince', function () {
  let projectId, historyId
  beforeEach(function (done) {
    projectId = new ObjectId().toString()
    historyId = new ObjectId().toString()
    ProjectHistoryApp.ensureRunning(error => {
      if (error) throw error

      MockHistoryStore().post('/api/projects').reply(200, {
        projectId: historyId,
      })

      ProjectHistoryClient.initializeProject(historyId, (error, olProject) => {
        if (error) throw error
        MockWeb()
          .get(`/project/${projectId}/details`)
          .reply(200, {
            name: 'Test Project',
            overleaf: { history: { id: olProject.id } },
          })

        MockHistoryStore()
          .get(`/api/projects/${historyId}/latest/history`)
          .replyWithFile(200, fixture('chunks/7-8.json'))
        MockHistoryStore()
          .get(`/api/projects/${historyId}/versions/7/history`)
          .replyWithFile(200, fixture('chunks/7-8.json'))
        MockHistoryStore()
          .get(`/api/projects/${historyId}/versions/6/history`)
          .replyWithFile(200, fixture('chunks/7-8.json'))
        MockHistoryStore()
          .get(`/api/projects/${historyId}/versions/5/history`)
          .replyWithFile(200, fixture('chunks/4-6.json'))
        MockHistoryStore()
          .get(`/api/projects/${historyId}/versions/4/history`)
          .replyWithFile(200, fixture('chunks/4-6.json'))
        MockHistoryStore()
          .get(`/api/projects/${historyId}/versions/3/history`)
          .replyWithFile(200, fixture('chunks/4-6.json'))
        MockHistoryStore()
          .get(`/api/projects/${historyId}/versions/2/history`)
          .replyWithFile(200, fixture('chunks/0-3.json'))
        MockHistoryStore()
          .get(`/api/projects/${historyId}/versions/1/history`)
          .replyWithFile(200, fixture('chunks/0-3.json'))
        MockHistoryStore()
          .get(`/api/projects/${historyId}/versions/0/history`)
          .replyWithFile(200, fixture('chunks/0-3.json'))

        done()
      })
    })
  })

  afterEach(function () {
    nock.cleanAll()
  })

  function expectChangesSince(version, n, changes, done) {
    ProjectHistoryClient.getChangesInChunkSince(
      projectId,
      version,
      {},
      (error, got) => {
        if (error) throw error
        expect(got.latestStartVersion).to.equal(6)
        expect(got.changes).to.have.length(n)
        expect(got.changes.map(c => Core.Change.fromRaw(c))).to.deep.equal(
          changes.map(c => Core.Change.fromRaw(c))
        )
        done()
      }
    )
  }

  const cases = {
    8: {
      name: 'when up-to-date, return zero changes',
      n: 0,
      changes: [],
    },
    7: {
      name: 'when one version behind, return one change',
      n: 1,
      changes: latestChunk.chunk.history.changes.slice(1),
    },
    6: {
      name: 'when at current chunk boundary, return latest chunk in full',
      n: 2,
      changes: latestChunk.chunk.history.changes,
    },
    5: {
      name: 'when one version behind last chunk, return one change',
      n: 1,
      changes: previousChunk.chunk.history.changes.slice(2),
    },
    4: {
      name: 'when in last chunk, return two changes',
      n: 2,
      changes: previousChunk.chunk.history.changes.slice(1),
    },
    3: {
      name: 'when at previous chunk boundary, return just the previous chunk',
      n: 3,
      changes: previousChunk.chunk.history.changes,
    },
    2: {
      name: 'when at end of first chunk, return one change',
      n: 1,
      changes: firstChunk.chunk.history.changes.slice(2),
    },
    1: {
      name: 'when in first chunk, return two changes',
      n: 2,
      changes: firstChunk.chunk.history.changes.slice(1),
    },
    0: {
      name: 'when from zero, return just the first chunk',
      n: 3,
      changes: firstChunk.chunk.history.changes,
    },
  }

  for (const [since, { name, n, changes }] of Object.entries(cases)) {
    it(name, function (done) {
      expectChangesSince(since, n, changes, done)
    })
  }

  it('should return an error when past the end version', function (done) {
    ProjectHistoryClient.getChangesInChunkSince(
      projectId,
      9,
      { allowErrors: true },
      (error, _body, statusCode) => {
        if (error) throw error
        expect(statusCode).to.equal(400)
        done()
      }
    )
  })
})
