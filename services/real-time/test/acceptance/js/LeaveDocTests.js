/* eslint-disable
    no-return-assign,
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

import sinon from 'sinon'
import RealTimeClient from './helpers/RealTimeClient.js'
import MockDocUpdaterServer from './helpers/MockDocUpdaterServer.js'
import FixturesManager from './helpers/FixturesManager.js'
import logger from '@overleaf/logger'
import async from 'async'

describe('leaveDoc', function () {
  before(function () {
    this.lines = ['test', 'doc', 'lines']
    this.version = 42
    this.ops = ['mock', 'doc', 'ops']
    sinon.spy(logger, 'error')
    sinon.spy(logger, 'warn')
    sinon.spy(logger, 'debug')
    return (this.other_doc_id = FixturesManager.getRandomId())
  })

  after(function () {
    logger.error.restore() // remove the spy
    logger.warn.restore()
    return logger.debug.restore()
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
          if (error != null) {
            throw error
          }
          return done()
        })
      })

      return it('should have left the doc room', function (done) {
        return RealTimeClient.getConnectedClient(
          this.client.socket.sessionid,
          (error, client) => {
            if (error) return done(error)
            expect(Array.from(client.rooms).includes(this.doc_id)).to.equal(
              false
            )
            return done()
          }
        )
      })
    })

    describe('then leaving an invalid doc', function () {
      beforeEach(function (done) {
        return this.client.emit('leaveDoc', 'bad-id', error => {
          this.error = error
          return done()
        })
      })

      return it('should return an error', function () {
        return expect(this.error).to.exist
      })
    })

    describe('when sending a leaveDoc request before the previous joinDoc request has completed', function () {
      beforeEach(function (done) {
        this.client.emit('leaveDoc', this.doc_id, () => {})
        this.client.emit('joinDoc', this.doc_id, () => {})
        return this.client.emit('leaveDoc', this.doc_id, error => {
          if (error != null) {
            throw error
          }
          return done()
        })
      })

      it('should not trigger an error', function () {
        return sinon.assert.neverCalledWith(
          logger.error,
          sinon.match.any,
          "not subscribed - shouldn't happen"
        )
      })

      return it('should have left the doc room', function (done) {
        return RealTimeClient.getConnectedClient(
          this.client.socket.sessionid,
          (error, client) => {
            if (error) return done(error)
            expect(Array.from(client.rooms).includes(this.doc_id)).to.equal(
              false
            )
            return done()
          }
        )
      })
    })

    return describe('when sending a leaveDoc for a room the client has not joined ', function () {
      beforeEach(function (done) {
        return this.client.emit('leaveDoc', this.other_doc_id, error => {
          if (error != null) {
            throw error
          }
          return done()
        })
      })

      return it('should trigger a low level message only', function () {
        return sinon.assert.calledWith(
          logger.debug,
          sinon.match.any,
          'ignoring request from client to leave room it is not in'
        )
      })
    })
  })
})
