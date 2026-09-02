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

    vi.doMock('@overleaf/settings', () => ({
      default: (ctx.settings = {
        redis: {
          documentupdater: {
            key_schema: {},
          },
          pubsub: null,
        },
      }),
    }))

    vi.doMock('../../../app/js/EventLogger', () => ({
      default: (ctx.EventLogger = { checkEventOrder: sinon.stub() }),
    }))

    vi.doMock('@overleaf/metrics', () => ({
      default: (ctx.metrics = {
        inc: sinon.stub(),
        histogram: sinon.stub(),
      }),
    }))

    ctx.EditorUpdatesController = (await import(modulePath)).default
  })

  describe('handleAppliedOpMessage', function () {
    describe('with an update forwarded from the editor-events channel', function () {
      beforeEach(function (ctx) {
        ctx.message = {
          project_id: ctx.project_id,
          doc_id: ctx.doc_id,
          op: { t: 'foo', p: 12 },
        }
        ctx.EditorUpdatesController._applyUpdateFromDocumentUpdater =
          sinon.stub()
        ctx.EditorUpdatesController.handleAppliedOpMessage(
          ctx.io,
          ctx.message,
          ctx.project_id
        )
      })

      it('should apply the update to the project room', function (ctx) {
        ctx.EditorUpdatesController._applyUpdateFromDocumentUpdater
          .calledWith(ctx.io, ctx.project_id, ctx.doc_id, ctx.message.op)
          .should.equal(true)
      })
    })

    describe('with a duplicate update', function () {
      beforeEach(function (ctx) {
        ctx.settings.checkEventOrder = true
        ctx.message = {
          project_id: ctx.project_id,
          doc_id: ctx.doc_id,
          op: { t: 'foo', p: 12 },
          _id: 'doc:host:rnd-1',
        }
        ctx.EventLogger.checkEventOrder.returns('duplicate')
        ctx.EditorUpdatesController._applyUpdateFromDocumentUpdater =
          sinon.stub()
        ctx.EditorUpdatesController.handleAppliedOpMessage(
          ctx.io,
          ctx.message,
          ctx.project_id
        )
      })

      it('should check the event order on the applied-ops channel', function (ctx) {
        ctx.EventLogger.checkEventOrder
          .calledWith('applied-ops', ctx.message._id, ctx.message)
          .should.equal(true)
      })

      it('should skip the update', function (ctx) {
        ctx.EditorUpdatesController._applyUpdateFromDocumentUpdater.called.should.equal(
          false
        )
      })
    })

    describe('with an error forwarded from the editor-events channel', function () {
      beforeEach(function (ctx) {
        ctx.message = {
          project_id: ctx.project_id,
          doc_id: ctx.doc_id,
          error: 'Something went wrong',
        }
        ctx.EditorUpdatesController._processErrorFromDocumentUpdater =
          sinon.stub()
        ctx.EditorUpdatesController.handleAppliedOpMessage(
          ctx.io,
          ctx.message,
          ctx.project_id
        )
      })

      it('should process the error in the project room', function (ctx) {
        ctx.EditorUpdatesController._processErrorFromDocumentUpdater
          .calledWith(ctx.io, ctx.project_id, ctx.doc_id, ctx.message.error)
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
          ctx.project_id,
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

      it('should get the clients connected to the project', function (ctx) {
        ctx.io.sockets.clients.calledWith(ctx.project_id).should.equal(true)
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
          ctx.project_id,
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
      for (const client of ctx.clients) {
        client.ol_context[`doc:${ctx.doc_id}`] = 'allowed'
      }
    })

    describe('in the project room', function () {
      beforeEach(function (ctx) {
        ctx.otherDocClient = new MockClient()
        ctx.otherDocClient.ol_context['doc:other-doc-id'] = 'allowed'
        ctx.io.sockets = {
          clients: sinon.stub().returns([...ctx.clients, ctx.otherDocClient]),
        }
        ctx.EditorUpdatesController._processErrorFromDocumentUpdater(
          ctx.io,
          ctx.project_id,
          ctx.doc_id,
          'Something went wrong'
        )
      })

      it('should disconnect the clients that joined the doc', function (ctx) {
        ctx.io.sockets.clients.calledWith(ctx.project_id).should.equal(true)
        Array.from(ctx.clients).map(client =>
          client.disconnect.called.should.equal(true)
        )
      })

      it('should not disconnect clients that did not join the doc', function (ctx) {
        ctx.otherDocClient.emit.called.should.equal(false)
        ctx.otherDocClient.disconnect.called.should.equal(false)
      })
    })
  })
})
