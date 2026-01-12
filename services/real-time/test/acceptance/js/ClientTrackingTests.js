/* eslint-disable
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
import { expect } from 'chai'

import RealTimeClient from './helpers/RealTimeClient.js'
import MockWebServer from './helpers/MockWebServer.js'
import FixturesManager from './helpers/FixturesManager.js'
import async from 'async'

describe('clientTracking', function () {
  describe('when another logged in user joins a project', function () {
    before(function (done) {
      return async.series(
        [
          cb => {
            return FixturesManager.setUpProject(
              {
                privilegeLevel: 'owner',
                project: { name: 'Test Project' },
              },
              (error, { user_id: userId, project_id: projectId }) => {
                if (error) return done(error)
                this.user_id = userId
                this.project_id = projectId
                return cb()
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
            this.clientA = RealTimeClient.connect(this.project_id, cb)
          },

          cb => {
            RealTimeClient.countConnectedClients(
              this.project_id,
              (err, body) => {
                if (err) return cb(err)
                expect(body).to.deep.equal({ nConnectedClients: 1 })
                cb()
              }
            )
          },

          cb => {
            this.clientB = RealTimeClient.connect(this.project_id, cb)
          },
        ],
        done
      )
    })

    it('should record the initial state in getConnectedUsers', function (done) {
      this.clientA.emit('clientTracking.getConnectedUsers', (error, users) => {
        if (error) return done(error)
        for (const user of Array.from(users)) {
          if (user.client_id === this.clientB.publicId) {
            expect(user.cursorData).to.not.exist
            return done()
          }
        }
        throw new Error('other user was never found')
      })
    })
    it('should list both clients via HTTP', function (done) {
      RealTimeClient.countConnectedClients(this.project_id, (err, body) => {
        if (err) return done(err)
        expect(body).to.deep.equal({ nConnectedClients: 2 })
        done()
      })
    })
  })

  describe('when a client updates its cursor location', function () {
    before(function (done) {
      return async.series(
        [
          cb => {
            return FixturesManager.setUpProject(
              {
                privilegeLevel: 'owner',
                project: { name: 'Test Project' },
              },
              (error, { user_id: userId, project_id: projectId }) => {
                if (error) return done(error)
                this.user_id = userId
                this.project_id = projectId
                return cb()
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
            this.clientA = RealTimeClient.connect(this.project_id, cb)
          },

          cb => {
            this.clientB = RealTimeClient.connect(this.project_id, cb)
          },

          cb => {
            return this.clientA.emit('joinDoc', this.doc_id, cb)
          },

          cb => {
            this.updates = []
            this.clientB.on('clientTracking.clientUpdated', data => {
              return this.updates.push(data)
            })

            return this.clientA.emit(
              'clientTracking.updatePosition',
              {
                row: (this.row = 42),
                column: (this.column = 36),
                doc_id: this.doc_id,
              },
              error => {
                if (error != null) {
                  throw error
                }
                return setTimeout(cb, 300)
              }
            )
          }, // Give the message a chance to reach client B.
        ],
        done
      )
    })

    it('should tell other clients about the update', function () {
      return this.updates.should.deep.equal([
        {
          row: this.row,
          column: this.column,
          doc_id: this.doc_id,
          id: this.clientA.publicId,
          user_id: this.user_id,
          name: 'Joe Bloggs',
        },
      ])
    })

    return it('should record the update in getConnectedUsers', function (done) {
      return this.clientB.emit(
        'clientTracking.getConnectedUsers',
        (error, users) => {
          if (error) return done(error)
          for (const user of Array.from(users)) {
            if (user.client_id === this.clientA.publicId) {
              expect(user.cursorData).to.deep.equal({
                row: this.row,
                column: this.column,
                doc_id: this.doc_id,
              })
              return done()
            }
          }
          throw new Error('user was never found')
        }
      )
    })
  })

  return describe('when an anonymous client updates its cursor location', function () {
    before(function (done) {
      return async.series(
        [
          cb => {
            return FixturesManager.setUpProject(
              {
                privilegeLevel: 'owner',
                project: { name: 'Test Project' },
                publicAccess: 'readAndWrite',
              },
              (
                error,
                { user_id: userId, project_id: projectId, anonymousAccessToken }
              ) => {
                if (error) return done(error)
                this.user_id = userId
                this.project_id = projectId
                this.anonymousAccessToken = anonymousAccessToken
                return cb()
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
            this.clientA = RealTimeClient.connect(this.project_id, cb)
          },

          cb => {
            RealTimeClient.setAnonSession(
              this.project_id,
              this.anonymousAccessToken,
              cb
            )
          },

          cb => {
            this.anonymous = RealTimeClient.connect(this.project_id, cb)
          },

          cb => {
            return this.anonymous.emit('joinDoc', this.doc_id, cb)
          },

          cb => {
            this.updates = []
            this.clientA.on('clientTracking.clientUpdated', data => {
              return this.updates.push(data)
            })

            return this.anonymous.emit(
              'clientTracking.updatePosition',
              {
                row: (this.row = 42),
                column: (this.column = 36),
                doc_id: this.doc_id,
              },
              error => {
                if (error != null) {
                  throw error
                }
                return setTimeout(cb, 300)
              }
            )
          }, // Give the message a chance to reach client B.
        ],
        done
      )
    })

    return it('should tell other clients about the update', function () {
      return this.updates.should.deep.equal([
        {
          row: this.row,
          column: this.column,
          doc_id: this.doc_id,
          id: this.anonymous.publicId,
          user_id: 'anonymous-user',
          name: '',
        },
      ])
    })
  })
})
