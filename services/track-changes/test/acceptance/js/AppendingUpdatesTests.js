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
const chai = require('chai')
chai.should()
const { expect } = chai
const mongojs = require('../../../app/js/mongojs')
const { ObjectId } = mongojs
const Settings = require('settings-sharelatex')
const request = require('request')
const rclient = require('redis').createClient(Settings.redis.history) // Only works locally for now

const TrackChangesApp = require('./helpers/TrackChangesApp')
const TrackChangesClient = require('./helpers/TrackChangesClient')
const MockWebApi = require('./helpers/MockWebApi')

describe('Appending doc ops to the history', function () {
  before(function (done) {
    return TrackChangesApp.ensureRunning(done)
  })

  describe('when the history does not exist yet', function () {
    before(function (done) {
      this.project_id = ObjectId().toString()
      this.doc_id = ObjectId().toString()
      this.user_id = ObjectId().toString()
      MockWebApi.projects[this.project_id] = { features: { versioning: false } }
      TrackChangesClient.pushRawUpdates(
        this.project_id,
        this.doc_id,
        [
          {
            op: [{ i: 'f', p: 3 }],
            meta: { ts: Date.now(), user_id: this.user_id },
            v: 3
          },
          {
            op: [{ i: 'o', p: 4 }],
            meta: { ts: Date.now(), user_id: this.user_id },
            v: 4
          },
          {
            op: [{ i: 'o', p: 5 }],
            meta: { ts: Date.now(), user_id: this.user_id },
            v: 5
          }
        ],
        (error) => {
          if (error != null) {
            throw error
          }
          return TrackChangesClient.flushAndGetCompressedUpdates(
            this.project_id,
            this.doc_id,
            (error, updates) => {
              this.updates = updates
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

    it('should insert the compressed op into mongo', function () {
      return expect(this.updates[0].pack[0].op).to.deep.equal([
        {
          p: 3,
          i: 'foo'
        }
      ])
    })

    it('should insert the correct version number into mongo', function () {
      return expect(this.updates[0].v).to.equal(5)
    })

    it('should store the doc id', function () {
      return expect(this.updates[0].doc_id.toString()).to.equal(this.doc_id)
    })

    it('should store the project id', function () {
      return expect(this.updates[0].project_id.toString()).to.equal(
        this.project_id
      )
    })

    return it('should clear the doc from the DocsWithHistoryOps set', function (done) {
      rclient.sismember(
        `DocsWithHistoryOps:${this.project_id}`,
        this.doc_id,
        (error, member) => {
          member.should.equal(0)
          return done()
        }
      )
      return null
    })
  })

  describe('when the history has already been started', function () {
    beforeEach(function (done) {
      this.project_id = ObjectId().toString()
      this.doc_id = ObjectId().toString()
      this.user_id = ObjectId().toString()
      MockWebApi.projects[this.project_id] = { features: { versioning: false } }
      TrackChangesClient.pushRawUpdates(
        this.project_id,
        this.doc_id,
        [
          {
            op: [{ i: 'f', p: 3 }],
            meta: { ts: Date.now(), user_id: this.user_id },
            v: 3
          },
          {
            op: [{ i: 'o', p: 4 }],
            meta: { ts: Date.now(), user_id: this.user_id },
            v: 4
          },
          {
            op: [{ i: 'o', p: 5 }],
            meta: { ts: Date.now(), user_id: this.user_id },
            v: 5
          }
        ],
        (error) => {
          if (error != null) {
            throw error
          }
          return TrackChangesClient.flushAndGetCompressedUpdates(
            this.project_id,
            this.doc_id,
            (error, updates) => {
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

    describe('when the updates are recent and from the same user', function () {
      beforeEach(function (done) {
        TrackChangesClient.pushRawUpdates(
          this.project_id,
          this.doc_id,
          [
            {
              op: [{ i: 'b', p: 6 }],
              meta: { ts: Date.now(), user_id: this.user_id },
              v: 6
            },
            {
              op: [{ i: 'a', p: 7 }],
              meta: { ts: Date.now(), user_id: this.user_id },
              v: 7
            },
            {
              op: [{ i: 'r', p: 8 }],
              meta: { ts: Date.now(), user_id: this.user_id },
              v: 8
            }
          ],
          (error) => {
            if (error != null) {
              throw error
            }
            return TrackChangesClient.flushAndGetCompressedUpdates(
              this.project_id,
              this.doc_id,
              (error, updates) => {
                this.updates = updates
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

      it('should combine all the updates into one pack', function () {
        return expect(this.updates[0].pack[1].op).to.deep.equal([
          {
            p: 6,
            i: 'bar'
          }
        ])
      })

      return it('should insert the correct version number into mongo', function () {
        return expect(this.updates[0].v_end).to.equal(8)
      })
    })

    return describe('when the updates are far apart', function () {
      beforeEach(function (done) {
        const oneDay = 24 * 60 * 60 * 1000
        TrackChangesClient.pushRawUpdates(
          this.project_id,
          this.doc_id,
          [
            {
              op: [{ i: 'b', p: 6 }],
              meta: { ts: Date.now() + oneDay, user_id: this.user_id },
              v: 6
            },
            {
              op: [{ i: 'a', p: 7 }],
              meta: { ts: Date.now() + oneDay, user_id: this.user_id },
              v: 7
            },
            {
              op: [{ i: 'r', p: 8 }],
              meta: { ts: Date.now() + oneDay, user_id: this.user_id },
              v: 8
            }
          ],
          (error) => {
            if (error != null) {
              throw error
            }
            return TrackChangesClient.flushAndGetCompressedUpdates(
              this.project_id,
              this.doc_id,
              (error, updates) => {
                this.updates = updates
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

      return it('should combine the updates into one pack', function () {
        expect(this.updates[0].pack[0].op).to.deep.equal([
          {
            p: 3,
            i: 'foo'
          }
        ])
        return expect(this.updates[0].pack[1].op).to.deep.equal([
          {
            p: 6,
            i: 'bar'
          }
        ])
      })
    })
  })

  describe('when the updates need processing in batches', function () {
    before(function (done) {
      this.project_id = ObjectId().toString()
      this.doc_id = ObjectId().toString()
      this.user_id = ObjectId().toString()
      MockWebApi.projects[this.project_id] = { features: { versioning: false } }
      const updates = []
      this.expectedOp = [{ p: 0, i: '' }]
      for (let i = 0; i <= 250; i++) {
        updates.push({
          op: [{ i: 'a', p: 0 }],
          meta: { ts: Date.now(), user_id: this.user_id },
          v: i
        })
        this.expectedOp[0].i = `a${this.expectedOp[0].i}`
      }

      TrackChangesClient.pushRawUpdates(
        this.project_id,
        this.doc_id,
        updates,
        (error) => {
          if (error != null) {
            throw error
          }
          return TrackChangesClient.flushAndGetCompressedUpdates(
            this.project_id,
            this.doc_id,
            (error, updates1) => {
              this.updates = updates1
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

    it('should concat the compressed op into mongo', function () {
      return expect(this.updates[0].pack.length).to.deep.equal(3)
    }) // batch size is 100

    return it('should insert the correct version number into mongo', function () {
      return expect(this.updates[0].v_end).to.equal(250)
    })
  })

  describe('when there are multiple ops in each update', function () {
    before(function (done) {
      this.project_id = ObjectId().toString()
      this.doc_id = ObjectId().toString()
      this.user_id = ObjectId().toString()
      MockWebApi.projects[this.project_id] = { features: { versioning: false } }
      const oneDay = 24 * 60 * 60 * 1000
      TrackChangesClient.pushRawUpdates(
        this.project_id,
        this.doc_id,
        [
          {
            op: [
              { i: 'f', p: 3 },
              { i: 'o', p: 4 },
              { i: 'o', p: 5 }
            ],
            meta: { ts: Date.now(), user_id: this.user_id },
            v: 3
          },
          {
            op: [
              { i: 'b', p: 6 },
              { i: 'a', p: 7 },
              { i: 'r', p: 8 }
            ],
            meta: { ts: Date.now() + oneDay, user_id: this.user_id },
            v: 4
          }
        ],
        (error) => {
          if (error != null) {
            throw error
          }
          return TrackChangesClient.flushAndGetCompressedUpdates(
            this.project_id,
            this.doc_id,
            (error, updates) => {
              this.updates = updates
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

    it('should insert the compressed ops into mongo', function () {
      expect(this.updates[0].pack[0].op).to.deep.equal([
        {
          p: 3,
          i: 'foo'
        }
      ])
      return expect(this.updates[0].pack[1].op).to.deep.equal([
        {
          p: 6,
          i: 'bar'
        }
      ])
    })

    return it('should insert the correct version numbers into mongo', function () {
      expect(this.updates[0].pack[0].v).to.equal(3)
      return expect(this.updates[0].pack[1].v).to.equal(4)
    })
  })

  describe('when there is a no-op update', function () {
    before(function (done) {
      this.project_id = ObjectId().toString()
      this.doc_id = ObjectId().toString()
      this.user_id = ObjectId().toString()
      MockWebApi.projects[this.project_id] = { features: { versioning: false } }
      const oneDay = 24 * 60 * 60 * 1000
      TrackChangesClient.pushRawUpdates(
        this.project_id,
        this.doc_id,
        [
          {
            op: [],
            meta: { ts: Date.now(), user_id: this.user_id },
            v: 3
          },
          {
            op: [{ i: 'foo', p: 3 }],
            meta: { ts: Date.now() + oneDay, user_id: this.user_id },
            v: 4
          }
        ],
        (error) => {
          if (error != null) {
            throw error
          }
          return TrackChangesClient.flushAndGetCompressedUpdates(
            this.project_id,
            this.doc_id,
            (error, updates) => {
              this.updates = updates
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

    it('should insert the compressed no-op into mongo', function () {
      return expect(this.updates[0].pack[0].op).to.deep.equal([])
    })

    it('should insert the compressed next update into mongo', function () {
      return expect(this.updates[0].pack[1].op).to.deep.equal([
        {
          p: 3,
          i: 'foo'
        }
      ])
    })

    return it('should insert the correct version numbers into mongo', function () {
      expect(this.updates[0].pack[0].v).to.equal(3)
      return expect(this.updates[0].pack[1].v).to.equal(4)
    })
  })

  describe('when there is a comment update', function () {
    before(function (done) {
      this.project_id = ObjectId().toString()
      this.doc_id = ObjectId().toString()
      this.user_id = ObjectId().toString()
      MockWebApi.projects[this.project_id] = { features: { versioning: false } }
      TrackChangesClient.pushRawUpdates(
        this.project_id,
        this.doc_id,
        [
          {
            op: [
              { c: 'foo', p: 3 },
              { d: 'bar', p: 6 }
            ],
            meta: { ts: Date.now(), user_id: this.user_id },
            v: 3
          }
        ],
        (error) => {
          if (error != null) {
            throw error
          }
          return TrackChangesClient.flushAndGetCompressedUpdates(
            this.project_id,
            this.doc_id,
            (error, updates) => {
              this.updates = updates
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

    it('should ignore the comment op', function () {
      return expect(this.updates[0].pack[0].op).to.deep.equal([
        { d: 'bar', p: 6 }
      ])
    })

    return it('should insert the correct version numbers into mongo', function () {
      return expect(this.updates[0].pack[0].v).to.equal(3)
    })
  })

  describe('when the project has versioning enabled', function () {
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
          return TrackChangesClient.flushAndGetCompressedUpdates(
            this.project_id,
            this.doc_id,
            (error, updates) => {
              this.updates = updates
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

    return it('should not add a expiresAt entry in the update in mongo', function () {
      return expect(this.updates[0].expiresAt).to.be.undefined
    })
  })

  return describe('when the project does not have versioning enabled', function () {
    before(function (done) {
      this.project_id = ObjectId().toString()
      this.doc_id = ObjectId().toString()
      this.user_id = ObjectId().toString()
      MockWebApi.projects[this.project_id] = { features: { versioning: false } }

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
          return TrackChangesClient.flushAndGetCompressedUpdates(
            this.project_id,
            this.doc_id,
            (error, updates) => {
              this.updates = updates
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

    return it('should add a expiresAt entry in the update in mongo', function () {
      return expect(this.updates[0].expiresAt).to.exist
    })
  })
})
