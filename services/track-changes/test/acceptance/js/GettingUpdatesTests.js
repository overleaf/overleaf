/* eslint-disable
    chai-friendly/no-unused-expressions,
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
const MockWebApi = require('./helpers/MockWebApi')

describe('Getting updates', function () {
  before(function (done) {
    this.now = Date.now()
    this.to = this.now
    this.user_id = ObjectId().toString()
    this.deleted_user_id = 'deleted_user'
    this.doc_id = ObjectId().toString()
    this.project_id = ObjectId().toString()

    this.minutes = 60 * 1000
    this.hours = 60 * this.minutes

    MockWebApi.projects[this.project_id] = {
      features: {
        versioning: true
      }
    }

    MockWebApi.users[this.user_id] = this.user = {
      email: 'user@sharelatex.com',
      first_name: 'Leo',
      last_name: 'Lion',
      id: this.user_id
    }
    sinon.spy(MockWebApi, 'getUserInfo')

    this.updates = []
    for (let i = 0; i <= 9; i++) {
      this.updates.push({
        op: [{ i: 'a', p: 0 }],
        meta: {
          ts: this.now - (9 - i) * this.hours - 2 * this.minutes,
          user_id: this.user_id
        },
        v: 2 * i + 1
      })
      this.updates.push({
        op: [{ i: 'b', p: 0 }],
        meta: { ts: this.now - (9 - i) * this.hours, user_id: this.user_id },
        v: 2 * i + 2
      })
    }
    this.updates[0].meta.user_id = this.deleted_user_id

    TrackChangesApp.ensureRunning(() => {
      return TrackChangesClient.pushRawUpdates(
        this.project_id,
        this.doc_id,
        this.updates,
        (error) => {
          if (error != null) {
            throw error
          }
          return done()
        }
      )
    })
    return null
  })
  ;({
    after() {
      MockWebApi.getUserInfo.restore()
      return null
    }
  })

  describe('getting updates up to the limit', function () {
    before(function (done) {
      TrackChangesClient.getUpdates(
        this.project_id,
        { before: this.to + 1, min_count: 3 },
        (error, body) => {
          if (error != null) {
            throw error
          }
          this.updates = body.updates
          return done()
        }
      )
      return null
    })

    it('should fetch the user details from the web api', function () {
      return MockWebApi.getUserInfo.calledWith(this.user_id).should.equal(true)
    })

    return it('should return at least the min_count number of summarized updates', function () {
      const docs1 = {}
      docs1[this.doc_id] = { toV: 20, fromV: 19 }
      const docs2 = {}
      docs2[this.doc_id] = { toV: 18, fromV: 17 }
      const docs3 = {}
      docs3[this.doc_id] = { toV: 16, fromV: 15 }
      return expect(this.updates.slice(0, 3)).to.deep.equal([
        {
          docs: docs1,
          meta: {
            start_ts: this.to - 2 * this.minutes,
            end_ts: this.to,
            users: [this.user]
          }
        },
        {
          docs: docs2,
          meta: {
            start_ts: this.to - 1 * this.hours - 2 * this.minutes,
            end_ts: this.to - 1 * this.hours,
            users: [this.user]
          }
        },
        {
          docs: docs3,
          meta: {
            start_ts: this.to - 2 * this.hours - 2 * this.minutes,
            end_ts: this.to - 2 * this.hours,
            users: [this.user]
          }
        }
      ])
    })
  })

  return describe('getting updates beyond the end of the database', function () {
    before(function (done) {
      TrackChangesClient.getUpdates(
        this.project_id,
        { before: this.to - 8 * this.hours + 1, min_count: 30 },
        (error, body) => {
          if (error != null) {
            throw error
          }
          this.updates = body.updates
          return done()
        }
      )
      return null
    })

    return it('should return as many updates as it can', function () {
      const docs1 = {}
      docs1[this.doc_id] = { toV: 4, fromV: 3 }
      const docs2 = {}
      docs2[this.doc_id] = { toV: 2, fromV: 1 }
      return expect(this.updates).to.deep.equal([
        {
          docs: docs1,
          meta: {
            start_ts: this.to - 8 * this.hours - 2 * this.minutes,
            end_ts: this.to - 8 * this.hours,
            users: [this.user]
          }
        },
        {
          docs: docs2,
          meta: {
            start_ts: this.to - 9 * this.hours - 2 * this.minutes,
            end_ts: this.to - 9 * this.hours,
            users: [this.user, null]
          }
        }
      ])
    })
  })
})
