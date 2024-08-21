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

describe('GetChangesSince', function () {
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
          .get(`/api/projects/${historyId}/versions/6/history`)
          .replyWithFile(200, fixture('chunks/4-6.json'))
        MockHistoryStore()
          .get(`/api/projects/${historyId}/versions/3/history`)
          .replyWithFile(200, fixture('chunks/0-3.json'))

        done()
      })
    })
  })

  afterEach(function () {
    nock.cleanAll()
  })

  function expectChangesSince(version, changes, done) {
    ProjectHistoryClient.getChangesSince(
      projectId,
      version,
      {},
      (error, got) => {
        if (error) throw error
        expect(got.map(c => Core.Change.fromRaw(c))).to.deep.equal(
          changes.map(c => Core.Change.fromRaw(c))
        )
        done()
      }
    )
  }

  it('should return zero changes since the latest version', function (done) {
    expectChangesSince(8, [], done)
  })

  it('should return one change when behind one version', function (done) {
    expectChangesSince(7, [latestChunk.chunk.history.changes[1]], done)
  })

  it('should return changes when at the chunk boundary', function (done) {
    expect(latestChunk.chunk.startVersion).to.equal(6)
    expectChangesSince(6, latestChunk.chunk.history.changes, done)
  })

  it('should return changes spanning multiple chunks', function (done) {
    expectChangesSince(
      1,
      [
        ...firstChunk.chunk.history.changes.slice(1),
        ...previousChunk.chunk.history.changes,
        ...latestChunk.chunk.history.changes,
      ],
      done
    )
  })

  it('should return all changes when going back to the beginning', function (done) {
    expectChangesSince(
      0,
      [
        ...firstChunk.chunk.history.changes,
        ...previousChunk.chunk.history.changes,
        ...latestChunk.chunk.history.changes,
      ],
      done
    )
  })

  it('should return an error when past the end version', function (done) {
    ProjectHistoryClient.getChangesSince(
      projectId,
      9,
      { allowErrors: true },
      (error, body, statusCode) => {
        if (error) throw error
        expect(statusCode).to.equal(500)
        expect(body).to.deep.equal({ message: 'an internal error occurred' })
        done()
      }
    )
  })
})
