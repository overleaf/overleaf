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
import { expect } from 'chai'

import RealTimeClient from './helpers/RealTimeClient.js'
import MockDocUpdaterServer from './helpers/MockDocUpdaterServer.js'
import FixturesManager from './helpers/FixturesManager.js'
import async from 'async'

describe('joinDoc', function () {
  before(function () {
    this.lines = ['test', 'doc', 'lines']
    this.version = 42
    this.ops = ['mock', 'doc', 'ops']
    return (this.ranges = { mock: 'ranges' })
  })

  describe('when authorised readAndWrite', function () {
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
              {
                lines: this.lines,
                version: this.version,
                ops: this.ops,
                ranges: this.ranges,
              },
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
            return this.client.emit(
              'joinDoc',
              this.doc_id,
              (error, ...rest) => {
                ;[...this.returnedArgs] = Array.from(rest)
                return cb(error)
              }
            )
          },
        ],
        done
      )
    })

    it('should get the doc from the doc updater', function () {
      return MockDocUpdaterServer.getDocument
        .calledWith(this.project_id, this.doc_id, -1)
        .should.equal(true)
    })

    it('should return the doc lines, version, ranges and ops', function () {
      return this.returnedArgs.should.deep.equal([
        this.lines,
        this.version,
        this.ops,
        this.ranges,
        'sharejs-text-ot',
      ])
    })

    return it('should have joined the doc room', function (done) {
      return RealTimeClient.getConnectedClient(
        this.client.socket.sessionid,
        (error, client) => {
          if (error) return done(error)
          expect(Array.from(client.rooms).includes(this.doc_id)).to.equal(true)
          return done()
        }
      )
    })
  })

  describe('when authorised readOnly', function () {
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
              {
                lines: this.lines,
                version: this.version,
                ops: this.ops,
                ranges: this.ranges,
              },
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
            return this.client.emit(
              'joinDoc',
              this.doc_id,
              (error, ...rest) => {
                ;[...this.returnedArgs] = Array.from(rest)
                return cb(error)
              }
            )
          },
        ],
        done
      )
    })

    it('should get the doc from the doc updater', function () {
      return MockDocUpdaterServer.getDocument
        .calledWith(this.project_id, this.doc_id, -1)
        .should.equal(true)
    })

    it('should return the doc lines, version, ranges and ops', function () {
      return this.returnedArgs.should.deep.equal([
        this.lines,
        this.version,
        this.ops,
        this.ranges,
        'sharejs-text-ot',
      ])
    })

    return it('should have joined the doc room', function (done) {
      return RealTimeClient.getConnectedClient(
        this.client.socket.sessionid,
        (error, client) => {
          if (error) return done(error)
          expect(Array.from(client.rooms).includes(this.doc_id)).to.equal(true)
          return done()
        }
      )
    })
  })

  describe('when authorised as owner', function () {
    before(function (done) {
      return async.series(
        [
          cb => {
            return FixturesManager.setUpProject(
              {
                privilegeLevel: 'owner',
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
              {
                lines: this.lines,
                version: this.version,
                ops: this.ops,
                ranges: this.ranges,
              },
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
            return this.client.emit(
              'joinDoc',
              this.doc_id,
              (error, ...rest) => {
                ;[...this.returnedArgs] = Array.from(rest)
                return cb(error)
              }
            )
          },
        ],
        done
      )
    })

    it('should get the doc from the doc updater', function () {
      return MockDocUpdaterServer.getDocument
        .calledWith(this.project_id, this.doc_id, -1)
        .should.equal(true)
    })

    it('should return the doc lines, version, ranges and ops', function () {
      return this.returnedArgs.should.deep.equal([
        this.lines,
        this.version,
        this.ops,
        this.ranges,
        'sharejs-text-ot',
      ])
    })

    return it('should have joined the doc room', function (done) {
      return RealTimeClient.getConnectedClient(
        this.client.socket.sessionid,
        (error, client) => {
          if (error) return done(error)
          expect(Array.from(client.rooms).includes(this.doc_id)).to.equal(true)
          return done()
        }
      )
    })
  })

  // It is impossible to write an acceptance test to test joining an unauthorized
  // project, since joinProject already catches that. If you can join a project,
  // then you can join a doc in that project.

  describe('for an invalid doc', function () {
    before(function (done) {
      return async.series(
        [
          cb => {
            return FixturesManager.setUpProject(
              {
                privilegeLevel: 'owner',
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
              {
                lines: this.lines,
                version: this.version,
                ops: this.ops,
                ranges: this.ranges,
              },
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
            return this.client.emit(
              'joinDoc',
              'invalid-doc-id',
              (error, ...rest) => {
                this.error = error
                return cb()
              }
            )
          },
        ],
        done
      )
    })

    it('should not get the doc from the doc updater', function () {
      return MockDocUpdaterServer.getDocument
        .calledWith(this.project_id, 'invalid-doc-id')
        .should.equal(false)
    })

    it('should return an invalid id error', function () {
      this.error.message.should.equal('invalid Mongo ObjectId')
    })

    return it('should not have joined the doc room', function (done) {
      return RealTimeClient.getConnectedClient(
        this.client.socket.sessionid,
        (error, client) => {
          if (error) return done(error)
          expect(Array.from(client.rooms).includes('invalid-doc-id')).to.equal(
            false
          )
          return done()
        }
      )
    })
  })

  describe('with a fromVersion', function () {
    before(function (done) {
      this.fromVersion = 36
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
              {
                lines: this.lines,
                version: this.version,
                ops: this.ops,
                ranges: this.ranges,
              },
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
            return this.client.emit(
              'joinDoc',
              this.doc_id,
              this.fromVersion,
              (error, ...rest) => {
                ;[...this.returnedArgs] = Array.from(rest)
                return cb(error)
              }
            )
          },
        ],
        done
      )
    })

    it('should get the doc from the doc updater with the fromVersion', function () {
      return MockDocUpdaterServer.getDocument
        .calledWith(this.project_id, this.doc_id, this.fromVersion)
        .should.equal(true)
    })

    it('should return the doc lines, version, ranges and ops', function () {
      return this.returnedArgs.should.deep.equal([
        this.lines,
        this.version,
        this.ops,
        this.ranges,
        'sharejs-text-ot',
      ])
    })

    return it('should have joined the doc room', function (done) {
      return RealTimeClient.getConnectedClient(
        this.client.socket.sessionid,
        (error, client) => {
          if (error) return done(error)
          expect(Array.from(client.rooms).includes(this.doc_id)).to.equal(true)
          return done()
        }
      )
    })
  })

  describe('with options', function () {
    before(function (done) {
      this.options = { encodeRanges: true }
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
              {
                lines: this.lines,
                version: this.version,
                ops: this.ops,
                ranges: this.ranges,
              },
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
            return this.client.emit(
              'joinDoc',
              this.doc_id,
              this.options,
              (error, ...rest) => {
                ;[...this.returnedArgs] = Array.from(rest)
                return cb(error)
              }
            )
          },
        ],
        done
      )
    })

    it('should get the doc from the doc updater with the default fromVersion', function () {
      return MockDocUpdaterServer.getDocument
        .calledWith(this.project_id, this.doc_id, -1)
        .should.equal(true)
    })

    it('should return the doc lines, version, ranges and ops', function () {
      return this.returnedArgs.should.deep.equal([
        this.lines,
        this.version,
        this.ops,
        this.ranges,
        'sharejs-text-ot',
      ])
    })

    return it('should have joined the doc room', function (done) {
      return RealTimeClient.getConnectedClient(
        this.client.socket.sessionid,
        (error, client) => {
          if (error) return done(error)
          expect(Array.from(client.rooms).includes(this.doc_id)).to.equal(true)
          return done()
        }
      )
    })
  })

  describe('with fromVersion and options', function () {
    before(function (done) {
      this.fromVersion = 36
      this.options = { encodeRanges: true }
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
              {
                lines: this.lines,
                version: this.version,
                ops: this.ops,
                ranges: this.ranges,
              },
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
            return this.client.emit(
              'joinDoc',
              this.doc_id,
              this.fromVersion,
              this.options,
              (error, ...rest) => {
                ;[...this.returnedArgs] = Array.from(rest)
                return cb(error)
              }
            )
          },
        ],
        done
      )
    })

    it('should get the doc from the doc updater with the fromVersion', function () {
      return MockDocUpdaterServer.getDocument
        .calledWith(this.project_id, this.doc_id, this.fromVersion)
        .should.equal(true)
    })

    it('should return the doc lines, version, ranges and ops', function () {
      return this.returnedArgs.should.deep.equal([
        this.lines,
        this.version,
        this.ops,
        this.ranges,
        'sharejs-text-ot',
      ])
    })

    return it('should have joined the doc room', function (done) {
      return RealTimeClient.getConnectedClient(
        this.client.socket.sessionid,
        (error, client) => {
          if (error) return done(error)
          expect(Array.from(client.rooms).includes(this.doc_id)).to.equal(true)
          return done()
        }
      )
    })
  })

  describe('with type=history-ot', function () {
    before(function (done) {
      async.series(
        [
          cb => {
            FixturesManager.setUpProject(
              { privilegeLevel: 'owner' },
              (e, { project_id: projectId, user_id: userId }) => {
                this.project_id = projectId
                this.user_id = userId
                cb(e)
              }
            )
          },

          cb => {
            FixturesManager.setUpDoc(
              this.project_id,
              {
                lines: this.lines,
                version: this.version,
                ops: this.ops,
                ranges: this.ranges,
                type: 'history-ot',
              },
              (e, { doc_id: docId }) => {
                this.doc_id = docId
                cb(e)
              }
            )
          },
        ],
        done
      )
    })

    describe('when support is indicated', function () {
      before(function (done) {
        MockDocUpdaterServer.getDocument.resetHistory()
        async.series(
          [
            cb => {
              this.client = RealTimeClient.connect(this.project_id, cb)
            },
            cb =>
              this.client.emit(
                'joinDoc',
                this.doc_id,
                { supportsHistoryOT: true },
                (error, ...rest) => {
                  ;[...this.returnedArgs] = Array.from(rest)
                  cb(error)
                }
              ),
          ],
          done
        )
      })

      it('should get the doc from the doc updater', function () {
        MockDocUpdaterServer.getDocument
          .calledWith(this.project_id, this.doc_id, -1)
          .should.equal(true)
      })

      it('should return the doc lines, version, ranges and ops', function () {
        this.returnedArgs.should.deep.equal([
          this.lines,
          this.version,
          this.ops,
          this.ranges,
          'history-ot',
        ])
      })

      it('should have joined the doc room', function (done) {
        RealTimeClient.getConnectedClient(
          this.client.socket.sessionid,
          (error, client) => {
            if (error) return done(error)
            expect(client.rooms).to.deep.equal([this.project_id, this.doc_id])
            done()
          }
        )
      })
    })

    describe('when support is not indicated', function () {
      before(function (done) {
        MockDocUpdaterServer.getDocument.resetHistory()
        async.series(
          [
            cb => {
              this.client = RealTimeClient.connect(this.project_id, cb)
            },
            cb =>
              this.client.emit('joinDoc', this.doc_id, (error, ...rest) => {
                this.error = error
                ;[...this.returnedArgs] = Array.from(rest)
                cb()
              }),
          ],
          done
        )
      })

      it('should get the doc from the doc updater', function () {
        MockDocUpdaterServer.getDocument
          .calledWith(this.project_id, this.doc_id, -1)
          .should.equal(true)
      })

      it('should return an error', function () {
        expect(this.error).to.deep.equal({
          message: 'client does not support history-ot',
        })
      })

      it('should not return the doc lines, version, ranges and ops', function () {
        this.returnedArgs.should.deep.equal([])
      })

      it('should leave the doc room again', function (done) {
        RealTimeClient.getConnectedClient(
          this.client.socket.sessionid,
          (error, client) => {
            if (error) return done(error)
            expect(client.rooms).to.deep.equal([this.project_id])
            done()
          }
        )
      })
    })
  })
})
