import { vi, expect, describe, beforeEach, it } from 'vitest'

import sinon from 'sinon'
import path from 'node:path'

const modulePath = path.join(
  import.meta.dirname,
  '../../../app/js/WebsocketLoadBalancer'
)

describe('WebsocketLoadBalancer', function () {
  beforeEach(async function (ctx) {
    ctx.rclient = {}
    ctx.RoomEvents = { on: sinon.stub() }

    vi.doMock('@overleaf/settings', () => ({
      default: (ctx.Settings = { redis: {} }),
    }))

    vi.doMock('./RedisClientManager', () => ({
      default: {
        createClientList: () => [],
      },
    }))

    vi.doMock('../../../app/js/SafeJsonParse', () => ({
      default: (ctx.SafeJsonParse = {
        parse: (data, cb) => cb(null, JSON.parse(data)),
      }),
    }))

    vi.doMock('../../../app/js/EventLogger', () => ({
      default: { checkEventOrder: sinon.stub() },
    }))

    vi.doMock('../../../app/js/HealthCheckManager', () => ({
      default: { check: sinon.stub() },
    }))

    vi.doMock('../../../app/js/RoomManager', () => ({
      default: (ctx.RoomManager = {
        eventSource: sinon.stub().returns(ctx.RoomEvents),
      }),
    }))

    vi.doMock('../../../app/js/ChannelManager', () => ({
      default: (ctx.ChannelManager = { publish: sinon.stub() }),
    }))

    vi.doMock('../../../app/js/ConnectedUsersManager', () => ({
      default: (ctx.ConnectedUsersManager = {
        refreshClient: sinon.stub(),
      }),
    }))

    ctx.WebsocketLoadBalancer = (await import(modulePath)).default
    ctx.io = {}
    ctx.WebsocketLoadBalancer.rclientPubList = [{ publish: sinon.stub() }]
    ctx.WebsocketLoadBalancer.rclientSubList = [
      {
        subscribe: sinon.stub(),
        on: sinon.stub(),
      },
    ]

    ctx.room_id = 'room-id'
    ctx.message = 'otUpdateApplied'
    ctx.payload = ['argument one', 42]
  })

  describe('shouldDisconnectClient', function () {
    it('should return false for general messages', function (ctx) {
      const client = {
        ol_context: { user_id: 'abcd' },
      }
      const message = {
        message: 'someNiceMessage',
        payload: [{ data: 'whatever' }],
      }
      expect(
        ctx.WebsocketLoadBalancer.shouldDisconnectClient(client, message)
      ).to.equal(false)
    })

    describe('collaborator access level changed', function () {
      const messageName = 'project:collaboratorAccessLevel:changed'
      const client = {
        ol_context: { user_id: 'abcd' },
      }
      it('should return true if the user id matches', function (ctx) {
        const message = {
          message: messageName,
          payload: [
            {
              userId: 'abcd',
            },
          ],
        }
        expect(
          ctx.WebsocketLoadBalancer.shouldDisconnectClient(client, message)
        ).to.equal(true)
      })
      it('should return false if the user id does not match', function (ctx) {
        const message = {
          message: messageName,
          payload: [
            {
              userId: 'xyz',
            },
          ],
        }
        expect(
          ctx.WebsocketLoadBalancer.shouldDisconnectClient(client, message)
        ).to.equal(false)
      })
    })

    describe('user removed from project', function () {
      const messageName = 'userRemovedFromProject'
      const client = {
        ol_context: { user_id: 'abcd' },
      }
      it('should return false, when the user_id does not match', function (ctx) {
        const message = {
          message: messageName,
          payload: ['xyz'],
        }
        expect(
          ctx.WebsocketLoadBalancer.shouldDisconnectClient(client, message)
        ).to.equal(false)
      })

      it('should return true, if the user_id matches', function (ctx) {
        const message = {
          message: messageName,
          payload: [`${client.ol_context.user_id}`],
        }
        expect(
          ctx.WebsocketLoadBalancer.shouldDisconnectClient(client, message)
        ).to.equal(true)
      })
    })

    describe('link-sharing turned off', function () {
      const messageName = 'project:publicAccessLevel:changed'

      describe('when the new access level is set to "private"', function () {
        const message = {
          message: messageName,
          payload: [{ newAccessLevel: 'private' }],
        }
        describe('when the user is an invited member', function () {
          const client = {
            ol_context: {
              is_invited_member: true,
            },
          }

          it('should return false', function (ctx) {
            expect(
              ctx.WebsocketLoadBalancer.shouldDisconnectClient(client, message)
            ).to.equal(false)
          })
        })

        describe('when the user not an invited member', function () {
          const client = {
            ol_context: {
              is_invited_member: false,
            },
          }

          it('should return true', function (ctx) {
            expect(
              ctx.WebsocketLoadBalancer.shouldDisconnectClient(client, message)
            ).to.equal(true)
          })
        })
      })

      describe('when the new access level is "tokenBased"', function () {
        const message = {
          message: messageName,
          payload: [{ newAccessLevel: 'tokenBased' }],
        }

        describe('when the user is an invited member', function () {
          const client = {
            ol_context: {
              is_invited_member: true,
            },
          }

          it('should return false', function (ctx) {
            expect(
              ctx.WebsocketLoadBalancer.shouldDisconnectClient(client, message)
            ).to.equal(false)
          })
        })

        describe('when the user not an invited member', function () {
          const client = {
            ol_context: {
              is_invited_member: false,
            },
          }

          it('should return false', function (ctx) {
            expect(
              ctx.WebsocketLoadBalancer.shouldDisconnectClient(client, message)
            ).to.equal(false)
          })
        })
      })
    })
  })

  describe('emitToRoom', function () {
    beforeEach(function (ctx) {
      ctx.WebsocketLoadBalancer.emitToRoom(
        ctx.room_id,
        ctx.message,
        ...Array.from(ctx.payload)
      )
    })

    it('should publish the message to redis', function (ctx) {
      ctx.ChannelManager.publish
        .calledWith(
          ctx.WebsocketLoadBalancer.rclientPubList[0],
          'editor-events',
          ctx.room_id,
          JSON.stringify({
            room_id: ctx.room_id,
            message: ctx.message,
            payload: ctx.payload,
          })
        )
        .should.equal(true)
    })
  })

  describe('emitToAll', function () {
    beforeEach(function (ctx) {
      ctx.WebsocketLoadBalancer.emitToRoom = sinon.stub()
      ctx.WebsocketLoadBalancer.emitToAll(
        ctx.message,
        ...Array.from(ctx.payload)
      )
    })

    it("should emit to the room 'all'", function (ctx) {
      ctx.WebsocketLoadBalancer.emitToRoom
        .calledWith('all', ctx.message, ...Array.from(ctx.payload))
        .should.equal(true)
    })
  })

  describe('listenForEditorEvents', function () {
    beforeEach(function (ctx) {
      ctx.WebsocketLoadBalancer._processEditorEvent = sinon.stub()
      ctx.WebsocketLoadBalancer.listenForEditorEvents()
    })

    it('should subscribe to the editor-events channel', function (ctx) {
      ctx.WebsocketLoadBalancer.rclientSubList[0].subscribe
        .calledWith('editor-events')
        .should.equal(true)
    })

    it('should process the events with _processEditorEvent', function (ctx) {
      ctx.WebsocketLoadBalancer.rclientSubList[0].on
        .calledWith('message', sinon.match.func)
        .should.equal(true)
    })
  })

  describe('_processEditorEvent', function () {
    describe('with bad JSON', function () {
      beforeEach(function (ctx) {
        ctx.isRestrictedUser = false
        ctx.SafeJsonParse.parse = sinon
          .stub()
          .callsArgWith(1, new Error('oops'))
        ctx.WebsocketLoadBalancer._processEditorEvent(
          ctx.io,
          'editor-events',
          'blah'
        )
      })

      it('should log an error', function (ctx) {
        ctx.logger.error.called.should.equal(true)
      })
    })

    describe('with a designated room', function () {
      beforeEach(function (ctx) {
        ctx.io.sockets = {
          clients: sinon.stub().returns([
            {
              id: 'client-id-1',
              emit: (ctx.emit1 = sinon.stub()),
              ol_context: {},
            },
            {
              id: 'client-id-2',
              emit: (ctx.emit2 = sinon.stub()),
              ol_context: {},
            },
            {
              id: 'client-id-1',
              emit: (ctx.emit3 = sinon.stub()),
              ol_context: {},
            }, // duplicate client
          ]),
        }
        const data = JSON.stringify({
          room_id: ctx.room_id,
          message: ctx.message,
          payload: ctx.payload,
        })
        ctx.WebsocketLoadBalancer._processEditorEvent(
          ctx.io,
          'editor-events',
          data
        )
      })

      it('should send the message to all (unique) clients in the room', function (ctx) {
        ctx.io.sockets.clients.calledWith(ctx.room_id).should.equal(true)
        ctx.emit1
          .calledWith(ctx.message, ...Array.from(ctx.payload))
          .should.equal(true)
        ctx.emit2
          .calledWith(ctx.message, ...Array.from(ctx.payload))
          .should.equal(true)
        ctx.emit3.called.should.equal(false)
      })
    }) // duplicate client should be ignored

    describe('with a designated room, and restricted clients, not restricted message', function () {
      beforeEach(function (ctx) {
        ctx.io.sockets = {
          clients: sinon.stub().returns([
            {
              id: 'client-id-1',
              emit: (ctx.emit1 = sinon.stub()),
              ol_context: {},
            },
            {
              id: 'client-id-2',
              emit: (ctx.emit2 = sinon.stub()),
              ol_context: {},
            },
            {
              id: 'client-id-1',
              emit: (ctx.emit3 = sinon.stub()),
              ol_context: {},
            }, // duplicate client
            {
              id: 'client-id-4',
              emit: (ctx.emit4 = sinon.stub()),
              ol_context: { is_restricted_user: true },
            },
          ]),
        }
        const data = JSON.stringify({
          room_id: ctx.room_id,
          message: ctx.message,
          payload: ctx.payload,
        })
        ctx.WebsocketLoadBalancer._processEditorEvent(
          ctx.io,
          'editor-events',
          data
        )
      })

      it('should send the message to all (unique) clients in the room', function (ctx) {
        ctx.io.sockets.clients.calledWith(ctx.room_id).should.equal(true)
        ctx.emit1
          .calledWith(ctx.message, ...Array.from(ctx.payload))
          .should.equal(true)
        ctx.emit2
          .calledWith(ctx.message, ...Array.from(ctx.payload))
          .should.equal(true)
        ctx.emit3.called.should.equal(false) // duplicate client should be ignored
        ctx.emit4.called.should.equal(true)
      })
    }) // restricted client, but should be called

    describe('with a designated room, and restricted clients, restricted message', function () {
      beforeEach(function (ctx) {
        ctx.io.sockets = {
          clients: sinon.stub().returns([
            {
              id: 'client-id-1',
              emit: (ctx.emit1 = sinon.stub()),
              ol_context: {},
            },
            {
              id: 'client-id-2',
              emit: (ctx.emit2 = sinon.stub()),
              ol_context: {},
            },
            {
              id: 'client-id-1',
              emit: (ctx.emit3 = sinon.stub()),
              ol_context: {},
            }, // duplicate client
            {
              id: 'client-id-4',
              emit: (ctx.emit4 = sinon.stub()),
              ol_context: { is_restricted_user: true },
            },
          ]),
        }
        const data = JSON.stringify({
          room_id: ctx.room_id,
          message: (ctx.restrictedMessage = 'new-comment'),
          payload: ctx.payload,
        })
        ctx.WebsocketLoadBalancer._processEditorEvent(
          ctx.io,
          'editor-events',
          data
        )
      })

      it('should send the message to all (unique) clients in the room, who are not restricted', function (ctx) {
        ctx.io.sockets.clients.calledWith(ctx.room_id).should.equal(true)
        ctx.emit1
          .calledWith(ctx.restrictedMessage, ...Array.from(ctx.payload))
          .should.equal(true)
        ctx.emit2
          .calledWith(ctx.restrictedMessage, ...Array.from(ctx.payload))
          .should.equal(true)
        ctx.emit3.called.should.equal(false) // duplicate client should be ignored
        ctx.emit4.called.should.equal(false)
      })
    }) // restricted client, should not be called

    describe('when emitting to all', function () {
      beforeEach(function (ctx) {
        ctx.io.sockets = { emit: (ctx.emit = sinon.stub()) }
        const data = JSON.stringify({
          room_id: 'all',
          message: ctx.message,
          payload: ctx.payload,
        })
        ctx.WebsocketLoadBalancer._processEditorEvent(
          ctx.io,
          'editor-events',
          data
        )
      })

      it('should send the message to all clients', function (ctx) {
        ctx.emit
          .calledWith(ctx.message, ...Array.from(ctx.payload))
          .should.equal(true)
      })
    })

    describe('when it should disconnect one of the clients', function () {
      const targetUserId = 'bbb'
      const message = 'userRemovedFromProject'
      const payload = [`${targetUserId}`]
      const clients = [
        {
          id: 'client-id-1',
          emit: sinon.stub(),
          ol_context: { user_id: 'aaa' },
          disconnect: sinon.stub(),
        },
        {
          id: 'client-id-2',
          emit: sinon.stub(),
          ol_context: { user_id: `${targetUserId}` },
          disconnect: sinon.stub(),
        },
        {
          id: 'client-id-3',
          emit: sinon.stub(),
          ol_context: { user_id: 'ccc' },
          disconnect: sinon.stub(),
        },
      ]
      beforeEach(function (ctx) {
        ctx.io.sockets = {
          clients: sinon.stub().returns(clients),
        }
        const data = JSON.stringify({
          room_id: ctx.room_id,
          message,
          payload,
        })
        ctx.WebsocketLoadBalancer._processEditorEvent(
          ctx.io,
          'editor-events',
          data
        )
      })

      it('should disconnect the matching client, while sending message to other clients', function (ctx) {
        ctx.io.sockets.clients.calledWith(ctx.room_id).should.equal(true)

        const [client1, client2, client3] = clients

        // disconnecting one client
        client1.disconnect.called.should.equal(false)
        client2.disconnect.called.should.equal(true)
        client3.disconnect.called.should.equal(false)

        // emitting to remaining clients
        client1.emit
          .calledWith(message, ...Array.from(payload))
          .should.equal(true)
        client2.emit.calledWith('project:access:revoked').should.equal(true) // disconnected client should get informative message
        client3.emit
          .calledWith(message, ...Array.from(payload))
          .should.equal(true)
      })
    })
  })
})
