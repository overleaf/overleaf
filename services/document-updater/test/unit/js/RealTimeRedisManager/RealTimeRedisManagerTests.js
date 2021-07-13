/* eslint-disable
    camelcase,
    no-return-assign,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const sinon = require('sinon')
const modulePath = '../../../../app/js/RealTimeRedisManager.js'
const SandboxedModule = require('sandboxed-module')
const Errors = require('../../../../app/js/Errors')

describe('RealTimeRedisManager', function () {
  beforeEach(function () {
    this.rclient = {
      auth() {},
      exec: sinon.stub(),
    }
    this.rclient.multi = () => this.rclient
    this.pubsubClient = { publish: sinon.stub() }
    this.RealTimeRedisManager = SandboxedModule.require(modulePath, {
      requires: {
        '@overleaf/redis-wrapper': {
          createClient: config =>
            config.name === 'pubsub' ? this.pubsubClient : this.rclient,
        },
        '@overleaf/settings': {
          redis: {
            documentupdater: (this.settings = {
              key_schema: {
                pendingUpdates({ doc_id }) {
                  return `PendingUpdates:${doc_id}`
                },
              },
            }),
            pubsub: {
              name: 'pubsub',
            },
          },
        },
        crypto: (this.crypto = {
          randomBytes: sinon
            .stub()
            .withArgs(4)
            .returns(Buffer.from([0x1, 0x2, 0x3, 0x4])),
        }),
        os: (this.os = { hostname: sinon.stub().returns('somehost') }),
        './Metrics': (this.metrics = { summary: sinon.stub() }),
      },
    })

    this.doc_id = 'doc-id-123'
    this.project_id = 'project-id-123'
    return (this.callback = sinon.stub())
  })

  describe('getPendingUpdatesForDoc', function () {
    beforeEach(function () {
      this.rclient.lrange = sinon.stub()
      return (this.rclient.ltrim = sinon.stub())
    })

    describe('successfully', function () {
      beforeEach(function () {
        this.updates = [
          { op: [{ i: 'foo', p: 4 }] },
          { op: [{ i: 'foo', p: 4 }] },
        ]
        this.jsonUpdates = this.updates.map(update => JSON.stringify(update))
        this.rclient.exec = sinon
          .stub()
          .callsArgWith(0, null, [this.jsonUpdates])
        return this.RealTimeRedisManager.getPendingUpdatesForDoc(
          this.doc_id,
          this.callback
        )
      })

      it('should get the pending updates', function () {
        return this.rclient.lrange
          .calledWith(`PendingUpdates:${this.doc_id}`, 0, 7)
          .should.equal(true)
      })

      it('should delete the pending updates', function () {
        return this.rclient.ltrim
          .calledWith(`PendingUpdates:${this.doc_id}`, 8, -1)
          .should.equal(true)
      })

      return it('should call the callback with the updates', function () {
        return this.callback.calledWith(null, this.updates).should.equal(true)
      })
    })

    return describe("when the JSON doesn't parse", function () {
      beforeEach(function () {
        this.jsonUpdates = [
          JSON.stringify({ op: [{ i: 'foo', p: 4 }] }),
          'broken json',
        ]
        this.rclient.exec = sinon
          .stub()
          .callsArgWith(0, null, [this.jsonUpdates])
        return this.RealTimeRedisManager.getPendingUpdatesForDoc(
          this.doc_id,
          this.callback
        )
      })

      return it('should return an error to the callback', function () {
        return this.callback
          .calledWith(sinon.match.has('name', 'SyntaxError'))
          .should.equal(true)
      })
    })
  })

  describe('getUpdatesLength', function () {
    beforeEach(function () {
      this.rclient.llen = sinon.stub().yields(null, (this.length = 3))
      return this.RealTimeRedisManager.getUpdatesLength(
        this.doc_id,
        this.callback
      )
    })

    it('should look up the length', function () {
      return this.rclient.llen
        .calledWith(`PendingUpdates:${this.doc_id}`)
        .should.equal(true)
    })

    return it('should return the length', function () {
      return this.callback.calledWith(null, this.length).should.equal(true)
    })
  })

  return describe('sendData', function () {
    beforeEach(function () {
      this.message_id = 'doc:somehost:01020304-0'
      return this.RealTimeRedisManager.sendData({ op: 'thisop' })
    })

    it('should send the op with a message id', function () {
      return this.pubsubClient.publish
        .calledWith(
          'applied-ops',
          JSON.stringify({ op: 'thisop', _id: this.message_id })
        )
        .should.equal(true)
    })

    return it('should track the payload size', function () {
      return this.metrics.summary
        .calledWith(
          'redis.publish.applied-ops',
          JSON.stringify({ op: 'thisop', _id: this.message_id }).length
        )
        .should.equal(true)
    })
  })
})
