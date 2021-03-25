/* eslint-disable
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
const sinon = require('sinon')
const { expect } = require('chai')
const { ObjectId } = require('../../../app/js/mongodb')
const Settings = require('settings-sharelatex')

const TrackChangesApp = require('./helpers/TrackChangesApp')
const TrackChangesClient = require('./helpers/TrackChangesClient')
const MockDocUpdaterApi = require('./helpers/MockDocUpdaterApi')
const MockWebApi = require('./helpers/MockWebApi')

describe('Restoring a version', function () {
  before(function (done) {
    sinon.spy(MockDocUpdaterApi, 'setDoc')

    this.now = Date.now()
    this.user_id = ObjectId().toString()
    this.doc_id = ObjectId().toString()
    this.project_id = ObjectId().toString()
    MockWebApi.projects[this.project_id] = { features: { versioning: true } }

    const minutes = 60 * 1000

    this.updates = [
      {
        op: [{ i: 'one ', p: 0 }],
        meta: { ts: this.now - 6 * minutes, user_id: this.user_id },
        v: 3
      },
      {
        op: [{ i: 'two ', p: 4 }],
        meta: { ts: this.now - 4 * minutes, user_id: this.user_id },
        v: 4
      },
      {
        op: [{ i: 'three ', p: 8 }],
        meta: { ts: this.now - 2 * minutes, user_id: this.user_id },
        v: 5
      },
      {
        op: [{ i: 'four', p: 14 }],
        meta: { ts: this.now, user_id: this.user_id },
        v: 6
      }
    ]
    this.lines = ['one two three four']
    this.restored_lines = ['one two ']
    this.beforeVersion = 5

    MockWebApi.users[this.user_id] = this.user = {
      email: 'user@sharelatex.com',
      first_name: 'Leo',
      last_name: 'Lion',
      id: this.user_id
    }

    MockDocUpdaterApi.docs[this.doc_id] = {
      lines: this.lines,
      version: 7
    }

    TrackChangesApp.ensureRunning(() => {
      return TrackChangesClient.pushRawUpdates(
        this.project_id,
        this.doc_id,
        this.updates,
        (error) => {
          if (error != null) {
            throw error
          }
          return TrackChangesClient.restoreDoc(
            this.project_id,
            this.doc_id,
            this.beforeVersion,
            this.user_id,
            (error) => {
              if (error != null) {
                throw error
              }
              return done()
            }
          )
        }
      )
    })
    return null
  })

  after(function () {
    MockDocUpdaterApi.setDoc.restore()
    return null
  })

  return it('should set the doc in the doc updater', function () {
    MockDocUpdaterApi.setDoc
      .calledWith(
        this.project_id,
        this.doc_id,
        this.restored_lines,
        this.user_id,
        true
      )
      .should.equal(true)
    return null
  })
})
