/* eslint-disable
    max-len,
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
  '../../../../app/src/Features/Editor/EditorRealTimeController'
)

describe('EditorRealTimeController', function() {
  beforeEach(function() {
    this.rclient = { publish: sinon.stub() }
    this.EditorRealTimeController = SandboxedModule.require(modulePath, {
      globals: {
        console: console
      },
      requires: {
        '../../infrastructure/RedisWrapper': {
          client: () => this.rclient
        },
        '../../infrastructure/Server': {
          io: (this.io = {})
        },
        'settings-sharelatex': { redis: {} },
        crypto: (this.crypto = {
          randomBytes: sinon
            .stub()
            .withArgs(4)
            .returns(Buffer.from([0x1, 0x2, 0x3, 0x4]))
        }),
        os: (this.os = { hostname: sinon.stub().returns('somehost') })
      }
    })

    this.room_id = 'room-id'
    this.message = 'message-to-editor'
    return (this.payload = ['argument one', 42])
  })

  describe('emitToRoom', function() {
    beforeEach(function() {
      this.message_id = 'web:somehost:01020304-0'
      return this.EditorRealTimeController.emitToRoom(
        this.room_id,
        this.message,
        ...Array.from(this.payload)
      )
    })

    it('should publish the message to redis', function() {
      return this.rclient.publish
        .calledWith(
          'editor-events',
          JSON.stringify({
            room_id: this.room_id,
            message: this.message,
            payload: this.payload,
            _id: this.message_id
          })
        )
        .should.equal(true)
    })
  })

  describe('emitToAll', function() {
    beforeEach(function() {
      this.EditorRealTimeController.emitToRoom = sinon.stub()
      return this.EditorRealTimeController.emitToAll(
        this.message,
        ...Array.from(this.payload)
      )
    })

    it("should emit to the room 'all'", function() {
      return this.EditorRealTimeController.emitToRoom
        .calledWith('all', this.message, ...Array.from(this.payload))
        .should.equal(true)
    })
  })
})
