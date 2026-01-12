/* eslint-disable
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
import { expect } from 'chai'

import RealTimeClient from './helpers/RealTimeClient.js'
import MockWebServer from './helpers/MockWebServer.js'
import FixturesManager from './helpers/FixturesManager.js'
import async from 'async'
import settings from '@overleaf/settings'
import redis from '@overleaf/redis-wrapper'
const rclient = redis.createClient(settings.redis.pubsub)

describe('receiveUpdate', function () {
  beforeEach(function (done) {
    this.lines = ['test', 'doc', 'lines']
    this.version = 42
    this.ops = ['mock', 'doc', 'ops']

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
          return this.clientB.emit('joinDoc', this.doc_id, cb)
        },

        cb => {
          return FixturesManager.setUpProject(
            {
              privilegeLevel: 'owner',
              project: { name: 'Test Project' },
            },
            (error, { user_id: userIdSecond, project_id: projectIdSecond }) => {
              if (error) return done(error)
              this.user_id_second = userIdSecond
              this.project_id_second = projectIdSecond
              return cb()
            }
          )
        },

        cb => {
          return FixturesManager.setUpDoc(
            this.project_id_second,
            { lines: this.lines, version: this.version, ops: this.ops },
            (e, { doc_id: docIdSecond }) => {
              this.doc_id_second = docIdSecond
              return cb(e)
            }
          )
        },

        cb => {
          this.clientC = RealTimeClient.connect(this.project_id_second, cb)
        },

        cb => {
          return this.clientC.emit('joinDoc', this.doc_id_second, cb)
        },

        cb => {
          this.clientAUpdates = []
          this.clientA.on('otUpdateApplied', update =>
            this.clientAUpdates.push(update)
          )
          this.clientBUpdates = []
          this.clientB.on('otUpdateApplied', update =>
            this.clientBUpdates.push(update)
          )
          this.clientCUpdates = []
          this.clientC.on('otUpdateApplied', update =>
            this.clientCUpdates.push(update)
          )

          this.clientAErrors = []
          this.clientA.on('otUpdateError', error =>
            this.clientAErrors.push(error)
          )
          this.clientBErrors = []
          this.clientB.on('otUpdateError', error =>
            this.clientBErrors.push(error)
          )
          this.clientCErrors = []
          this.clientC.on('otUpdateError', error =>
            this.clientCErrors.push(error)
          )
          return cb()
        },
      ],
      done
    )
  })

  afterEach(function () {
    if (this.clientA != null) {
      this.clientA.disconnect()
    }
    if (this.clientB != null) {
      this.clientB.disconnect()
    }
    return this.clientC != null ? this.clientC.disconnect() : undefined
  })

  describe('with an update from clientA', function () {
    beforeEach(function (done) {
      this.update = {
        doc_id: this.doc_id,
        op: {
          meta: {
            source: this.clientA.publicId,
          },
          v: this.version,
          doc: this.doc_id,
          op: [{ i: 'foo', p: 50 }],
        },
      }
      rclient.publish('applied-ops', JSON.stringify(this.update))
      return setTimeout(done, 200)
    }) // Give clients time to get message

    it('should send the full op to clientB', function () {
      return this.clientBUpdates.should.deep.equal([this.update.op])
    })

    it('should send an ack to clientA', function () {
      return this.clientAUpdates.should.deep.equal([
        {
          v: this.version,
          doc: this.doc_id,
        },
      ])
    })

    return it('should send nothing to clientC', function () {
      return this.clientCUpdates.should.deep.equal([])
    })
  })

  describe('with an update from clientC', function () {
    beforeEach(function (done) {
      this.update = {
        doc_id: this.doc_id_second,
        op: {
          meta: {
            source: this.clientC.publicId,
          },
          v: this.version,
          doc: this.doc_id_second,
          op: [{ i: 'update from clientC', p: 50 }],
        },
      }
      rclient.publish('applied-ops', JSON.stringify(this.update))
      return setTimeout(done, 200)
    }) // Give clients time to get message

    it('should send nothing to clientA', function () {
      return this.clientAUpdates.should.deep.equal([])
    })

    it('should send nothing to clientB', function () {
      return this.clientBUpdates.should.deep.equal([])
    })

    return it('should send an ack to clientC', function () {
      return this.clientCUpdates.should.deep.equal([
        {
          v: this.version,
          doc: this.doc_id_second,
        },
      ])
    })
  })

  describe('with an update from a remote client for project 1', function () {
    beforeEach(function (done) {
      this.update = {
        doc_id: this.doc_id,
        op: {
          meta: {
            source: 'this-is-a-remote-client-id',
          },
          v: this.version,
          doc: this.doc_id,
          op: [{ i: 'foo', p: 50 }],
        },
      }
      rclient.publish('applied-ops', JSON.stringify(this.update))
      return setTimeout(done, 200)
    }) // Give clients time to get message

    it('should send the full op to clientA', function () {
      return this.clientAUpdates.should.deep.equal([this.update.op])
    })

    it('should send the full op to clientB', function () {
      return this.clientBUpdates.should.deep.equal([this.update.op])
    })

    return it('should send nothing to clientC', function () {
      return this.clientCUpdates.should.deep.equal([])
    })
  })

  describe('with an error for the first project', function () {
    beforeEach(function (done) {
      rclient.publish(
        'applied-ops',
        JSON.stringify({
          doc_id: this.doc_id,
          error: (this.error = 'something went wrong'),
        })
      )
      return setTimeout(done, 200)
    }) // Give clients time to get message

    it('should send the error to the clients in the first project', function () {
      this.clientAErrors.should.deep.equal([this.error])
      return this.clientBErrors.should.deep.equal([this.error])
    })

    it('should not send any errors to the client in the second project', function () {
      return this.clientCErrors.should.deep.equal([])
    })

    it('should disconnect the clients of the first project', function () {
      this.clientA.socket.connected.should.equal(false)
      return this.clientB.socket.connected.should.equal(false)
    })

    return it('should not disconnect the client in the second project', function () {
      return this.clientC.socket.connected.should.equal(true)
    })
  })

  return describe('with an error for the second project', function () {
    beforeEach(function (done) {
      rclient.publish(
        'applied-ops',
        JSON.stringify({
          doc_id: this.doc_id_second,
          error: (this.error = 'something went wrong'),
        })
      )
      return setTimeout(done, 200)
    }) // Give clients time to get message

    it('should not send any errors to the clients in the first project', function () {
      this.clientAErrors.should.deep.equal([])
      return this.clientBErrors.should.deep.equal([])
    })

    it('should send the error to the client in the second project', function () {
      return this.clientCErrors.should.deep.equal([this.error])
    })

    it('should not disconnect the clients of the first project', function () {
      this.clientA.socket.connected.should.equal(true)
      return this.clientB.socket.connected.should.equal(true)
    })

    return it('should disconnect the client in the second project', function () {
      return this.clientC.socket.connected.should.equal(false)
    })
  })
})
