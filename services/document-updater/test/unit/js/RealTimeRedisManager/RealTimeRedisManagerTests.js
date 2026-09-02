/* eslint-disable
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
        '@overleaf/settings': (this.Settings = {
          redis: {
            documentupdater: (this.settings = {
              key_schema: {
                pendingProjectUpdates({ project_id: projectId }) {
                  return `PendingProjectUpdates:${projectId}`
                },
              },
            }),
            pubsub: {
              name: 'pubsub',
            },
          },
        }),
        crypto: (this.crypto = {
          randomBytes: sinon
            .stub()
            .withArgs(4)
            .returns(Buffer.from([0x1, 0x2, 0x3, 0x4])),
        }),
        os: (this.os = { hostname: sinon.stub().returns('somehost') }),
        './Metrics': (this.metrics = {
          summary: sinon.stub(),
          histogram: sinon.stub(),
        }),
      },
    })

    this.doc_id = 'doc-id-123'
    this.project_id = 'project-id-123'
    return (this.callback = sinon.stub())
  })

  describe('getPendingProjectUpdates', function () {
    beforeEach(function () {
      this.rclient.llen = sinon.stub()
      this.rclient.lrange = sinon.stub()
      this.rclient.ltrim = sinon.stub()
    })

    describe('successfully', function () {
      beforeEach(function () {
        this.updates = [
          { doc: 'doc-1', op: [{ i: 'foo', p: 4 }] },
          { doc: 'doc-2', op: [{ i: 'bar', p: 6 }] },
        ]
        this.jsonUpdates = this.updates.map(update => JSON.stringify(update))
        this.rclient.exec = sinon.stub().yields(null, [2, this.jsonUpdates])
        return this.RealTimeRedisManager.getPendingProjectUpdates(
          this.project_id,
          this.callback
        )
      })

      it('should get the pending updates from the per-project queue', function () {
        return this.rclient.lrange
          .calledWith(`PendingProjectUpdates:${this.project_id}`, 0, 7)
          .should.equal(true)
      })

      it('should delete the pending updates', function () {
        return this.rclient.ltrim
          .calledWith(`PendingProjectUpdates:${this.project_id}`, 8, -1)
          .should.equal(true)
      })

      return it('should call the callback with the updates', function () {
        return this.callback.calledWith(null, this.updates).should.equal(true)
      })
    })

    return describe("when the JSON doesn't parse", function () {
      beforeEach(function () {
        this.jsonUpdates = [
          JSON.stringify({ doc: 'doc-1', op: [{ i: 'foo', p: 4 }] }),
          'broken json',
        ]
        this.rclient.exec = sinon.stub().yields(null, [2, this.jsonUpdates])
        return this.RealTimeRedisManager.getPendingProjectUpdates(
          this.project_id,
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

  describe('getProjectUpdatesLength', function () {
    beforeEach(function () {
      this.rclient.llen = sinon.stub().yields(null, (this.length = 4))
      return this.RealTimeRedisManager.getProjectUpdatesLength(
        this.project_id,
        this.callback
      )
    })

    it('should look up the length of the per-project queue', function () {
      return this.rclient.llen
        .calledWith(`PendingProjectUpdates:${this.project_id}`)
        .should.equal(true)
    })

    return it('should return the length', function () {
      return this.callback.calledWith(null, this.length).should.equal(true)
    })
  })

  return describe('sendData', function () {
    beforeEach(function () {
      this.message_id = 'doc:somehost:01020304-0'
      this.data = {
        project_id: this.project_id,
        doc_id: this.doc_id,
        op: 'thisop',
      }
      this.blob = JSON.stringify({
        ...this.data,
        _id: this.message_id,
        message: 'otUpdateApplied',
      })
    })

    describe('on the base editor-events channel', function () {
      beforeEach(function () {
        this.RealTimeRedisManager.sendData(this.data)
      })

      it('should send the op with a message id and message name', function () {
        return this.pubsubClient.publish
          .calledWith('editor-events', this.blob)
          .should.equal(true)
      })

      it('should track the payload size', function () {
        return this.metrics.summary
          .calledWith('redis.publish.applied-ops', this.blob.length, {
            path: 'editor-events',
          })
          .should.equal(true)
      })
    })

    describe('on the per-project editor-events channel', function () {
      beforeEach(function () {
        this.Settings.publishOnIndividualChannels = true
        this.RealTimeRedisManager.sendData(this.data)
      })

      it('should send the op on the per-project channel', function () {
        return this.pubsubClient.publish
          .calledWith(`editor-events:${this.project_id}`, this.blob)
          .should.equal(true)
      })
    })

    describe('with an error', function () {
      beforeEach(function () {
        this.data = {
          project_id: this.project_id,
          doc_id: this.doc_id,
          error: 'something went wrong',
        }
        this.blob = JSON.stringify({
          ...this.data,
          _id: this.message_id,
          message: 'otUpdateError',
        })
        this.RealTimeRedisManager.sendData(this.data)
      })

      it('should send the error with the otUpdateError message name', function () {
        return this.pubsubClient.publish
          .calledWith('editor-events', this.blob)
          .should.equal(true)
      })
    })
  })
})
