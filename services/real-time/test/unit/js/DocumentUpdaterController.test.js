import { vi, describe, beforeEach, it } from 'vitest'

import sinon from 'sinon'
import MockClient from './helpers/MockClient.js'
import path from 'node:path'

const modulePath = path.join(
  import.meta.dirname,
  '../../../app/js/DocumentUpdaterController'
)

describe('DocumentUpdaterController', function () {
  beforeEach(async function (ctx) {
    ctx.project_id = 'project-id-123'
    ctx.doc_id = 'doc-id-123'
    ctx.callback = sinon.stub()
    ctx.io = { mock: 'socket.io' }
    ctx.rclient = []
    ctx.RoomEvents = { on: sinon.stub() }

    vi.doMock('@overleaf/settings', () => ({
      default: (ctx.settings = {
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
    }))

    vi.doMock('../../../app/js/RedisClientManager', () => ({
      default: {
        createClientList: () => {
          ctx.redis = {
            createClient: name => {
              let rclientStub
              ctx.rclient.push((rclientStub = { name }))
              return rclientStub
            },
          }
        },
      },
    }))

    vi.doMock('../../../app/js/SafeJsonParse', () => ({
      default: (ctx.SafeJsonParse = {
        parse: (data, cb) => cb(null, JSON.parse(data)),
      }),
    }))

    vi.doMock('../../../app/js/EventLogger', () => ({
      default: (ctx.EventLogger = { checkEventOrder: sinon.stub() }),
    }))

    vi.doMock('../../../app/js/HealthCheckManager', () => ({
      default: { check: sinon.stub() },
    }))

    vi.doMock('@overleaf/metrics', () => ({
      default: (ctx.metrics = {
        inc: sinon.stub(),
        histogram: sinon.stub(),
      }),
    }))

    vi.doMock('../../../app/js/RoomManager', () => ({
      default: (ctx.RoomManager = {
        eventSource: sinon.stub().returns(ctx.RoomEvents),
      }),
    }))

    vi.doMock('../../../app/js/ChannelManager', () => ({
      default: (ctx.ChannelManager = {}),
    }))

    ctx.EditorUpdatesController = (await import(modulePath)).default
  })

  describe('listenForUpdatesFromDocumentUpdater', function () {
    beforeEach(function (ctx) {
      ctx.rclient.length = 0 // clear any existing clients
      ctx.EditorUpdatesController.rclientList = [
        ctx.redis.createClient('first'),
        ctx.redis.createClient('second'),
      ]
      ctx.rclient[0].subscribe = sinon.stub()
      ctx.rclient[0].on = sinon.stub()
      ctx.rclient[1].subscribe = sinon.stub()
      ctx.rclient[1].on = sinon.stub()
      ctx.EditorUpdatesController.listenForUpdatesFromDocumentUpdater()
    })

    it('should subscribe to the doc-updater stream', function (ctx) {
      ctx.rclient[0].subscribe.calledWith('applied-ops').should.equal(true)
    })

    it('should register a callback to handle updates', function (ctx) {
      ctx.rclient[0].on.calledWith('message').should.equal(true)
    })

    it('should subscribe to any additional doc-updater stream', function (ctx) {
      ctx.rclient[1].subscribe.calledWith('applied-ops').should.equal(true)
      ctx.rclient[1].on.calledWith('message').should.equal(true)
    })
  })

  describe('_processMessageFromDocumentUpdater', function () {
    describe('with bad JSON', function () {
      beforeEach(function (ctx) {
        ctx.SafeJsonParse.parse = sinon
          .stub()
          .callsArgWith(1, new Error('oops'))
        ctx.EditorUpdatesController._processMessageFromDocumentUpdater(
          ctx.io,
          'applied-ops',
          'blah'
        )
      })

      it('should log an error', function (ctx) {
        ctx.logger.error.called.should.equal(true)
      })
    })

    describe('with update', function () {
      beforeEach(function (ctx) {
        ctx.message = {
          doc_id: ctx.doc_id,
          op: { t: 'foo', p: 12 },
        }
        ctx.EditorUpdatesController._applyUpdateFromDocumentUpdater =
          sinon.stub()
        ctx.EditorUpdatesController._processMessageFromDocumentUpdater(
          ctx.io,
          'applied-ops',
          JSON.stringify(ctx.message)
        )
      })

      it('should apply the update', function (ctx) {
        ctx.EditorUpdatesController._applyUpdateFromDocumentUpdater
          .calledWith(ctx.io, ctx.doc_id, ctx.message.op)
          .should.equal(true)
      })
    })

    describe('with error', function () {
      beforeEach(function (ctx) {
        ctx.message = {
          doc_id: ctx.doc_id,
          error: 'Something went wrong',
        }
        ctx.EditorUpdatesController._processErrorFromDocumentUpdater =
          sinon.stub()
        ctx.EditorUpdatesController._processMessageFromDocumentUpdater(
          ctx.io,
          'applied-ops',
          JSON.stringify(ctx.message)
        )
      })

      it('should process the error', function (ctx) {
        ctx.EditorUpdatesController._processErrorFromDocumentUpdater
          .calledWith(ctx.io, ctx.doc_id, ctx.message.error)
          .should.equal(true)
      })
    })
  })

  describe('_applyUpdateFromDocumentUpdater', function () {
    beforeEach(function (ctx) {
      ctx.sourceClient = new MockClient()
      ctx.otherClients = [new MockClient(), new MockClient()]
      ctx.update = {
        op: [{ t: 'foo', p: 12 }],
        meta: { source: ctx.sourceClient.publicId },
        v: (ctx.version = 42),
        doc: ctx.doc_id,
      }
      ctx.io.sockets = {
        clients: sinon
          .stub()
          .returns([
            ctx.sourceClient,
            ...Array.from(ctx.otherClients),
            ctx.sourceClient,
          ]),
      }
    }) // include a duplicate client

    describe('normally', function () {
      beforeEach(function (ctx) {
        ctx.EditorUpdatesController._applyUpdateFromDocumentUpdater(
          ctx.io,
          ctx.doc_id,
          ctx.update
        )
      })

      it('should send a version bump to the source client', function (ctx) {
        ctx.sourceClient.emit
          .calledWith('otUpdateApplied', { v: ctx.version, doc: ctx.doc_id })
          .should.equal(true)
        ctx.sourceClient.emit.calledOnce.should.equal(true)
      })

      it('should get the clients connected to the document', function (ctx) {
        ctx.io.sockets.clients.calledWith(ctx.doc_id).should.equal(true)
      })

      it('should send the full update to the other clients', function (ctx) {
        Array.from(ctx.otherClients).map(client =>
          client.emit
            .calledWith('otUpdateApplied', ctx.update)
            .should.equal(true)
        )
      })
    })

    describe('with a duplicate op', function () {
      beforeEach(function (ctx) {
        ctx.update.dup = true
        ctx.EditorUpdatesController._applyUpdateFromDocumentUpdater(
          ctx.io,
          ctx.doc_id,
          ctx.update
        )
      })

      it('should send a version bump to the source client as usual', function (ctx) {
        ctx.sourceClient.emit
          .calledWith('otUpdateApplied', { v: ctx.version, doc: ctx.doc_id })
          .should.equal(true)
      })

      it("should not send anything to the other clients (they've already had the op)", function (ctx) {
        Array.from(ctx.otherClients).map(client =>
          client.emit.calledWith('otUpdateApplied').should.equal(false)
        )
      })
    })
  })

  describe('_processErrorFromDocumentUpdater', function () {
    beforeEach(function (ctx) {
      ctx.clients = [new MockClient(), new MockClient()]
      ctx.io.sockets = { clients: sinon.stub().returns(ctx.clients) }
      ctx.EditorUpdatesController._processErrorFromDocumentUpdater(
        ctx.io,
        ctx.doc_id,
        'Something went wrong'
      )
    })

    it('should log a warning', function (ctx) {
      ctx.logger.warn.called.should.equal(true)
    })

    it('should disconnect all clients in that document', function (ctx) {
      ctx.io.sockets.clients.calledWith(ctx.doc_id).should.equal(true)
      Array.from(ctx.clients).map(client =>
        client.disconnect.called.should.equal(true)
      )
    })
  })
})
