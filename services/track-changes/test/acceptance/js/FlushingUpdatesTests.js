/* eslint-disable
    handle-callback-err,
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
const request = require('request')
const rclient = require('redis').createClient(Settings.redis.history) // Only works locally for now

const TrackChangesApp = require('./helpers/TrackChangesApp')
const TrackChangesClient = require('./helpers/TrackChangesClient')
const MockWebApi = require('./helpers/MockWebApi')

describe('Flushing updates', function () {
  before(function (done) {
    return TrackChangesApp.ensureRunning(done)
  })

  describe("flushing a doc's updates", function () {
    before(function (done) {
      this.project_id = ObjectId().toString()
      this.doc_id = ObjectId().toString()
      this.user_id = ObjectId().toString()
      MockWebApi.projects[this.project_id] = { features: { versioning: true } }

      TrackChangesClient.pushRawUpdates(
        this.project_id,
        this.doc_id,
        [
          {
            op: [{ i: 'f', p: 3 }],
            meta: { ts: Date.now(), user_id: this.user_id },
            v: 3
          }
        ],
        (error) => {
          if (error != null) {
            throw error
          }
          return TrackChangesClient.flushDoc(
            this.project_id,
            this.doc_id,
            (error) => {
              if (error != null) {
                throw error
              }
              return done()
            }
          )
        }
      )
      return null
    })

    return it('should flush the op into mongo', function (done) {
      TrackChangesClient.getCompressedUpdates(this.doc_id, (error, updates) => {
        expect(updates[0].pack[0].op).to.deep.equal([
          {
            p: 3,
            i: 'f'
          }
        ])
        return done()
      })
      return null
    })
  })

  return describe("flushing a project's updates", function () {
    describe('with versioning enabled', function () {
      before(function (done) {
        this.project_id = ObjectId().toString()
        this.doc_id = ObjectId().toString()
        this.user_id = ObjectId().toString()

        this.weeks = 7 * 24 * 60 * 60 * 1000

        MockWebApi.projects[this.project_id] = {
          features: {
            versioning: true
          }
        }

        TrackChangesClient.pushRawUpdates(
          this.project_id,
          this.doc_id,
          [
            {
              op: [{ i: 'g', p: 2 }],
              meta: { ts: Date.now() - 2 * this.weeks, user_id: this.user_id },
              v: 2
            },
            {
              op: [{ i: 'f', p: 3 }],
              meta: { ts: Date.now(), user_id: this.user_id },
              v: 3
            }
          ],
          (error) => {
            if (error != null) {
              throw error
            }
            return TrackChangesClient.flushProject(this.project_id, (error) => {
              if (error != null) {
                throw error
              }
              return done()
            })
          }
        )
        return null
      })

      it('should not mark the updates for deletion', function (done) {
        TrackChangesClient.getCompressedUpdates(
          this.doc_id,
          (error, updates) => {
            expect(updates[0].expiresAt).to.not.exist
            return done()
          }
        )
        return null
      })

      return it('should preserve history forever', function (done) {
        TrackChangesClient.getProjectMetaData(
          this.project_id,
          (error, project) => {
            expect(project.preserveHistory).to.equal(true)
            return done()
          }
        )
        return null
      })
    })

    describe('without versioning enabled', function () {
      before(function (done) {
        this.project_id = ObjectId().toString()
        this.doc_id = ObjectId().toString()
        this.user_id = ObjectId().toString()

        this.weeks = 7 * 24 * 60 * 60 * 1000

        MockWebApi.projects[this.project_id] = {
          features: {
            versioning: false
          }
        }

        TrackChangesClient.pushRawUpdates(
          this.project_id,
          this.doc_id,
          [
            {
              op: [{ i: 'g', p: 2 }],
              meta: { ts: Date.now() - 2 * this.weeks, user_id: this.user_id },
              v: 2
            },
            {
              op: [{ i: 'f', p: 3 }],
              meta: { ts: Date.now(), user_id: this.user_id },
              v: 3
            }
          ],
          (error) => {
            if (error != null) {
              throw error
            }
            return TrackChangesClient.flushProject(this.project_id, (error) => {
              if (error != null) {
                throw error
              }
              return done()
            })
          }
        )
        return null
      })

      return it('should mark the updates for deletion', function (done) {
        TrackChangesClient.getCompressedUpdates(
          this.doc_id,
          (error, updates) => {
            expect(updates[0].expiresAt).to.exist
            return done()
          }
        )
        return null
      })
    })

    return describe('without versioning enabled but with preserveHistory set to true', function () {
      before(function (done) {
        this.project_id = ObjectId().toString()
        this.doc_id = ObjectId().toString()
        this.user_id = ObjectId().toString()

        this.weeks = 7 * 24 * 60 * 60 * 1000

        MockWebApi.projects[this.project_id] = {
          features: {
            versioning: false
          }
        }

        TrackChangesClient.setPreserveHistoryForProject(
          this.project_id,
          (error) => {
            if (error != null) {
              throw error
            }
            return TrackChangesClient.pushRawUpdates(
              this.project_id,
              this.doc_id,
              [
                {
                  op: [{ i: 'g', p: 2 }],
                  meta: {
                    ts: Date.now() - 2 * this.weeks,
                    user_id: this.user_id
                  },
                  v: 2
                },
                {
                  op: [{ i: 'f', p: 3 }],
                  meta: { ts: Date.now(), user_id: this.user_id },
                  v: 3
                }
              ],
              (error) => {
                if (error != null) {
                  throw error
                }
                return TrackChangesClient.flushProject(
                  this.project_id,
                  (error) => {
                    if (error != null) {
                      throw error
                    }
                    return done()
                  }
                )
              }
            )
          }
        )
        return null
      })

      return it('should not mark the updates for deletion', function (done) {
        TrackChangesClient.getCompressedUpdates(
          this.doc_id,
          (error, updates) => {
            expect(updates[0].expiresAt).to.not.exist
            return done()
          }
        )
        return null
      })
    })
  })
})
