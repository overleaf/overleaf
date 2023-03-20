/* eslint-disable
    no-undef,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
import { expect } from 'chai'
import settings from '@overleaf/settings'
import request from 'request'
import { ObjectId } from 'mongodb'
import nock from 'nock'
import * as ProjectHistoryClient from './helpers/ProjectHistoryClient.js'
import * as ProjectHistoryApp from './helpers/ProjectHistoryApp.js'

const MockHistoryStore = () => nock('http://localhost:3100')
const MockWeb = () => nock('http://localhost:3000')

describe('Health Check', function () {
  beforeEach(function (done) {
    const projectId = ObjectId()
    const historyId = ObjectId().toString()
    settings.history.healthCheck = { project_id: projectId }
    return ProjectHistoryApp.ensureRunning(error => {
      if (error != null) {
        throw error
      }
      MockHistoryStore().post('/api/projects').reply(200, {
        projectId: historyId,
      })
      MockHistoryStore()
        .get(`/api/projects/${historyId}/latest/history`)
        .reply(200, {
          chunk: {
            startVersion: 0,
            history: {
              snapshot: {},
              changes: [],
            },
          },
        })
      MockWeb()
        .get(`/project/${projectId}/details`)
        .reply(200, {
          name: 'Test Project',
          overleaf: {
            history: {
              id: historyId,
            },
          },
        })

      return ProjectHistoryClient.initializeProject(historyId, done)
    })
  })

  return it('should respond to the health check', function (done) {
    return request.get(
      {
        url: 'http://localhost:3054/health_check',
      },
      (error, res, body) => {
        if (error != null) {
          return callback(error)
        }
        expect(res.statusCode).to.equal(200)
        return done()
      }
    )
  })
})
