import { vi } from 'vitest'
import path from 'node:path'
import sinon from 'sinon'
const modulePath = path.join(
  import.meta.dirname,
  '../../../../app/src/Features/Editor/EditorRealTimeController'
)

describe('EditorRealTimeController', function () {
  beforeEach(async function (ctx) {
    ctx.rclient = { publish: sinon.stub() }
    ctx.Metrics = { summary: sinon.stub() }

    vi.doMock('../../../../app/src/infrastructure/RedisWrapper', () => ({
      default: {
        client: () => ctx.rclient,
      },
    }))

    vi.doMock('../../../../app/src/infrastructure/Server', () => ({
      default: {
        io: (ctx.io = {}),
      },
    }))

    vi.doMock('@overleaf/settings', () => ({
      default: { redis: {} },
    }))

    vi.doMock('@overleaf/metrics', () => ({
      default: ctx.Metrics,
    }))

    vi.doMock('node:crypto', () => ({
      default: (ctx.crypto = {
        randomBytes: sinon
          .stub()
          .withArgs(4)
          .returns(Buffer.from([0x1, 0x2, 0x3, 0x4])),
      }),
    }))

    vi.doMock('node:os', () => ({
      default: (ctx.os = { hostname: sinon.stub().returns('somehost') }),
    }))

    ctx.EditorRealTimeController = (await import(modulePath)).default

    ctx.room_id = 'room-id'
    ctx.message = 'message-to-editor'
    return (ctx.payload = ['argument one', 42])
  })

  describe('emitToRoom', function () {
    beforeEach(function (ctx) {
      ctx.message_id = 'web:somehost:01020304-0'
      return ctx.EditorRealTimeController.emitToRoom(
        ctx.room_id,
        ctx.message,
        ...Array.from(ctx.payload)
      )
    })

    it('should publish the message to redis', function (ctx) {
      return ctx.rclient.publish
        .calledWith(
          'editor-events',
          JSON.stringify({
            room_id: ctx.room_id,
            message: ctx.message,
            payload: ctx.payload,
            _id: ctx.message_id,
          })
        )
        .should.equal(true)
    })

    it('should track the payload size', function (ctx) {
      ctx.Metrics.summary
        .calledWith(
          'redis.publish.editor-events',
          JSON.stringify({
            room_id: ctx.room_id,
            message: ctx.message,
            payload: ctx.payload,
            _id: ctx.message_id,
          }).length
        )
        .should.equal(true)
    })
  })

  describe('emitToAll', function () {
    beforeEach(function (ctx) {
      ctx.EditorRealTimeController.emitToRoom = sinon.stub()
      return ctx.EditorRealTimeController.emitToAll(
        ctx.message,
        ...Array.from(ctx.payload)
      )
    })

    it("should emit to the room 'all'", function (ctx) {
      return ctx.EditorRealTimeController.emitToRoom
        .calledWith('all', ctx.message, ...Array.from(ctx.payload))
        .should.equal(true)
    })
  })
})
