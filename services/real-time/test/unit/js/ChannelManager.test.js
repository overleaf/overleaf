import { vi, expect, describe, beforeEach, it } from 'vitest'

import sinon from 'sinon'

const modulePath = '../../../app/js/ChannelManager.js'

describe('ChannelManager', function () {
  beforeEach(async function (ctx) {
    ctx.rclient = {}
    ctx.other_rclient = {}

    vi.doMock('@overleaf/settings', () => ({
      default: (ctx.settings = {}),
    }))

    vi.doMock('@overleaf/metrics', () => ({
      default: (ctx.metrics = {
        inc: sinon.stub(),
        summary: sinon.stub(),
      }),
    }))

    ctx.ChannelManager = (await import(modulePath)).default
  })

  describe('subscribe', function () {
    describe('when there is no existing subscription for this redis client', function () {
      beforeEach(async function (ctx) {
        await new Promise(resolve => {
          ctx.rclient.subscribe = sinon.stub().resolves()
          ctx.ChannelManager.subscribe(
            ctx.rclient,
            'applied-ops',
            '1234567890abcdef'
          )
          setTimeout(resolve)
        })
      })

      it('should subscribe to the redis channel', function (ctx) {
        ctx.rclient.subscribe
          .calledWithExactly('applied-ops:1234567890abcdef')
          .should.equal(true)
      })
    })

    describe('when there is an existing subscription for this redis client', function () {
      beforeEach(async function (ctx) {
        await new Promise(resolve => {
          ctx.rclient.subscribe = sinon.stub().resolves()
          ctx.ChannelManager.subscribe(
            ctx.rclient,
            'applied-ops',
            '1234567890abcdef'
          )
          ctx.ChannelManager.subscribe(
            ctx.rclient,
            'applied-ops',
            '1234567890abcdef'
          )
          setTimeout(resolve)
        })
      })

      it('should subscribe to the redis channel again', function (ctx) {
        ctx.rclient.subscribe.callCount.should.equal(2)
      })
    })

    describe('when subscribe errors', function () {
      beforeEach(async function (ctx) {
        await new Promise((resolve, reject) => {
          ctx.rclient.subscribe = sinon
            .stub()
            .onFirstCall()
            .rejects(new Error('some redis error'))
            .onSecondCall()
            .resolves()
          const p = ctx.ChannelManager.subscribe(
            ctx.rclient,
            'applied-ops',
            '1234567890abcdef'
          )
          p.then(() =>
            reject(new Error('should not subscribe but fail'))
          ).catch(err => {
            err.message.should.equal('failed to subscribe to channel')
            err.cause.message.should.equal('some redis error')
            ctx.ChannelManager.getClientMapEntry(ctx.rclient)
              .has('applied-ops:1234567890abcdef')
              .should.equal(false)
            ctx.ChannelManager.subscribe(
              ctx.rclient,
              'applied-ops',
              '1234567890abcdef'
            )
            // subscribe is wrapped in Promise, delay other assertions
            setTimeout(resolve)
          })
        })
      })

      it('should have recorded the error', function (ctx) {
        expect(
          ctx.metrics.inc.calledWithExactly('subscribe.failed.applied-ops')
        ).to.equal(true)
      })

      it('should subscribe again', function (ctx) {
        ctx.rclient.subscribe.callCount.should.equal(2)
      })

      it('should cleanup', function (ctx) {
        ctx.ChannelManager.getClientMapEntry(ctx.rclient)
          .has('applied-ops:1234567890abcdef')
          .should.equal(false)
      })
    })

    describe('when subscribe errors and the clientChannelMap entry was replaced', function () {
      beforeEach(async function (ctx) {
        await new Promise((resolve, reject) => {
          ctx.rclient.subscribe = sinon
            .stub()
            .onFirstCall()
            .rejects(new Error('some redis error'))
            .onSecondCall()
            .resolves()
          ctx.first = ctx.ChannelManager.subscribe(
            ctx.rclient,
            'applied-ops',
            '1234567890abcdef'
          )
          // ignore error
          ctx.first.catch(() => {})
          expect(
            ctx.ChannelManager.getClientMapEntry(ctx.rclient).get(
              'applied-ops:1234567890abcdef'
            )
          ).to.equal(ctx.first)

          ctx.rclient.unsubscribe = sinon.stub().resolves()
          ctx.ChannelManager.unsubscribe(
            ctx.rclient,
            'applied-ops',
            '1234567890abcdef'
          )
          ctx.second = ctx.ChannelManager.subscribe(
            ctx.rclient,
            'applied-ops',
            '1234567890abcdef'
          )
          // should get replaced immediately
          expect(
            ctx.ChannelManager.getClientMapEntry(ctx.rclient).get(
              'applied-ops:1234567890abcdef'
            )
          ).to.equal(ctx.second)

          // let the first subscribe error -> unsubscribe -> subscribe
          setTimeout(resolve)
        })
      })

      it('should cleanup the second subscribePromise', function (ctx) {
        expect(
          ctx.ChannelManager.getClientMapEntry(ctx.rclient).has(
            'applied-ops:1234567890abcdef'
          )
        ).to.equal(false)
      })
    })

    describe('when there is an existing subscription for another redis client but not this one', function () {
      beforeEach(async function (ctx) {
        await new Promise(resolve => {
          ctx.other_rclient.subscribe = sinon.stub().resolves()
          ctx.ChannelManager.subscribe(
            ctx.other_rclient,
            'applied-ops',
            '1234567890abcdef'
          )
          ctx.rclient.subscribe = sinon.stub().resolves() // discard the original stub
          ctx.ChannelManager.subscribe(
            ctx.rclient,
            'applied-ops',
            '1234567890abcdef'
          )
          setTimeout(resolve)
        })
      })

      it('should subscribe to the redis channel on this redis client', function (ctx) {
        ctx.rclient.subscribe
          .calledWithExactly('applied-ops:1234567890abcdef')
          .should.equal(true)
      })
    })
  })

  describe('unsubscribe', function () {
    describe('when there is no existing subscription for this redis client', function () {
      beforeEach(async function (ctx) {
        await new Promise(resolve => {
          ctx.rclient.unsubscribe = sinon.stub().resolves()
          ctx.ChannelManager.unsubscribe(
            ctx.rclient,
            'applied-ops',
            '1234567890abcdef'
          )
          setTimeout(resolve)
        })
      })

      it('should unsubscribe from the redis channel', function (ctx) {
        ctx.rclient.unsubscribe.called.should.equal(true)
      })
    })

    describe('when there is an existing subscription for this another redis client but not this one', function () {
      beforeEach(async function (ctx) {
        await new Promise(resolve => {
          ctx.other_rclient.subscribe = sinon.stub().resolves()
          ctx.rclient.unsubscribe = sinon.stub().resolves()
          ctx.ChannelManager.subscribe(
            ctx.other_rclient,
            'applied-ops',
            '1234567890abcdef'
          )
          ctx.ChannelManager.unsubscribe(
            ctx.rclient,
            'applied-ops',
            '1234567890abcdef'
          )
          setTimeout(resolve)
        })
      })

      it('should still unsubscribe from the redis channel on this client', function (ctx) {
        ctx.rclient.unsubscribe.called.should.equal(true)
      })
    })

    describe('when unsubscribe errors and completes', function () {
      beforeEach(async function (ctx) {
        await new Promise((resolve, reject) => {
          ctx.rclient.subscribe = sinon.stub().resolves()
          ctx.ChannelManager.subscribe(
            ctx.rclient,
            'applied-ops',
            '1234567890abcdef'
          )
          ctx.rclient.unsubscribe = sinon
            .stub()
            .rejects(new Error('some redis error'))
          ctx.ChannelManager.unsubscribe(
            ctx.rclient,
            'applied-ops',
            '1234567890abcdef'
          )
          setTimeout(resolve)
          return null
        })
      })

      it('should have cleaned up', function (ctx) {
        ctx.ChannelManager.getClientMapEntry(ctx.rclient)
          .has('applied-ops:1234567890abcdef')
          .should.equal(false)
      })

      it('should not error out when subscribing again', async function (ctx) {
        await new Promise((resolve, reject) => {
          const p = ctx.ChannelManager.subscribe(
            ctx.rclient,
            'applied-ops',
            '1234567890abcdef'
          )
          p.then(() => resolve()).catch(reject)
        })
      })
    })

    describe('when unsubscribe errors and another client subscribes at the same time', function () {
      beforeEach(async function (ctx) {
        await new Promise((resolve, reject) => {
          ctx.rclient.subscribe = sinon.stub().resolves()
          ctx.ChannelManager.subscribe(
            ctx.rclient,
            'applied-ops',
            '1234567890abcdef'
          )
          let rejectSubscribe
          ctx.rclient.unsubscribe = () =>
            new Promise((resolve, reject) => (rejectSubscribe = reject))
          ctx.ChannelManager.unsubscribe(
            ctx.rclient,
            'applied-ops',
            '1234567890abcdef'
          )

          setTimeout(() => {
            // delay, actualUnsubscribe should not see the new subscribe request
            ctx.ChannelManager.subscribe(
              ctx.rclient,
              'applied-ops',
              '1234567890abcdef'
            )
              .then(() => setTimeout(resolve))
              .catch(reject)
            setTimeout(() =>
              // delay, rejectSubscribe is not defined immediately
              rejectSubscribe(new Error('redis error'))
            )
          })
        })
      })

      it('should have recorded the error', function (ctx) {
        expect(
          ctx.metrics.inc.calledWithExactly('unsubscribe.failed.applied-ops')
        ).to.equal(true)
      })

      it('should have subscribed', function (ctx) {
        ctx.rclient.subscribe.called.should.equal(true)
      })

      it('should have discarded the finished Promise', function (ctx) {
        ctx.ChannelManager.getClientMapEntry(ctx.rclient)
          .has('applied-ops:1234567890abcdef')
          .should.equal(false)
      })
    })

    describe('when there is an existing subscription for this redis client', function () {
      beforeEach(async function (ctx) {
        await new Promise((resolve, reject) => {
          ctx.rclient.subscribe = sinon.stub().resolves()
          ctx.rclient.unsubscribe = sinon.stub().resolves()
          ctx.ChannelManager.subscribe(
            ctx.rclient,
            'applied-ops',
            '1234567890abcdef'
          )
          ctx.ChannelManager.unsubscribe(
            ctx.rclient,
            'applied-ops',
            '1234567890abcdef'
          )
          setTimeout(resolve)
        })
      })

      it('should unsubscribe from the redis channel', function (ctx) {
        ctx.rclient.unsubscribe
          .calledWithExactly('applied-ops:1234567890abcdef')
          .should.equal(true)
      })
    })
  })

  describe('publish', function () {
    describe("when the channel is 'all'", function () {
      beforeEach(function (ctx) {
        ctx.rclient.publish = sinon.stub()
        ctx.ChannelManager.publish(
          ctx.rclient,
          'applied-ops',
          'all',
          'random-message'
        )
      })

      it('should publish on the base channel', function (ctx) {
        ctx.rclient.publish
          .calledWithExactly('applied-ops', 'random-message')
          .should.equal(true)
      })
    })

    describe('when the channel has an specific id', function () {
      describe('when the individual channel setting is false', function () {
        beforeEach(function (ctx) {
          ctx.rclient.publish = sinon.stub()
          ctx.settings.publishOnIndividualChannels = false
          ctx.ChannelManager.publish(
            ctx.rclient,
            'applied-ops',
            '1234567890abcdef',
            'random-message'
          )
        })

        it('should publish on the per-id channel', function (ctx) {
          ctx.rclient.publish
            .calledWithExactly('applied-ops', 'random-message')
            .should.equal(true)
          ctx.rclient.publish.calledOnce.should.equal(true)
        })
      })

      describe('when the individual channel setting is true', function () {
        beforeEach(function (ctx) {
          ctx.rclient.publish = sinon.stub()
          ctx.settings.publishOnIndividualChannels = true
          ctx.ChannelManager.publish(
            ctx.rclient,
            'applied-ops',
            '1234567890abcdef',
            'random-message'
          )
        })

        it('should publish on the per-id channel', function (ctx) {
          ctx.rclient.publish
            .calledWithExactly('applied-ops:1234567890abcdef', 'random-message')
            .should.equal(true)
          ctx.rclient.publish.calledOnce.should.equal(true)
        })
      })
    })

    describe('metrics', function () {
      beforeEach(function (ctx) {
        ctx.rclient.publish = sinon.stub()
        ctx.ChannelManager.publish(
          ctx.rclient,
          'applied-ops',
          'all',
          'random-message'
        )
      })

      it('should track the payload size', function (ctx) {
        ctx.metrics.summary
          .calledWithExactly(
            'redis.publish.applied-ops',
            'random-message'.length
          )
          .should.equal(true)
      })
    })
  })
})
