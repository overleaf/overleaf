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
const SandboxedModule = require('sandboxed-module')
const sinon = require('sinon')
const modulePath = require('node:path').join(
  __dirname,
  '../../../app/js/DocumentUpdaterController'
)
const MockClient = require('./helpers/MockClient')

describe('DocumentUpdaterController', function () {
  beforeEach(function () {
    this.project_id = 'project-id-123'
    this.doc_id = 'doc-id-123'
    this.callback = sinon.stub()
    this.io = { mock: 'socket.io' }
    this.rclient = []
    this.RoomEvents = { on: sinon.stub() }
    this.EditorUpdatesController = SandboxedModule.require(modulePath, {
      requires: {
        '@overleaf/settings': (this.settings = {
          redis: {
            documentupdater: {
              key_schema: {
                pendingUpdates({ doc_id: docId }) {
                  return `PendingUpdates:${docId}`
                },
              },
            },
            pubsub: null,
          },
        }),
        './RedisClientManager': {
          createClientList: () => {
            this.redis = {
              createClient: name => {
                let rclientStub
                this.rclient.push((rclientStub = { name }))
                return rclientStub
              },
            }
          },
        },
        './SafeJsonParse': (this.SafeJsonParse = {
          parse: (data, cb) => cb(null, JSON.parse(data)),
        }),
        './EventLogger': (this.EventLogger = { checkEventOrder: sinon.stub() }),
        './HealthCheckManager': { check: sinon.stub() },
        '@overleaf/metrics': (this.metrics = {
          inc: sinon.stub(),
          histogram: sinon.stub(),
        }),
        './RoomManager': (this.RoomManager = {
          eventSource: sinon.stub().returns(this.RoomEvents),
        }),
        './ChannelManager': (this.ChannelManager = {}),
      },
    })
  })

  describe('listenForUpdatesFromDocumentUpdater', function () {
    beforeEach(function () {
      this.rclient.length = 0 // clear any existing clients
      this.EditorUpdatesController.rclientList = [
        this.redis.createClient('first'),
        this.redis.createClient('second'),
      ]
      this.rclient[0].subscribe = sinon.stub()
      this.rclient[0].on = sinon.stub()
      this.rclient[1].subscribe = sinon.stub()
      this.rclient[1].on = sinon.stub()
      this.EditorUpdatesController.listenForUpdatesFromDocumentUpdater()
    })

    it('should subscribe to the doc-updater stream', function () {
      this.rclient[0].subscribe.calledWith('applied-ops').should.equal(true)
    })

    it('should register a callback to handle updates', function () {
      this.rclient[0].on.calledWith('message').should.equal(true)
    })

    it('should subscribe to any additional doc-updater stream', function () {
      this.rclient[1].subscribe.calledWith('applied-ops').should.equal(true)
      this.rclient[1].on.calledWith('message').should.equal(true)
    })
  })

  describe('_processMessageFromDocumentUpdater', function () {
    describe('with bad JSON', function () {
      beforeEach(function () {
        this.SafeJsonParse.parse = sinon
          .stub()
          .callsArgWith(1, new Error('oops'))
        return this.EditorUpdatesController._processMessageFromDocumentUpdater(
          this.io,
          'applied-ops',
          'blah'
        )
      })

      it('should log an error', function () {
        return this.logger.error.called.should.equal(true)
      })
    })

    describe('with update', function () {
      beforeEach(function () {
        this.message = {
          doc_id: this.doc_id,
          op: { t: 'foo', p: 12 },
        }
        this.EditorUpdatesController._applyUpdateFromDocumentUpdater =
          sinon.stub()
        return this.EditorUpdatesController._processMessageFromDocumentUpdater(
          this.io,
          'applied-ops',
          JSON.stringify(this.message)
        )
      })

      it('should apply the update', function () {
        return this.EditorUpdatesController._applyUpdateFromDocumentUpdater
          .calledWith(this.io, this.doc_id, this.message.op)
          .should.equal(true)
      })
    })

    describe('with error', function () {
      beforeEach(function () {
        this.message = {
          doc_id: this.doc_id,
          error: 'Something went wrong',
        }
        this.EditorUpdatesController._processErrorFromDocumentUpdater =
          sinon.stub()
        return this.EditorUpdatesController._processMessageFromDocumentUpdater(
          this.io,
          'applied-ops',
          JSON.stringify(this.message)
        )
      })

      return it('should process the error', function () {
        return this.EditorUpdatesController._processErrorFromDocumentUpdater
          .calledWith(this.io, this.doc_id, this.message.error)
          .should.equal(true)
      })
    })
  })

  describe('_applyUpdateFromDocumentUpdater', function () {
    beforeEach(function () {
      this.sourceClient = new MockClient()
      this.otherClients = [new MockClient(), new MockClient()]
      this.update = {
        op: [{ t: 'foo', p: 12 }],
        meta: { source: this.sourceClient.publicId },
        v: (this.version = 42),
        doc: this.doc_id,
      }
      return (this.io.sockets = {
        clients: sinon
          .stub()
          .returns([
            this.sourceClient,
            ...Array.from(this.otherClients),
            this.sourceClient,
          ]),
      })
    }) // include a duplicate client

    describe('normally', function () {
      beforeEach(function () {
        return this.EditorUpdatesController._applyUpdateFromDocumentUpdater(
          this.io,
          this.doc_id,
          this.update
        )
      })

      it('should send a version bump to the source client', function () {
        this.sourceClient.emit
          .calledWith('otUpdateApplied', { v: this.version, doc: this.doc_id })
          .should.equal(true)
        return this.sourceClient.emit.calledOnce.should.equal(true)
      })

      it('should get the clients connected to the document', function () {
        return this.io.sockets.clients
          .calledWith(this.doc_id)
          .should.equal(true)
      })

      return it('should send the full update to the other clients', function () {
        return Array.from(this.otherClients).map(client =>
          client.emit
            .calledWith('otUpdateApplied', this.update)
            .should.equal(true)
        )
      })
    })

    return describe('with a duplicate op', function () {
      beforeEach(function () {
        this.update.dup = true
        return this.EditorUpdatesController._applyUpdateFromDocumentUpdater(
          this.io,
          this.doc_id,
          this.update
        )
      })

      it('should send a version bump to the source client as usual', function () {
        return this.sourceClient.emit
          .calledWith('otUpdateApplied', { v: this.version, doc: this.doc_id })
          .should.equal(true)
      })

      return it("should not send anything to the other clients (they've already had the op)", function () {
        return Array.from(this.otherClients).map(client =>
          client.emit.calledWith('otUpdateApplied').should.equal(false)
        )
      })
    })
  })

  return describe('_processErrorFromDocumentUpdater', function () {
    beforeEach(function () {
      this.clients = [new MockClient(), new MockClient()]
      this.io.sockets = { clients: sinon.stub().returns(this.clients) }
      return this.EditorUpdatesController._processErrorFromDocumentUpdater(
        this.io,
        this.doc_id,
        'Something went wrong'
      )
    })

    it('should log a warning', function () {
      return this.logger.warn.called.should.equal(true)
    })

    return it('should disconnect all clients in that document', function () {
      this.io.sockets.clients.calledWith(this.doc_id).should.equal(true)
      return Array.from(this.clients).map(client =>
        client.disconnect.called.should.equal(true)
      )
    })
  })
})
