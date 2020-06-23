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
require('chai').should()
const modulePath = require('path').join(
  __dirname,
  '../../../app/js/WebsocketLoadBalancer'
)

describe('WebsocketLoadBalancer', function () {
  beforeEach(function () {
    this.rclient = {}
    this.RoomEvents = { on: sinon.stub() }
    this.WebsocketLoadBalancer = SandboxedModule.require(modulePath, {
      requires: {
        './RedisClientManager': {
          createClientList: () => []
        },
        'logger-sharelatex': (this.logger = {
          log: sinon.stub(),
          error: sinon.stub()
        }),
        './SafeJsonParse': (this.SafeJsonParse = {
          parse: (data, cb) => cb(null, JSON.parse(data))
        }),
        './EventLogger': { checkEventOrder: sinon.stub() },
        './HealthCheckManager': { check: sinon.stub() },
        './RoomManager': (this.RoomManager = {
          eventSource: sinon.stub().returns(this.RoomEvents)
        }),
        './ChannelManager': (this.ChannelManager = { publish: sinon.stub() }),
        './ConnectedUsersManager': (this.ConnectedUsersManager = {
          refreshClient: sinon.stub()
        })
      }
    })
    this.io = {}
    this.WebsocketLoadBalancer.rclientPubList = [{ publish: sinon.stub() }]
    this.WebsocketLoadBalancer.rclientSubList = [
      {
        subscribe: sinon.stub(),
        on: sinon.stub()
      }
    ]

    this.room_id = 'room-id'
    this.message = 'otUpdateApplied'
    return (this.payload = ['argument one', 42])
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
            payload: this.payload
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
              ol_context: {}
            },
            {
              id: 'client-id-2',
              emit: (this.emit2 = sinon.stub()),
              ol_context: {}
            },
            {
              id: 'client-id-1',
              emit: (this.emit3 = sinon.stub()),
              ol_context: {}
            } // duplicate client
          ])
        }
        const data = JSON.stringify({
          room_id: this.room_id,
          message: this.message,
          payload: this.payload
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
              ol_context: {}
            },
            {
              id: 'client-id-2',
              emit: (this.emit2 = sinon.stub()),
              ol_context: {}
            },
            {
              id: 'client-id-1',
              emit: (this.emit3 = sinon.stub()),
              ol_context: {}
            }, // duplicate client
            {
              id: 'client-id-4',
              emit: (this.emit4 = sinon.stub()),
              ol_context: { is_restricted_user: true }
            }
          ])
        }
        const data = JSON.stringify({
          room_id: this.room_id,
          message: this.message,
          payload: this.payload
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
              ol_context: {}
            },
            {
              id: 'client-id-2',
              emit: (this.emit2 = sinon.stub()),
              ol_context: {}
            },
            {
              id: 'client-id-1',
              emit: (this.emit3 = sinon.stub()),
              ol_context: {}
            }, // duplicate client
            {
              id: 'client-id-4',
              emit: (this.emit4 = sinon.stub()),
              ol_context: { is_restricted_user: true }
            }
          ])
        }
        const data = JSON.stringify({
          room_id: this.room_id,
          message: (this.restrictedMessage = 'new-comment'),
          payload: this.payload
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

    return describe('when emitting to all', function () {
      beforeEach(function () {
        this.io.sockets = { emit: (this.emit = sinon.stub()) }
        const data = JSON.stringify({
          room_id: 'all',
          message: this.message,
          payload: this.payload
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
  })
})
