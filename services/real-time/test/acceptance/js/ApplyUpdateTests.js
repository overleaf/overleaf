/* eslint-disable
    no-return-assign,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS201: Simplify complex destructure assignments
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
import async from 'async'

import { expect } from 'chai'
import RealTimeClient from './helpers/RealTimeClient.js'
import FixturesManager from './helpers/FixturesManager.js'
import settings from '@overleaf/settings'
import redis from '@overleaf/redis-wrapper'
const rclient = redis.createClient(settings.redis.documentupdater)

const redisSettings = settings.redis

const PENDING_UPDATES_LIST_KEYS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => {
  let key = 'pending-updates-list'
  if (n !== 0) {
    key += `-${n}`
  }
  return key
})

function getPendingUpdatesList(cb) {
  Promise.all(PENDING_UPDATES_LIST_KEYS.map(key => rclient.lrange(key, 0, -1)))
    .then(results => {
      cb(
        null,
        results.reduce((acc, more) => {
          if (more.length) {
            acc.push(...more)
          }
          return acc
        }, [])
      )
    })
    .catch(cb)
}

function clearPendingUpdatesList(cb) {
  Promise.all(PENDING_UPDATES_LIST_KEYS.map(key => rclient.del(key)))
    .then(() => cb(null))
    .catch(cb)
}

describe('applyOtUpdate', function () {
  before(function () {
    return (this.update = {
      op: [{ i: 'foo', p: 42 }],
    })
  })
  describe('when authorized', function () {
    before(function (done) {
      return async.series(
        [
          cb => {
            return FixturesManager.setUpProject(
              {
                privilegeLevel: 'readAndWrite',
              },
              (e, { project_id: projectId, user_id: userId }) => {
                this.project_id = projectId
                this.user_id = userId
                return cb(e)
              }
            )
          },

          cb => {
            return FixturesManager.setUpDoc(
              this.project_id,
              { lines: this.lines, version: this.version, ops: this.ops },
              (e, { doc_id: docId }) => {
                this.doc_id = docId
                return cb(e)
              }
            )
          },

          cb => {
            this.client = RealTimeClient.connect(this.project_id, cb)
          },

          cb => {
            return this.client.emit('joinDoc', this.doc_id, cb)
          },

          cb => {
            return this.client.emit(
              'applyOtUpdate',
              this.doc_id,
              this.update,
              cb
            )
          },
        ],
        done
      )
    })

    it('should push the doc into the pending updates list', function (done) {
      getPendingUpdatesList((error, ...rest) => {
        if (error) return done(error)
        const [docId] = Array.from(rest[0])
        docId.should.equal(`${this.project_id}:${this.doc_id}`)
        return done()
      })
      return null
    })

    it('should push the update into redis', function (done) {
      rclient.lrange(
        redisSettings.documentupdater.key_schema.pendingUpdates({
          doc_id: this.doc_id,
        }),
        0,
        -1,
        (error, ...rest) => {
          if (error) return done(error)
          let [update] = Array.from(rest[0])
          update = JSON.parse(update)
          update.op.should.deep.equal(this.update.op)
          update.meta.should.include({
            source: this.client.publicId,
            user_id: this.user_id,
          })
          return done()
        }
      )
      return null
    })

    return after(function (done) {
      return async.series(
        [
          cb => clearPendingUpdatesList(cb),
          cb =>
            rclient.del(
              'DocsWithPendingUpdates',
              `${this.project_id}:${this.doc_id}`,
              cb
            ),
          cb =>
            rclient.del(
              redisSettings.documentupdater.key_schema.pendingUpdates(
                this.doc_id
              ),
              cb
            ),
        ],
        done
      )
    })
  })

  describe('when authorized with a huge edit update', function () {
    before(function (done) {
      this.update = {
        op: {
          p: 12,
          t: 'update is too large'.repeat(1024 * 400), // >7MB
        },
      }
      return async.series(
        [
          cb => {
            return FixturesManager.setUpProject(
              {
                privilegeLevel: 'readAndWrite',
              },
              (e, { project_id: projectId, user_id: userId }) => {
                this.project_id = projectId
                this.user_id = userId
                return cb(e)
              }
            )
          },

          cb => {
            return FixturesManager.setUpDoc(
              this.project_id,
              { lines: this.lines, version: this.version, ops: this.ops },
              (e, { doc_id: docId }) => {
                this.doc_id = docId
                return cb(e)
              }
            )
          },

          cb => {
            this.client = RealTimeClient.connect(this.project_id, cb)
            return this.client.on('otUpdateError', otUpdateError => {
              this.otUpdateError = otUpdateError
            })
          },

          cb => {
            return this.client.emit('joinDoc', this.doc_id, cb)
          },

          cb => {
            return this.client.emit(
              'applyOtUpdate',
              this.doc_id,
              this.update,
              error => {
                this.error = error
                return cb()
              }
            )
          },
        ],
        done
      )
    })

    it('should not return an error', function () {
      return expect(this.error).to.not.exist
    })

    it('should send an otUpdateError to the client', function (done) {
      return setTimeout(() => {
        expect(this.otUpdateError).to.exist
        return done()
      }, 300)
    })

    it('should disconnect the client', function (done) {
      return setTimeout(() => {
        this.client.socket.connected.should.equal(false)
        return done()
      }, 300)
    })

    return it('should not put the update in redis', function (done) {
      rclient.llen(
        redisSettings.documentupdater.key_schema.pendingUpdates({
          doc_id: this.doc_id,
        }),
        (error, len) => {
          if (error) return done(error)
          len.should.equal(0)
          return done()
        }
      )
      return null
    })
  })

  describe('when authorized to read-only with an edit update', function () {
    before(function (done) {
      return async.series(
        [
          cb => {
            return FixturesManager.setUpProject(
              {
                privilegeLevel: 'readOnly',
              },
              (e, { project_id: projectId, user_id: userId }) => {
                this.project_id = projectId
                this.user_id = userId
                return cb(e)
              }
            )
          },

          cb => {
            return FixturesManager.setUpDoc(
              this.project_id,
              { lines: this.lines, version: this.version, ops: this.ops },
              (e, { doc_id: docId }) => {
                this.doc_id = docId
                return cb(e)
              }
            )
          },

          cb => {
            this.client = RealTimeClient.connect(this.project_id, cb)
          },

          cb => {
            return this.client.emit('joinDoc', this.doc_id, cb)
          },

          cb => {
            return this.client.emit(
              'applyOtUpdate',
              this.doc_id,
              this.update,
              error => {
                this.error = error
                return cb()
              }
            )
          },
        ],
        done
      )
    })

    it('should return an error', function () {
      return expect(this.error).to.exist
    })

    it('should disconnect the client', function (done) {
      return setTimeout(() => {
        this.client.socket.connected.should.equal(false)
        return done()
      }, 300)
    })

    return it('should not put the update in redis', function (done) {
      rclient.llen(
        redisSettings.documentupdater.key_schema.pendingUpdates({
          doc_id: this.doc_id,
        }),
        (error, len) => {
          if (error) return done(error)
          len.should.equal(0)
          return done()
        }
      )
      return null
    })
  })

  describe('when authorized to read-only with a comment update', function () {
    before(function (done) {
      this.comment_update = {
        op: [{ c: 'foo', p: 42 }],
      }
      return async.series(
        [
          cb => {
            return FixturesManager.setUpProject(
              {
                privilegeLevel: 'readOnly',
              },
              (e, { project_id: projectId, user_id: userId }) => {
                this.project_id = projectId
                this.user_id = userId
                return cb(e)
              }
            )
          },

          cb => {
            return FixturesManager.setUpDoc(
              this.project_id,
              { lines: this.lines, version: this.version, ops: this.ops },
              (e, { doc_id: docId }) => {
                this.doc_id = docId
                return cb(e)
              }
            )
          },

          cb => {
            this.client = RealTimeClient.connect(this.project_id, cb)
          },

          cb => {
            return this.client.emit('joinDoc', this.doc_id, cb)
          },

          cb => {
            return this.client.emit(
              'applyOtUpdate',
              this.doc_id,
              this.comment_update,
              cb
            )
          },
        ],
        done
      )
    })

    it('should push the doc into the pending updates list', function (done) {
      getPendingUpdatesList((error, ...rest) => {
        if (error) return done(error)
        const [docId] = Array.from(rest[0])
        docId.should.equal(`${this.project_id}:${this.doc_id}`)
        return done()
      })
      return null
    })

    it('should push the update into redis', function (done) {
      rclient.lrange(
        redisSettings.documentupdater.key_schema.pendingUpdates({
          doc_id: this.doc_id,
        }),
        0,
        -1,
        (error, ...rest) => {
          if (error) return done(error)
          let [update] = Array.from(rest[0])
          update = JSON.parse(update)
          update.op.should.deep.equal(this.comment_update.op)
          update.meta.should.include({
            source: this.client.publicId,
            user_id: this.user_id,
          })
          return done()
        }
      )
      return null
    })

    return after(function (done) {
      return async.series(
        [
          cb => clearPendingUpdatesList(cb),
          cb =>
            rclient.del(
              'DocsWithPendingUpdates',
              `${this.project_id}:${this.doc_id}`,
              cb
            ),
          cb =>
            rclient.del(
              redisSettings.documentupdater.key_schema.pendingUpdates({
                doc_id: this.doc_id,
              }),
              cb
            ),
        ],
        done
      )
    })
  })

  describe('when authorized with an edit update to an invalid doc', function () {
    before(function (done) {
      return async.series(
        [
          cb => {
            return FixturesManager.setUpProject(
              {
                privilegeLevel: 'readOnly',
              },
              (e, { project_id: projectId, user_id: userId }) => {
                this.project_id = projectId
                this.user_id = userId
                return cb(e)
              }
            )
          },

          cb => {
            return FixturesManager.setUpDoc(
              this.project_id,
              { lines: this.lines, version: this.version, ops: this.ops },
              (e, { doc_id: docId }) => {
                this.doc_id = docId
                return cb(e)
              }
            )
          },

          cb => {
            this.client = RealTimeClient.connect(this.project_id, cb)
          },

          cb => {
            return this.client.emit('joinDoc', this.doc_id, cb)
          },

          cb => {
            return this.client.emit(
              'applyOtUpdate',
              'invalid-doc-id',
              this.update,
              error => {
                this.error = error
                return cb()
              }
            )
          },
        ],
        done
      )
    })

    it('should return an error', function () {
      return expect(this.error).to.exist
    })

    it('should disconnect the client', function (done) {
      return setTimeout(() => {
        this.client.socket.connected.should.equal(false)
        return done()
      }, 300)
    })

    return it('should not put the update in redis', function (done) {
      rclient.llen(
        redisSettings.documentupdater.key_schema.pendingUpdates({
          doc_id: this.doc_id,
        }),
        (error, len) => {
          if (error) return done(error)
          len.should.equal(0)
          return done()
        }
      )
      return null
    })
  })

  describe('when authorized with an invalid edit update', function () {
    before(function (done) {
      return async.series(
        [
          cb => {
            return FixturesManager.setUpProject(
              {
                privilegeLevel: 'readAndWrite',
              },
              (e, { project_id: projectId, user_id: userId }) => {
                this.project_id = projectId
                this.user_id = userId
                return cb(e)
              }
            )
          },

          cb => {
            return FixturesManager.setUpDoc(
              this.project_id,
              { lines: this.lines, version: this.version, ops: this.ops },
              (e, { doc_id: docId }) => {
                this.doc_id = docId
                return cb(e)
              }
            )
          },

          cb => {
            this.client = RealTimeClient.connect(this.project_id, cb)
          },

          cb => {
            return this.client.emit('joinDoc', this.doc_id, cb)
          },

          cb => {
            return this.client.emit(
              'applyOtUpdate',
              this.doc_id,
              'invalid-update',
              error => {
                this.error = error
                return cb()
              }
            )
          },
        ],
        done
      )
    })

    it('should return an error', function () {
      return expect(this.error).to.exist
    })

    it('should disconnect the client', function (done) {
      return setTimeout(() => {
        this.client.socket.connected.should.equal(false)
        return done()
      }, 300)
    })

    return it('should not put the update in redis', function (done) {
      rclient.llen(
        redisSettings.documentupdater.key_schema.pendingUpdates({
          doc_id: this.doc_id,
        }),
        (error, len) => {
          if (error) return done(error)
          len.should.equal(0)
          return done()
        }
      )
      return null
    })
  })
})
