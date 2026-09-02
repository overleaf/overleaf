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
          // clientD is in the first project, but has not joined the doc
          this.clientD = RealTimeClient.connect(this.project_id, cb)
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
          this.clientDUpdates = []
          this.clientD.on('otUpdateApplied', update =>
            this.clientDUpdates.push(update)
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
          this.clientDErrors = []
          this.clientD.on('otUpdateError', error =>
            this.clientDErrors.push(error)
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
    if (this.clientC != null) {
      this.clientC.disconnect()
    }
    return this.clientD != null ? this.clientD.disconnect() : undefined
  })

  describe('with an update from clientA published on the editor-events channel', function () {
    beforeEach(function (done) {
      this.update = {
        project_id: this.project_id,
        doc_id: this.doc_id,
        message: 'otUpdateApplied',
        op: {
          meta: {
            source: this.clientA.publicId,
          },
          v: this.version,
          doc: this.doc_id,
          op: [{ i: 'foo', p: 50 }],
        },
      }
      rclient.publish(
        `editor-events:${this.project_id}`,
        JSON.stringify(this.update)
      )
      setTimeout(done, 200)
    }) // Give clients time to get message

    it('should send the full op to clientB', function () {
      this.clientBUpdates.should.deep.equal([this.update.op])
    })

    it('should send an ack to clientA', function () {
      this.clientAUpdates.should.deep.equal([
        {
          v: this.version,
          doc: this.doc_id,
        },
      ])
    })

    it('should send the full op to clientD, who has not joined the doc', function () {
      this.clientDUpdates.should.deep.equal([this.update.op])
    })

    it('should send nothing to clientC', function () {
      this.clientCUpdates.should.deep.equal([])
    })
  })

  describe('with an update from a remote client published on the base editor-events channel', function () {
    // producers with PUBLISH_ON_INDIVIDUAL_CHANNELS disabled publish on the
    // base channel instead of the per-project channel
    beforeEach(function (done) {
      this.update = {
        project_id: this.project_id,
        doc_id: this.doc_id,
        message: 'otUpdateApplied',
        op: {
          meta: {
            source: 'this-is-a-remote-client-id',
          },
          v: this.version,
          doc: this.doc_id,
          op: [{ i: 'foo', p: 50 }],
        },
      }
      rclient.publish('editor-events', JSON.stringify(this.update))
      setTimeout(done, 200)
    }) // Give clients time to get message

    it('should send the full op to the clients in the first project', function () {
      this.clientAUpdates.should.deep.equal([this.update.op])
      this.clientBUpdates.should.deep.equal([this.update.op])
      this.clientDUpdates.should.deep.equal([this.update.op])
    })

    it('should send nothing to clientC', function () {
      this.clientCUpdates.should.deep.equal([])
    })
  })

  describe('with an error for the first project published on the editor-events channel', function () {
    beforeEach(function (done) {
      rclient.publish(
        `editor-events:${this.project_id}`,
        JSON.stringify({
          project_id: this.project_id,
          doc_id: this.doc_id,
          message: 'otUpdateError',
          error: (this.error = 'something went wrong'),
        })
      )
      setTimeout(done, 200)
    }) // Give clients time to get message

    it('should send the error to the clients that joined the doc', function () {
      this.clientAErrors.should.deep.equal([this.error])
      this.clientBErrors.should.deep.equal([this.error])
    })

    it('should disconnect the clients that joined the doc', function () {
      this.clientA.socket.connected.should.equal(false)
      this.clientB.socket.connected.should.equal(false)
    })

    it('should not send the error to clientD, who has not joined the doc', function () {
      this.clientDErrors.should.deep.equal([])
      this.clientD.socket.connected.should.equal(true)
    })

    it('should not send any errors to the client in the second project', function () {
      this.clientCErrors.should.deep.equal([])
      this.clientC.socket.connected.should.equal(true)
    })
  })

  describe('with an update for the second project on the editor-events channel', function () {
    beforeEach(function (done) {
      this.update = {
        project_id: this.project_id_second,
        doc_id: this.doc_id_second,
        message: 'otUpdateApplied',
        op: {
          meta: {
            source: this.clientC.publicId,
          },
          v: this.version,
          doc: this.doc_id_second,
          op: [{ i: 'bar', p: 50 }],
        },
      }
      rclient.publish(
        `editor-events:${this.project_id_second}`,
        JSON.stringify(this.update)
      )
      setTimeout(done, 200)
    }) // Give clients time to get message

    it('should send an ack to clientC', function () {
      this.clientCUpdates.should.deep.equal([
        {
          v: this.version,
          doc: this.doc_id_second,
        },
      ])
    })

    it('should send nothing to the clients in the first project', function () {
      this.clientAUpdates.should.deep.equal([])
      this.clientBUpdates.should.deep.equal([])
      this.clientDUpdates.should.deep.equal([])
    })
  })

  describe('with an error for the second project on the editor-events channel', function () {
    beforeEach(function (done) {
      rclient.publish(
        `editor-events:${this.project_id_second}`,
        JSON.stringify({
          project_id: this.project_id_second,
          doc_id: this.doc_id_second,
          message: 'otUpdateError',
          error: (this.error = 'something went wrong'),
        })
      )
      setTimeout(done, 200)
    }) // Give clients time to get message

    it('should send the error to the client in the second project', function () {
      this.clientCErrors.should.deep.equal([this.error])
      this.clientC.socket.connected.should.equal(false)
    })

    it('should not send any errors to the clients in the first project', function () {
      this.clientAErrors.should.deep.equal([])
      this.clientBErrors.should.deep.equal([])
      this.clientDErrors.should.deep.equal([])
      this.clientA.socket.connected.should.equal(true)
      this.clientB.socket.connected.should.equal(true)
    })
  })
})
