/* eslint-disable
    no-undef,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS202: Simplify dynamic range loops
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const sinon = require('sinon')
const { expect } = require('chai')
const { db, ObjectId } = require('../../../app/js/mongodb')
const Settings = require('@overleaf/settings')
const request = require('request')
const rclient = require('redis').createClient(Settings.redis.history) // Only works locally for now

const TrackChangesApp = require('./helpers/TrackChangesApp')
const TrackChangesClient = require('./helpers/TrackChangesClient')
const MockDocStoreApi = require('./helpers/MockDocStoreApi')
const MockWebApi = require('./helpers/MockWebApi')

describe('Archiving updates', function () {
  before(function (done) {
    if (
      __guard__(
        __guard__(
          Settings != null ? Settings.trackchanges : undefined,
          x1 => x1.s3
        ),
        x => x.key.length
      ) < 1
    ) {
      const message = new Error('s3 keys not setup, this test setup will fail')
      return done(message)
    }

    return TrackChangesClient.waitForS3(done)
  })

  before(function (done) {
    this.now = Date.now()
    this.to = this.now
    this.user_id = ObjectId().toString()
    this.user_id_2 = ObjectId().toString()
    this.doc_id = ObjectId().toString()
    this.project_id = ObjectId().toString()

    this.minutes = 60 * 1000
    this.hours = 60 * this.minutes

    MockWebApi.projects[this.project_id] = {
      features: {
        versioning: true,
      },
    }
    sinon.spy(MockWebApi, 'getProjectDetails')

    MockWebApi.users[this.user_id] = this.user = {
      email: 'user@sharelatex.com',
      first_name: 'Leo',
      last_name: 'Lion',
      id: this.user_id,
    }
    sinon.spy(MockWebApi, 'getUserInfo')

    MockDocStoreApi.docs[this.doc_id] = this.doc = {
      _id: this.doc_id,
      project_id: this.project_id,
    }
    sinon.spy(MockDocStoreApi, 'getAllDoc')

    this.updates = []
    for (
      let i = 0, end = 512 + 10, asc = end >= 0;
      asc ? i <= end : i >= end;
      asc ? i++ : i--
    ) {
      this.updates.push({
        op: [{ i: 'a', p: 0 }],
        meta: { ts: this.now + (i - 2048) * this.hours, user_id: this.user_id },
        v: 2 * i + 1,
      })
      this.updates.push({
        op: [{ i: 'b', p: 0 }],
        meta: {
          ts: this.now + (i - 2048) * this.hours + 10 * this.minutes,
          user_id: this.user_id_2,
        },
        v: 2 * i + 2,
      })
    }
    TrackChangesApp.ensureRunning(() => {
      return TrackChangesClient.pushRawUpdates(
        this.project_id,
        this.doc_id,
        this.updates,
        error => {
          if (error != null) {
            throw error
          }
          return TrackChangesClient.flushDoc(
            this.project_id,
            this.doc_id,
            error => {
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

  after(function (done) {
    MockWebApi.getUserInfo.restore()
    return db.docHistory.deleteMany(
      { project_id: ObjectId(this.project_id) },
      () => {
        return db.docHistoryIndex.remove(
          { project_id: ObjectId(this.project_id) },
          () => {
            return TrackChangesClient.removeS3Doc(
              this.project_id,
              this.doc_id,
              done
            )
          }
        )
      }
    )
  })

  function testExportFeature() {
    describe('exporting the project', function () {
      before('fetch export', function (done) {
        TrackChangesClient.exportProject(
          this.project_id,
          (error, updates, userIds) => {
            if (error) {
              return done(error)
            }
            this.exportedUpdates = updates
            this.exportedUserIds = userIds
            done()
          }
        )
      })

      it('should include all the imported updates, with ids, sorted by timestamp', function () {
        // Add a safe guard for an empty array matching an empty export.
        expect(this.updates).to.have.length(1024 + 22)

        const expectedExportedUpdates = this.updates
          .slice()
          .reverse()
          .map(update => {
            // clone object, updates are created once in before handler
            const exportedUpdate = Object.assign({}, update)
            exportedUpdate.meta = Object.assign({}, update.meta)

            exportedUpdate.doc_id = this.doc_id
            exportedUpdate.project_id = this.project_id

            // This is for merged updates, which does not apply here.
            exportedUpdate.meta.start_ts = exportedUpdate.meta.end_ts =
              exportedUpdate.meta.ts
            delete exportedUpdate.meta.ts
            return exportedUpdate
          })
        expect(this.exportedUpdates).to.deep.equal(expectedExportedUpdates)
        expect(this.exportedUserIds).to.deep.equal([
          this.user_id,
          this.user_id_2,
        ])
      })
    })
  }

  describe("before archiving a doc's updates", function () {
    testExportFeature()
  })

  describe("archiving a doc's updates", function () {
    before(function (done) {
      TrackChangesClient.pushDocHistory(this.project_id, this.doc_id, error => {
        if (error != null) {
          throw error
        }
        return done()
      })
      return null
    })

    it('should have one cached pack', function (done) {
      return db.docHistory.count(
        { doc_id: ObjectId(this.doc_id), expiresAt: { $exists: true } },
        (error, count) => {
          if (error != null) {
            throw error
          }
          count.should.equal(1)
          return done()
        }
      )
    })

    it('should have one remaining pack after cache is expired', function (done) {
      return db.docHistory.deleteMany(
        {
          doc_id: ObjectId(this.doc_id),
          expiresAt: { $exists: true },
        },
        (err, result) => {
          if (err) return done(err)
          return db.docHistory.count(
            { doc_id: ObjectId(this.doc_id) },
            (error, count) => {
              if (error != null) {
                throw error
              }
              count.should.equal(1)
              return done()
            }
          )
        }
      )
    })

    it('should have a docHistoryIndex entry marked as inS3', function (done) {
      return db.docHistoryIndex.findOne(
        { _id: ObjectId(this.doc_id) },
        (error, index) => {
          if (error != null) {
            throw error
          }
          index.packs[0].inS3.should.equal(true)
          return done()
        }
      )
    })

    it('should have a docHistoryIndex entry with the last version', function (done) {
      return db.docHistoryIndex.findOne(
        { _id: ObjectId(this.doc_id) },
        (error, index) => {
          if (error != null) {
            throw error
          }
          index.packs[0].v_end.should.equal(1024)
          return done()
        }
      )
    })

    it('should store 1024 doc changes in S3 in one pack', function (done) {
      return db.docHistoryIndex.findOne(
        { _id: ObjectId(this.doc_id) },
        (error, index) => {
          if (error != null) {
            throw error
          }
          const packId = index.packs[0]._id
          return TrackChangesClient.getS3Doc(
            this.project_id,
            this.doc_id,
            packId,
            (error, doc) => {
              if (error) return done(error)
              doc.n.should.equal(1024)
              doc.pack.length.should.equal(1024)
              return done()
            }
          )
        }
      )
    })

    testExportFeature()
  })

  return describe("unarchiving a doc's updates", function () {
    before(function (done) {
      TrackChangesClient.pullDocHistory(this.project_id, this.doc_id, error => {
        if (error != null) {
          throw error
        }
        return done()
      })
      return null
    })

    return it('should restore both packs', function (done) {
      return db.docHistory.count(
        { doc_id: ObjectId(this.doc_id) },
        (error, count) => {
          if (error != null) {
            throw error
          }
          count.should.equal(2)
          return done()
        }
      )
    })
  })
})

function __guard__(value, transform) {
  return typeof value !== 'undefined' && value !== null
    ? transform(value)
    : undefined
}
