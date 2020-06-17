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
const chai = require('chai')
chai.should()
const { expect } = chai
const mongojs = require('../../../app/js/mongojs')
const { db } = mongojs
const { ObjectId } = mongojs
const Settings = require('settings-sharelatex')

const TrackChangesApp = require('./helpers/TrackChangesApp')
const TrackChangesClient = require('./helpers/TrackChangesClient')
const MockDocUpdaterApi = require('./helpers/MockDocUpdaterApi')
const MockWebApi = require('./helpers/MockWebApi')

describe('Getting a diff', function () {
  beforeEach(function (done) {
    sinon.spy(MockDocUpdaterApi, 'getDoc')

    this.now = Date.now()
    this.from = this.now - 100000000
    this.to = this.now
    this.user_id = ObjectId().toString()
    this.doc_id = ObjectId().toString()
    this.project_id = ObjectId().toString()
    MockWebApi.projects[this.project_id] = { features: { versioning: true } }

    MockWebApi.users[this.user_id] = this.user = {
      email: 'user@sharelatex.com',
      first_name: 'Leo',
      last_name: 'Lion',
      id: this.user_id
    }
    sinon.spy(MockWebApi, 'getUserInfo')

    const twoMinutes = 2 * 60 * 1000

    this.updates = [
      {
        op: [{ i: 'one ', p: 0 }],
        meta: { ts: this.from - twoMinutes, user_id: this.user_id },
        v: 3
      },
      {
        op: [{ i: 'two ', p: 4 }],
        meta: { ts: this.from + twoMinutes, user_id: this.user_id },
        v: (this.fromVersion = 4)
      },
      {
        op: [{ i: 'three ', p: 8 }],
        meta: { ts: this.to - twoMinutes, user_id: this.user_id },
        v: (this.toVersion = 5)
      },
      {
        op: [{ i: 'four', p: 14 }],
        meta: { ts: this.to + twoMinutes, user_id: this.user_id },
        v: 6
      }
    ]
    this.lines = ['one two three four']
    this.expected_diff = [
      { u: 'one ' },
      {
        i: 'two three ',
        meta: {
          start_ts: this.from + twoMinutes,
          end_ts: this.to - twoMinutes,
          user: this.user
        }
      }
    ]

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
          return TrackChangesClient.getDiff(
            this.project_id,
            this.doc_id,
            this.fromVersion,
            this.toVersion,
            (error, diff) => {
              if (error != null) {
                throw error
              }
              this.diff = diff.diff
              return done()
            }
          )
        }
      )
    })
    return null
  })

  afterEach(function () {
    MockDocUpdaterApi.getDoc.restore()
    MockWebApi.getUserInfo.restore()
    return null
  })

  it('should return the diff', function () {
    return expect(this.diff).to.deep.equal(this.expected_diff)
  })

  return it('should get the doc from the doc updater', function () {
    MockDocUpdaterApi.getDoc
      .calledWith(this.project_id, this.doc_id)
      .should.equal(true)
    return null
  })
})
