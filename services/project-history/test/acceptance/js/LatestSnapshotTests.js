import { expect } from 'chai'
import mongodb from 'mongodb-legacy'
import nock from 'nock'
import * as ProjectHistoryClient from './helpers/ProjectHistoryClient.js'
import * as ProjectHistoryApp from './helpers/ProjectHistoryApp.js'
const { ObjectId } = mongodb

const MockHistoryStore = () => nock('http://127.0.0.1:3100')
const MockWeb = () => nock('http://127.0.0.1:3000')

const fixture = path => new URL(`../fixtures/${path}`, import.meta.url)

describe('LatestSnapshot', function () {
  beforeEach(function (done) {
    ProjectHistoryApp.ensureRunning(error => {
      if (error) {
        throw error
      }

      this.historyId = new ObjectId().toString()
      MockHistoryStore().post('/api/projects').reply(200, {
        projectId: this.historyId,
      })

      ProjectHistoryClient.initializeProject(
        this.historyId,
        (error, v1Project) => {
          if (error) {
            throw error
          }
          this.projectId = new ObjectId().toString()
          MockWeb()
            .get(`/project/${this.projectId}/details`)
            .reply(200, {
              name: 'Test Project',
              overleaf: { history: { id: v1Project.id } },
            })
          done()
        }
      )
    })
  })

  afterEach(function () {
    nock.cleanAll()
  })

  it('should return the snapshot with applied changes, metadata and without full content', function (done) {
    MockHistoryStore()
      .get(`/api/projects/${this.historyId}/latest/history`)
      .replyWithFile(200, fixture('chunks/0-3.json'))

    ProjectHistoryClient.getLatestSnapshot(this.projectId, (error, body) => {
      if (error) {
        throw error
      }
      expect(body).to.deep.equal({
        snapshot: {
          files: {
            'main.tex': {
              hash: 'f28571f561d198b87c24cc6a98b78e87b665e22d',
              stringLength: 20649,
              operations: [{ textOperation: [1912, 'Hello world', 18726] }],
              metadata: { main: true },
            },
            'foo.tex': {
              hash: '4f785a4c192155b240e3042b3a7388b47603f423',
              stringLength: 41,
              operations: [{ textOperation: [26, '\n\nFour five six'] }],
            },
          },
        },
        version: 3,
      })
      done()
    })
  })
})
