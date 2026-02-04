/* eslint-disable
    no-return-assign,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
import async from 'async'

import { expect } from 'chai'
import RealTimeClient from './helpers/RealTimeClient.js'
import MockDocUpdaterServer from './helpers/MockDocUpdaterServer.js'
import MockWebServer from './helpers/MockWebServer.js'
import FixturesManager from './helpers/FixturesManager.js'
import settings from '@overleaf/settings'
import redis from '@overleaf/redis-wrapper'
const rclient = redis.createClient(settings.redis.pubsub)
const rclientRT = redis.createClient(settings.redis.realtime)
const KeysRT = settings.redis.realtime.key_schema

describe('EarlyDisconnect', function () {
  before(function (done) {
    return MockDocUpdaterServer.run(done)
  })

  describe('when the client disconnects before joinProject completes', function () {
    before(function () {
      // slow down web-api requests to force the race condition
      this.actualWebAPIjoinProject = MockWebServer.joinProject
      MockWebServer.joinProject = (...args) =>
        setTimeout(() => this.actualWebAPIjoinProject(...args), 300)
    })

    after(function () {
      return (MockWebServer.joinProject = this.actualWebAPIjoinProject)
    })

    beforeEach(function (done) {
      return async.series(
        [
          cb => {
            return FixturesManager.setUpProject(
              {
                privilegeLevel: 'owner',
                project: {
                  name: 'Test Project',
                },
              },
              (e, { project_id: projectId, user_id: userId }) => {
                this.project_id = projectId
                this.user_id = userId
                return cb()
              }
            )
          },

          cb => {
            this.clientA = RealTimeClient.connect(this.project_id, cb)
            // disconnect after the handshake and before joinProject completes
            setTimeout(() => this.clientA.disconnect(), 100)
            this.clientA.on('disconnect', () => cb())
          },

          cb => {
            // wait for joinDoc and subscribe
            return setTimeout(cb, 500)
          },
        ],
        done
      )
    })

    // we can force the race condition, there is no need to repeat too often
    return Array.from(Array.from({ length: 5 }).map((_, i) => i + 1)).map(
      attempt =>
        it(`should not subscribe to the pub/sub channel anymore (race ${attempt})`, function (done) {
          rclient.pubsub('CHANNELS', (err, resp) => {
            if (err) {
              return done(err)
            }
            expect(resp).to.not.include(`editor-events:${this.project_id}`)
            return done()
          })
          return null
        })
    )
  })

  describe('when the client disconnects before joinDoc completes', function () {
    beforeEach(function (done) {
      return async.series(
        [
          cb => {
            return FixturesManager.setUpProject(
              {
                privilegeLevel: 'owner',
                project: {
                  name: 'Test Project',
                },
              },
              (e, { project_id: projectId, user_id: userId }) => {
                this.project_id = projectId
                this.user_id = userId
                return cb()
              }
            )
          },

          cb => {
            this.clientA = RealTimeClient.connect(
              this.project_id,
              (error, project, privilegeLevel, protocolVersion) => {
                this.project = project
                this.privilegeLevel = privilegeLevel
                this.protocolVersion = protocolVersion
                return cb(error)
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
            this.clientA.emit('joinDoc', this.doc_id, () => {})
            // disconnect before joinDoc completes
            this.clientA.on('disconnect', () => cb())
            return this.clientA.disconnect()
          },

          cb => {
            // wait for subscribe and unsubscribe
            return setTimeout(cb, 100)
          },
        ],
        done
      )
    })

    // we can not force the race condition, so we have to try many times
    return Array.from(Array.from({ length: 20 }).map((_, i) => i + 1)).map(
      attempt =>
        it(`should not subscribe to the pub/sub channels anymore (race ${attempt})`, function (done) {
          rclient.pubsub('CHANNELS', (err, resp) => {
            if (err) {
              return done(err)
            }
            expect(resp).to.not.include(`editor-events:${this.project_id}`)

            return rclient.pubsub('CHANNELS', (err, resp) => {
              if (err) {
                return done(err)
              }
              expect(resp).to.not.include(`applied-ops:${this.doc_id}`)
              return done()
            })
          })
          return null
        })
    )
  })

  return describe('when the client disconnects before clientTracking.updatePosition starts', function () {
    beforeEach(function (done) {
      return async.series(
        [
          cb => {
            return FixturesManager.setUpProject(
              {
                privilegeLevel: 'owner',
                project: {
                  name: 'Test Project',
                },
              },
              (e, { project_id: projectId, user_id: userId }) => {
                this.project_id = projectId
                this.user_id = userId
                return cb()
              }
            )
          },

          cb => {
            this.clientA = RealTimeClient.connect(
              this.project_id,
              (error, project, privilegeLevel, protocolVersion) => {
                this.project = project
                this.privilegeLevel = privilegeLevel
                this.protocolVersion = protocolVersion
                return cb(error)
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
            return this.clientA.emit('joinDoc', this.doc_id, cb)
          },

          cb => {
            this.clientA.emit(
              'clientTracking.updatePosition',
              {
                row: 42,
                column: 36,
                doc_id: this.doc_id,
              },
              () => {}
            )
            // disconnect before updateClientPosition completes
            this.clientA.on('disconnect', () => cb())
            return this.clientA.disconnect()
          },

          cb => {
            // wait for updateClientPosition
            return setTimeout(cb, 100)
          },
        ],
        done
      )
    })

    // we can not force the race condition, so we have to try many times
    return Array.from(Array.from({ length: 20 }).map((_, i) => i + 1)).map(
      attempt =>
        it(`should not show the client as connected (race ${attempt})`, function (done) {
          rclientRT.smembers(
            KeysRT.clientsInProject({ project_id: this.project_id }),
            (err, results) => {
              if (err) {
                return done(err)
              }
              expect(results).to.deep.equal([])
              return done()
            }
          )
          return null
        })
    )
  })
})
