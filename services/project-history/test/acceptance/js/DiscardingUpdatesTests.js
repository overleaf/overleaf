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
import async from 'async'
import sinon from 'sinon'
import { expect } from 'chai'
import Settings from '@overleaf/settings'
import assert from 'node:assert'
import mongodb from 'mongodb-legacy'
import nock from 'nock'
import * as ProjectHistoryClient from './helpers/ProjectHistoryClient.js'
import * as ProjectHistoryApp from './helpers/ProjectHistoryApp.js'
const { ObjectId } = mongodb

const MockHistoryStore = () => nock('http://127.0.0.1:3100')
const MockWeb = () => nock('http://127.0.0.1:3000')

describe('DiscardingUpdates', function () {
  beforeEach(function (done) {
    this.timestamp = new Date()

    return ProjectHistoryApp.ensureRunning(error => {
      if (error != null) {
        throw error
      }
      this.user_id = new ObjectId().toString()
      this.project_id = new ObjectId().toString()
      this.doc_id = new ObjectId().toString()

      MockHistoryStore().post('/api/projects').reply(200, {
        projectId: 0,
      })
      MockWeb()
        .get(`/project/${this.project_id}/details`)
        .reply(200, { name: 'Test Project' })
      return ProjectHistoryClient.initializeProject(this.project_id, done)
    })
  })

  return it('should discard updates', function (done) {
    return async.series(
      [
        cb => {
          const update = {
            pathname: '/main.tex',
            docLines: 'a\nb',
            doc: this.doc_id,
            meta: { user_id: this.user_id, ts: new Date() },
          }
          return ProjectHistoryClient.pushRawUpdate(this.project_id, update, cb)
        },
        cb => {
          return ProjectHistoryClient.flushProject(this.project_id, cb)
        },
      ],
      error => {
        if (error != null) {
          throw error
        }
        return done()
      }
    )
  })
})
