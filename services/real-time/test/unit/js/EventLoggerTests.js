/* eslint-disable
    no-return-assign,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const { expect } = require('chai')
const SandboxedModule = require('sandboxed-module')
const modulePath = '../../../app/js/EventLogger'
const sinon = require('sinon')
const tk = require('timekeeper')

describe('EventLogger', function () {
  beforeEach(function () {
    this.start = Date.now()
    tk.freeze(new Date(this.start))
    this.EventLogger = SandboxedModule.require(modulePath, {
      requires: {
        '@overleaf/metrics': (this.metrics = { inc: sinon.stub() }),
      },
    })
    this.channel = 'applied-ops'
    this.id_1 = 'random-hostname:abc-1'
    this.message_1 = 'message-1'
    this.id_2 = 'random-hostname:abc-2'
    return (this.message_2 = 'message-2')
  })

  afterEach(function () {
    return tk.reset()
  })

  return describe('checkEventOrder', function () {
    describe('when the events are in order', function () {
      beforeEach(function () {
        this.EventLogger.checkEventOrder(
          this.channel,
          this.id_1,
          this.message_1
        )
        return (this.status = this.EventLogger.checkEventOrder(
          this.channel,
          this.id_2,
          this.message_2
        ))
      })

      it('should accept events in order', function () {
        return expect(this.status).to.be.undefined
      })

      return it('should increment the valid event metric', function () {
        return this.metrics.inc
          .calledWith(`event.${this.channel}.valid`)
          .should.equals(true)
      })
    })

    describe('when there is a duplicate events', function () {
      beforeEach(function () {
        this.EventLogger.checkEventOrder(
          this.channel,
          this.id_1,
          this.message_1
        )
        return (this.status = this.EventLogger.checkEventOrder(
          this.channel,
          this.id_1,
          this.message_1
        ))
      })

      it('should return "duplicate" for the same event', function () {
        return expect(this.status).to.equal('duplicate')
      })

      return it('should increment the duplicate event metric', function () {
        return this.metrics.inc
          .calledWith(`event.${this.channel}.duplicate`)
          .should.equals(true)
      })
    })

    describe('when there are out of order events', function () {
      beforeEach(function () {
        this.EventLogger.checkEventOrder(
          this.channel,
          this.id_1,
          this.message_1
        )
        this.EventLogger.checkEventOrder(
          this.channel,
          this.id_2,
          this.message_2
        )
        return (this.status = this.EventLogger.checkEventOrder(
          this.channel,
          this.id_1,
          this.message_1
        ))
      })

      it('should return "out-of-order" for the event', function () {
        return expect(this.status).to.equal('out-of-order')
      })

      return it('should increment the out-of-order event metric', function () {
        return this.metrics.inc
          .calledWith(`event.${this.channel}.out-of-order`)
          .should.equals(true)
      })
    })

    return describe('after MAX_STALE_TIME_IN_MS', function () {
      return it('should flush old entries', function () {
        let status
        this.EventLogger.MAX_EVENTS_BEFORE_CLEAN = 10
        this.EventLogger.checkEventOrder(
          this.channel,
          this.id_1,
          this.message_1
        )
        for (let i = 1; i <= 8; i++) {
          status = this.EventLogger.checkEventOrder(
            this.channel,
            this.id_1,
            this.message_1
          )
          expect(status).to.equal('duplicate')
        }
        // the next event should flush the old entries aboce
        this.EventLogger.MAX_STALE_TIME_IN_MS = 1000
        tk.freeze(new Date(this.start + 5 * 1000))
        // because we flushed the entries this should not be a duplicate
        this.EventLogger.checkEventOrder(
          this.channel,
          'other-1',
          this.message_2
        )
        status = this.EventLogger.checkEventOrder(
          this.channel,
          this.id_1,
          this.message_1
        )
        return expect(status).to.be.undefined
      })
    })
  })
})
