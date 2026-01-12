import { vi, expect, describe, beforeEach, afterEach, it } from 'vitest'

import sinon from 'sinon'
import tk from 'timekeeper'
const modulePath = '../../../app/js/EventLogger'

describe('EventLogger', function () {
  beforeEach(async function (ctx) {
    ctx.start = Date.now()
    tk.freeze(new Date(ctx.start))

    vi.doMock('@overleaf/metrics', () => ({
      default: (ctx.metrics = { inc: sinon.stub() }),
    }))

    ctx.EventLogger = (await import(modulePath)).default
    ctx.channel = 'applied-ops'
    ctx.id_1 = 'random-hostname:abc-1'
    ctx.message_1 = 'message-1'
    ctx.id_2 = 'random-hostname:abc-2'
    ctx.message_2 = 'message-2'
  })

  afterEach(function () {
    tk.reset()
  })

  describe('checkEventOrder', function () {
    describe('when the events are in order', function () {
      beforeEach(function (ctx) {
        ctx.EventLogger.checkEventOrder(ctx.channel, ctx.id_1, ctx.message_1)
        ctx.status = ctx.EventLogger.checkEventOrder(
          ctx.channel,
          ctx.id_2,
          ctx.message_2
        )
      })

      it('should accept events in order', function (ctx) {
        expect(ctx.status).to.be.undefined
      })

      it('should increment the valid event metric', function (ctx) {
        ctx.metrics.inc
          .calledWith(`event.${ctx.channel}.valid`)
          .should.equals(true)
      })
    })

    describe('when there is a duplicate events', function () {
      beforeEach(function (ctx) {
        ctx.EventLogger.checkEventOrder(ctx.channel, ctx.id_1, ctx.message_1)
        ctx.status = ctx.EventLogger.checkEventOrder(
          ctx.channel,
          ctx.id_1,
          ctx.message_1
        )
      })

      it('should return "duplicate" for the same event', function (ctx) {
        expect(ctx.status).to.equal('duplicate')
      })

      it('should increment the duplicate event metric', function (ctx) {
        ctx.metrics.inc
          .calledWith(`event.${ctx.channel}.duplicate`)
          .should.equals(true)
      })
    })

    describe('when there are out of order events', function () {
      beforeEach(function (ctx) {
        ctx.EventLogger.checkEventOrder(ctx.channel, ctx.id_1, ctx.message_1)
        ctx.EventLogger.checkEventOrder(ctx.channel, ctx.id_2, ctx.message_2)
        ctx.status = ctx.EventLogger.checkEventOrder(
          ctx.channel,
          ctx.id_1,
          ctx.message_1
        )
      })

      it('should return "out-of-order" for the event', function (ctx) {
        expect(ctx.status).to.equal('out-of-order')
      })

      it('should increment the out-of-order event metric', function (ctx) {
        ctx.metrics.inc
          .calledWith(`event.${ctx.channel}.out-of-order`)
          .should.equals(true)
      })
    })

    describe('after MAX_STALE_TIME_IN_MS', function () {
      it('should flush old entries', function (ctx) {
        let status
        ctx.EventLogger.MAX_EVENTS_BEFORE_CLEAN = 10
        ctx.EventLogger.checkEventOrder(ctx.channel, ctx.id_1, ctx.message_1)
        for (let i = 1; i <= 8; i++) {
          status = ctx.EventLogger.checkEventOrder(
            ctx.channel,
            ctx.id_1,
            ctx.message_1
          )
          expect(status).to.equal('duplicate')
        }
        // the next event should flush the old entries aboce
        ctx.EventLogger.MAX_STALE_TIME_IN_MS = 1000
        tk.freeze(new Date(ctx.start + 5 * 1000))
        // because we flushed the entries this should not be a duplicate
        ctx.EventLogger.checkEventOrder(ctx.channel, 'other-1', ctx.message_2)
        status = ctx.EventLogger.checkEventOrder(
          ctx.channel,
          ctx.id_1,
          ctx.message_1
        )
        expect(status).to.be.undefined
      })
    })
  })
})
