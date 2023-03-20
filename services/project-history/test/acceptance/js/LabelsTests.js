/* eslint-disable
    no-undef,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
import sinon from 'sinon'
import { expect } from 'chai'
import Settings from '@overleaf/settings'
import { ObjectId } from 'mongodb'
import nock from 'nock'
import * as ProjectHistoryClient from './helpers/ProjectHistoryClient.js'
import * as ProjectHistoryApp from './helpers/ProjectHistoryApp.js'

const MockHistoryStore = () => nock('http://localhost:3100')
const MockFileStore = () => nock('http://localhost:3009')
const MockWeb = () => nock('http://localhost:3000')

const fixture = path => new URL(`../fixtures/${path}`, import.meta.url)

describe('Labels', function () {
  beforeEach(function (done) {
    return ProjectHistoryApp.ensureRunning(error => {
      if (error != null) {
        throw error
      }

      this.historyId = ObjectId().toString()
      MockHistoryStore().post('/api/projects').reply(200, {
        projectId: this.historyId,
      })

      return ProjectHistoryClient.initializeProject(
        this.historyId,
        (error, olProject) => {
          if (error != null) {
            throw error
          }
          this.project_id = ObjectId().toString()
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
          this.user_id = ObjectId().toString()
          this.created_at = new Date(1)
          return done()
        }
      )
    })
  })

  afterEach(function () {
    return nock.cleanAll()
  })

  it('can create and get labels', function (done) {
    return ProjectHistoryClient.createLabel(
      this.project_id,
      this.user_id,
      7,
      this.comment,
      this.created_at,
      (error, label) => {
        if (error != null) {
          throw error
        }
        return ProjectHistoryClient.getLabels(
          this.project_id,
          (error, labels) => {
            if (error != null) {
              throw error
            }
            expect(labels).to.deep.equal([label])
            return done()
          }
        )
      }
    )
  })

  it('can delete labels', function (done) {
    return ProjectHistoryClient.createLabel(
      this.project_id,
      this.user_id,
      7,
      this.comment,
      this.created_at,
      (error, label) => {
        if (error != null) {
          throw error
        }
        return ProjectHistoryClient.deleteLabel(
          this.project_id,
          this.user_id,
          label.id,
          error => {
            if (error != null) {
              throw error
            }
            return ProjectHistoryClient.getLabels(
              this.project_id,
              (error, labels) => {
                if (error != null) {
                  throw error
                }
                expect(labels).to.deep.equal([])
                return done()
              }
            )
          }
        )
      }
    )
  })

  it('can transfer ownership of labels', function (done) {
    const fromUser = ObjectId().toString()
    const toUser = ObjectId().toString()
    return ProjectHistoryClient.createLabel(
      this.project_id,
      fromUser,
      7,
      this.comment,
      this.created_at,
      (error, label) => {
        if (error != null) {
          throw error
        }
        return ProjectHistoryClient.createLabel(
          this.project_id,
          fromUser,
          7,
          this.comment2,
          this.created_at,
          (error, label2) => {
            if (error != null) {
              throw error
            }
            return ProjectHistoryClient.transferLabelOwnership(
              fromUser,
              toUser,
              error => {
                if (error != null) {
                  throw error
                }
                return ProjectHistoryClient.getLabels(
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
                    return done()
                  }
                )
              }
            )
          }
        )
      }
    )
  })

  return it('should return labels with summarized updates', function (done) {
    return ProjectHistoryClient.createLabel(
      this.project_id,
      this.user_id,
      8,
      this.comment,
      this.created_at,
      (error, label) => {
        if (error != null) {
          throw error
        }
        return ProjectHistoryClient.getSummarizedUpdates(
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
            return done()
          }
        )
      }
    )
  })
})
