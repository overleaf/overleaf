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
const { expect } = require('chai')

const RealTimeClient = require('./helpers/RealTimeClient')
const MockWebServer = require('./helpers/MockWebServer')
const FixturesManager = require('./helpers/FixturesManager')

const async = require('async')

describe('clientTracking', function () {
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
            this.clientA = RealTimeClient.connect()
            return this.clientA.on('connectionAccepted', cb)
          },

          cb => {
            this.clientB = RealTimeClient.connect()
            return this.clientB.on('connectionAccepted', cb)
          },

          cb => {
            return this.clientA.emit(
              'joinProject',
              {
                project_id: this.project_id,
              },
              cb
            )
          },

          cb => {
            return this.clientA.emit('joinDoc', this.doc_id, cb)
          },

          cb => {
            return this.clientB.emit(
              'joinProject',
              {
                project_id: this.project_id,
              },
              cb
            )
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
            this.clientA = RealTimeClient.connect()
            return this.clientA.on('connectionAccepted', cb)
          },

          cb => {
            return this.clientA.emit(
              'joinProject',
              {
                project_id: this.project_id,
              },
              cb
            )
          },

          cb => {
            return RealTimeClient.setSession({}, cb)
          },

          cb => {
            this.anonymous = RealTimeClient.connect()
            return this.anonymous.on('connectionAccepted', cb)
          },

          cb => {
            return this.anonymous.emit(
              'joinProject',
              {
                project_id: this.project_id,
              },
              cb
            )
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
