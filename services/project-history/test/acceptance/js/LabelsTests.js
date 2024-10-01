import { expect } from 'chai'
import mongodb from 'mongodb-legacy'
import nock from 'nock'
import * as ProjectHistoryClient from './helpers/ProjectHistoryClient.js'
import * as ProjectHistoryApp from './helpers/ProjectHistoryApp.js'
const { ObjectId } = mongodb

const MockHistoryStore = () => nock('http://127.0.0.1:3100')
const MockWeb = () => nock('http://127.0.0.1:3000')

const fixture = path => new URL(`../fixtures/${path}`, import.meta.url)

describe('Labels', function () {
  beforeEach(function (done) {
    ProjectHistoryApp.ensureRunning(error => {
      if (error != null) {
        throw error
      }

      this.historyId = new ObjectId().toString()
      MockHistoryStore().post('/api/projects').reply(200, {
        projectId: this.historyId,
      })

      ProjectHistoryClient.initializeProject(
        this.historyId,
        (error, olProject) => {
          if (error != null) {
            throw error
          }
          this.project_id = new ObjectId().toString()
          MockWeb()
            .get(`/project/${this.project_id}/details`)
            .reply(200, {
              name: 'Test Project',
              overleaf: { history: { id: olProject.id } },
            })

          MockHistoryStore()
            .get(`/api/projects/${this.historyId}/latest/history`)
            .replyWithFile(200, fixture('chunks/7-8.json'))

          MockHistoryStore()
            .get(`/api/projects/${this.historyId}/versions/7/history`)
            .replyWithFile(200, fixture('chunks/7-8.json'))
            .persist()
          MockHistoryStore()
            .get(`/api/projects/${this.historyId}/versions/8/history`)
            .replyWithFile(200, fixture('chunks/7-8.json'))
            .persist()

          this.comment = 'a saved version comment'
          this.comment2 = 'another saved version comment'
          this.user_id = new ObjectId().toString()
          this.created_at = new Date(1)
          done()
        }
      )
    })
  })

  afterEach(function () {
    nock.cleanAll()
  })

  it('can create and get labels', function (done) {
    ProjectHistoryClient.createLabel(
      this.project_id,
      this.user_id,
      7,
      this.comment,
      this.created_at,
      (error, label) => {
        if (error != null) {
          throw error
        }
        ProjectHistoryClient.getLabels(this.project_id, (error, labels) => {
          if (error != null) {
            throw error
          }
          expect(labels).to.deep.equal([label])
          done()
        })
      }
    )
  })

  it('can create and get labels with no user id', function (done) {
    const userId = undefined
    ProjectHistoryClient.createLabel(
      this.project_id,
      userId,
      7,
      this.comment,
      this.created_at,
      (error, label) => {
        if (error != null) {
          throw error
        }
        ProjectHistoryClient.getLabels(this.project_id, (error, labels) => {
          if (error != null) {
            throw error
          }
          expect(labels).to.deep.equal([label])
          done()
        })
      }
    )
  })

  it('can delete labels', function (done) {
    ProjectHistoryClient.createLabel(
      this.project_id,
      this.user_id,
      7,
      this.comment,
      this.created_at,
      (error, label) => {
        if (error != null) {
          throw error
        }
        ProjectHistoryClient.deleteLabel(this.project_id, label.id, error => {
          if (error != null) {
            throw error
          }
          ProjectHistoryClient.getLabels(this.project_id, (error, labels) => {
            if (error != null) {
              throw error
            }
            expect(labels).to.deep.equal([])
            done()
          })
        })
      }
    )
  })

  it('can delete labels for the current user', function (done) {
    ProjectHistoryClient.createLabel(
      this.project_id,
      this.user_id,
      7,
      this.comment,
      this.created_at,
      (error, label) => {
        if (error != null) {
          throw error
        }
        ProjectHistoryClient.deleteLabelForUser(
          this.project_id,
          this.user_id,
          label.id,
          error => {
            if (error != null) {
              throw error
            }
            ProjectHistoryClient.getLabels(this.project_id, (error, labels) => {
              if (error != null) {
                throw error
              }
              expect(labels).to.deep.equal([])
              done()
            })
          }
        )
      }
    )
  })

  it('can transfer ownership of labels', function (done) {
    const fromUser = new ObjectId().toString()
    const toUser = new ObjectId().toString()
    ProjectHistoryClient.createLabel(
      this.project_id,
      fromUser,
      7,
      this.comment,
      this.created_at,
      (error, label) => {
        if (error != null) {
          throw error
        }
        ProjectHistoryClient.createLabel(
          this.project_id,
          fromUser,
          7,
          this.comment2,
          this.created_at,
          (error, label2) => {
            if (error != null) {
              throw error
            }
            ProjectHistoryClient.transferLabelOwnership(
              fromUser,
              toUser,
              error => {
                if (error != null) {
                  throw error
                }
                ProjectHistoryClient.getLabels(
                  this.project_id,
                  (error, labels) => {
                    if (error != null) {
                      throw error
                    }
                    expect(labels).to.deep.equal([
                      {
                        id: label.id,
                        comment: label.comment,
                        version: label.version,
                        created_at: label.created_at,
                        user_id: toUser,
                      },
                      {
                        id: label2.id,
                        comment: label2.comment,
                        version: label2.version,
                        created_at: label2.created_at,
                        user_id: toUser,
                      },
                    ])
                    done()
                  }
                )
              }
            )
          }
        )
      }
    )
  })

  it('should return labels with summarized updates', function (done) {
    ProjectHistoryClient.createLabel(
      this.project_id,
      this.user_id,
      8,
      this.comment,
      this.created_at,
      (error, label) => {
        if (error != null) {
          throw error
        }
        ProjectHistoryClient.getSummarizedUpdates(
          this.project_id,
          { min_count: 1 },
          (error, updates) => {
            if (error != null) {
              throw error
            }
            expect(updates).to.deep.equal({
              nextBeforeTimestamp: 6,
              updates: [
                {
                  fromV: 6,
                  toV: 8,
                  meta: {
                    users: ['5a5637efdac84e81b71014c4', 31],
                    start_ts: 1512383567277,
                    end_ts: 1512383572877,
                  },
                  pathnames: ['bar.tex', 'main.tex'],
                  project_ops: [],
                  labels: [
                    {
                      id: label.id.toString(),
                      comment: this.comment,
                      version: 8,
                      user_id: this.user_id,
                      created_at: this.created_at.toISOString(),
                    },
                  ],
                },
              ],
            })
            done()
          }
        )
      }
    )
  })
})
