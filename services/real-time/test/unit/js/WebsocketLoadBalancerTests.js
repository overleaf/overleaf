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
const expect = require('chai').expect
const modulePath = require('node:path').join(
  __dirname,
  '../../../app/js/WebsocketLoadBalancer'
)

describe('WebsocketLoadBalancer', function () {
  beforeEach(function () {
    this.rclient = {}
    this.RoomEvents = { on: sinon.stub() }
    this.WebsocketLoadBalancer = SandboxedModule.require(modulePath, {
      requires: {
        '@overleaf/settings': (this.Settings = { redis: {} }),
        './RedisClientManager': {
          createClientList: () => [],
        },
        './SafeJsonParse': (this.SafeJsonParse = {
          parse: (data, cb) => cb(null, JSON.parse(data)),
        }),
        './EventLogger': { checkEventOrder: sinon.stub() },
        './HealthCheckManager': { check: sinon.stub() },
        './RoomManager': (this.RoomManager = {
          eventSource: sinon.stub().returns(this.RoomEvents),
        }),
        './ChannelManager': (this.ChannelManager = { publish: sinon.stub() }),
        './ConnectedUsersManager': (this.ConnectedUsersManager = {
          refreshClient: sinon.stub(),
        }),
      },
    })
    this.io = {}
    this.WebsocketLoadBalancer.rclientPubList = [{ publish: sinon.stub() }]
    this.WebsocketLoadBalancer.rclientSubList = [
      {
        subscribe: sinon.stub(),
        on: sinon.stub(),
      },
    ]

    this.room_id = 'room-id'
    this.message = 'otUpdateApplied'
    return (this.payload = ['argument one', 42])
  })

  describe('shouldDisconnectClient', function () {
    it('should return false for general messages', function () {
      const client = {
        ol_context: { user_id: 'abcd' },
      }
      const message = {
        message: 'someNiceMessage',
        payload: [{ data: 'whatever' }],
      }
      expect(
        this.WebsocketLoadBalancer.shouldDisconnectClient(client, message)
      ).to.equal(false)
    })

    describe('collaborator access level changed', function () {
      const messageName = 'project:collaboratorAccessLevel:changed'
      const client = {
        ol_context: { user_id: 'abcd' },
      }
      it('should return true if the user id matches', function () {
        const message = {
          message: messageName,
          payload: [
            {
              userId: 'abcd',
            },
          ],
        }
        expect(
          this.WebsocketLoadBalancer.shouldDisconnectClient(client, message)
        ).to.equal(true)
      })
      it('should return false if the user id does not match', function () {
        const message = {
          message: messageName,
          payload: [
            {
              userId: 'xyz',
            },
          ],
        }
        expect(
          this.WebsocketLoadBalancer.shouldDisconnectClient(client, message)
        ).to.equal(false)
      })
    })

    describe('user removed from project', function () {
      const messageName = 'userRemovedFromProject'
      const client = {
        ol_context: { user_id: 'abcd' },
      }
      it('should return false, when the user_id does not match', function () {
        const message = {
          message: messageName,
          payload: ['xyz'],
        }
        expect(
          this.WebsocketLoadBalancer.shouldDisconnectClient(client, message)
        ).to.equal(false)
      })

      it('should return true, if the user_id matches', function () {
        const message = {
          message: messageName,
          payload: [`${client.ol_context.user_id}`],
        }
        expect(
          this.WebsocketLoadBalancer.shouldDisconnectClient(client, message)
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

          it('should return false', function () {
            expect(
              this.WebsocketLoadBalancer.shouldDisconnectClient(client, message)
            ).to.equal(false)
          })
        })

        describe('when the user not an invited member', function () {
          const client = {
            ol_context: {
              is_invited_member: false,
            },
          }

          it('should return true', function () {
            expect(
              this.WebsocketLoadBalancer.shouldDisconnectClient(client, message)
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

          it('should return false', function () {
            expect(
              this.WebsocketLoadBalancer.shouldDisconnectClient(client, message)
            ).to.equal(false)
          })
        })

        describe('when the user not an invited member', function () {
          const client = {
            ol_context: {
              is_invited_member: false,
            },
          }

          it('should return false', function () {
            expect(
              this.WebsocketLoadBalancer.shouldDisconnectClient(client, message)
            ).to.equal(false)
          })
        })
      })
    })
  })

  describe('emitToRoom', function () {
    beforeEach(function () {
      return this.WebsocketLoadBalancer.emitToRoom(
        this.room_id,
        this.message,
        ...Array.from(this.payload)
      )
    })

    return it('should publish the message to redis', function () {
      return this.ChannelManager.publish
        .calledWith(
          this.WebsocketLoadBalancer.rclientPubList[0],
          'editor-events',
          this.room_id,
          JSON.stringify({
            room_id: this.room_id,
            message: this.message,
            payload: this.payload,
          })
        )
        .should.equal(true)
    })
  })

  describe('emitToAll', function () {
    beforeEach(function () {
      this.WebsocketLoadBalancer.emitToRoom = sinon.stub()
      return this.WebsocketLoadBalancer.emitToAll(
        this.message,
        ...Array.from(this.payload)
      )
    })

    return it("should emit to the room 'all'", function () {
      return this.WebsocketLoadBalancer.emitToRoom
        .calledWith('all', this.message, ...Array.from(this.payload))
        .should.equal(true)
    })
  })

  describe('listenForEditorEvents', function () {
    beforeEach(function () {
      this.WebsocketLoadBalancer._processEditorEvent = sinon.stub()
      return this.WebsocketLoadBalancer.listenForEditorEvents()
    })

    it('should subscribe to the editor-events channel', function () {
      return this.WebsocketLoadBalancer.rclientSubList[0].subscribe
        .calledWith('editor-events')
        .should.equal(true)
    })

    return it('should process the events with _processEditorEvent', function () {
      return this.WebsocketLoadBalancer.rclientSubList[0].on
        .calledWith('message', sinon.match.func)
        .should.equal(true)
    })
  })

  return describe('_processEditorEvent', function () {
    describe('with bad JSON', function () {
      beforeEach(function () {
        this.isRestrictedUser = false
        this.SafeJsonParse.parse = sinon
          .stub()
          .callsArgWith(1, new Error('oops'))
        return this.WebsocketLoadBalancer._processEditorEvent(
          this.io,
          'editor-events',
          'blah'
        )
      })

      return it('should log an error', function () {
        return this.logger.error.called.should.equal(true)
      })
    })

    describe('with a designated room', function () {
      beforeEach(function () {
        this.io.sockets = {
          clients: sinon.stub().returns([
            {
              id: 'client-id-1',
              emit: (this.emit1 = sinon.stub()),
              ol_context: {},
            },
            {
              id: 'client-id-2',
              emit: (this.emit2 = sinon.stub()),
              ol_context: {},
            },
            {
              id: 'client-id-1',
              emit: (this.emit3 = sinon.stub()),
              ol_context: {},
            }, // duplicate client
          ]),
        }
        const data = JSON.stringify({
          room_id: this.room_id,
          message: this.message,
          payload: this.payload,
        })
        return this.WebsocketLoadBalancer._processEditorEvent(
          this.io,
          'editor-events',
          data
        )
      })

      return it('should send the message to all (unique) clients in the room', function () {
        this.io.sockets.clients.calledWith(this.room_id).should.equal(true)
        this.emit1
          .calledWith(this.message, ...Array.from(this.payload))
          .should.equal(true)
        this.emit2
          .calledWith(this.message, ...Array.from(this.payload))
          .should.equal(true)
        return this.emit3.called.should.equal(false)
      })
    }) // duplicate client should be ignored

    describe('with a designated room, and restricted clients, not restricted message', function () {
      beforeEach(function () {
        this.io.sockets = {
          clients: sinon.stub().returns([
            {
              id: 'client-id-1',
              emit: (this.emit1 = sinon.stub()),
              ol_context: {},
            },
            {
              id: 'client-id-2',
              emit: (this.emit2 = sinon.stub()),
              ol_context: {},
            },
            {
              id: 'client-id-1',
              emit: (this.emit3 = sinon.stub()),
              ol_context: {},
            }, // duplicate client
            {
              id: 'client-id-4',
              emit: (this.emit4 = sinon.stub()),
              ol_context: { is_restricted_user: true },
            },
          ]),
        }
        const data = JSON.stringify({
          room_id: this.room_id,
          message: this.message,
          payload: this.payload,
        })
        return this.WebsocketLoadBalancer._processEditorEvent(
          this.io,
          'editor-events',
          data
        )
      })

      return it('should send the message to all (unique) clients in the room', function () {
        this.io.sockets.clients.calledWith(this.room_id).should.equal(true)
        this.emit1
          .calledWith(this.message, ...Array.from(this.payload))
          .should.equal(true)
        this.emit2
          .calledWith(this.message, ...Array.from(this.payload))
          .should.equal(true)
        this.emit3.called.should.equal(false) // duplicate client should be ignored
        return this.emit4.called.should.equal(true)
      })
    }) // restricted client, but should be called

    describe('with a designated room, and restricted clients, restricted message', function () {
      beforeEach(function () {
        this.io.sockets = {
          clients: sinon.stub().returns([
            {
              id: 'client-id-1',
              emit: (this.emit1 = sinon.stub()),
              ol_context: {},
            },
            {
              id: 'client-id-2',
              emit: (this.emit2 = sinon.stub()),
              ol_context: {},
            },
            {
              id: 'client-id-1',
              emit: (this.emit3 = sinon.stub()),
              ol_context: {},
            }, // duplicate client
            {
              id: 'client-id-4',
              emit: (this.emit4 = sinon.stub()),
              ol_context: { is_restricted_user: true },
            },
          ]),
        }
        const data = JSON.stringify({
          room_id: this.room_id,
          message: (this.restrictedMessage = 'new-comment'),
          payload: this.payload,
        })
        return this.WebsocketLoadBalancer._processEditorEvent(
          this.io,
          'editor-events',
          data
        )
      })

      return it('should send the message to all (unique) clients in the room, who are not restricted', function () {
        this.io.sockets.clients.calledWith(this.room_id).should.equal(true)
        this.emit1
          .calledWith(this.restrictedMessage, ...Array.from(this.payload))
          .should.equal(true)
        this.emit2
          .calledWith(this.restrictedMessage, ...Array.from(this.payload))
          .should.equal(true)
        this.emit3.called.should.equal(false) // duplicate client should be ignored
        return this.emit4.called.should.equal(false)
      })
    }) // restricted client, should not be called

    describe('when emitting to all', function () {
      beforeEach(function () {
        this.io.sockets = { emit: (this.emit = sinon.stub()) }
        const data = JSON.stringify({
          room_id: 'all',
          message: this.message,
          payload: this.payload,
        })
        return this.WebsocketLoadBalancer._processEditorEvent(
          this.io,
          'editor-events',
          data
        )
      })

      return it('should send the message to all clients', function () {
        return this.emit
          .calledWith(this.message, ...Array.from(this.payload))
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
      beforeEach(function () {
        this.io.sockets = {
          clients: sinon.stub().returns(clients),
        }
        const data = JSON.stringify({
          room_id: this.room_id,
          message,
          payload,
        })
        return this.WebsocketLoadBalancer._processEditorEvent(
          this.io,
          'editor-events',
          data
        )
      })

      it('should disconnect the matching client, while sending message to other clients', function () {
        this.io.sockets.clients.calledWith(this.room_id).should.equal(true)

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
