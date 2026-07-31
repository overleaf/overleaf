import { expect } from 'chai'

import RealTimeClient from './helpers/RealTimeClient.js'
import FixturesManager from './helpers/FixturesManager.js'
import async from 'async'

// leaveDoc is a no-op on the server (real-time no longer tracks per-doc room
// membership); the RPC is kept so clients still receive an ack. These tests
// cover that contract: a valid leaveDoc acks without error, an invalid doc id
// is rejected by the router validation.
describe('leaveDoc', function () {
  before(function () {
    this.lines = ['test', 'doc', 'lines']
    this.version = 42
    this.ops = ['mock', 'doc', 'ops']
  })

  return describe('when joined to a doc', function () {
    beforeEach(function (done) {
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

    describe('then leaving the doc', function () {
      beforeEach(function (done) {
        return this.client.emit('leaveDoc', this.doc_id, error => {
          this.error = error
          return done()
        })
      })

      return it('should not return an error', function () {
        return expect(this.error).to.not.exist
      })
    })

    return describe('then leaving an invalid doc', function () {
      beforeEach(function (done) {
        return this.client.emit('leaveDoc', 'bad-id', error => {
          this.error = error
          return done()
        })
      })

      return it('should return an invalid id error', function () {
        return this.error.message.should.equal('invalid Mongo ObjectId')
      })
    })
  })
})
