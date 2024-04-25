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
  beforeEach(function (done) {
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
    ProjectHistoryApp.ensureRunning(done)
  })

  describe('when the project has no pending updates', function (done) {
    it('successfully deletes the project', function (done) {
      ProjectHistoryClient.deleteProject(this.projectId, done)
    })
  })

  describe('when the project has pending updates', function (done) {
    beforeEach(function (done) {
      ProjectHistoryClient.pushRawUpdate(
        this.projectId,
        {
          pathname: '/main.tex',
          docLines: 'hello',
          doc: this.docId,
          meta: { userId: this.userId, ts: new Date() },
        },
        err => {
          if (err) {
            return done(err)
          }
          ProjectHistoryClient.setFirstOpTimestamp(
            this.projectId,
            Date.now(),
            err => {
              if (err) {
                return done(err)
              }
              ProjectHistoryClient.deleteProject(this.projectId, done)
            }
          )
        }
      )
    })

    it('clears pending updates', function (done) {
      ProjectHistoryClient.getDump(this.projectId, (err, dump) => {
        if (err) {
          return done(err)
        }
        expect(dump.updates).to.deep.equal([])
        done()
      })
    })

    it('clears the first op timestamp', function (done) {
      ProjectHistoryClient.getFirstOpTimestamp(this.projectId, (err, ts) => {
        if (err) {
          return done(err)
        }
        expect(ts).to.be.null
        done()
      })
    })
  })
})
