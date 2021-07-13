/* eslint-disable
    no-return-assign,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const { expect } = require('chai')
const sinon = require('sinon')
const modulePath = '../../../app/js/ChannelManager.js'
const SandboxedModule = require('sandboxed-module')

describe('ChannelManager', function () {
  beforeEach(function () {
    this.rclient = {}
    this.other_rclient = {}
    return (this.ChannelManager = SandboxedModule.require(modulePath, {
      requires: {
        '@overleaf/settings': (this.settings = {}),
        '@overleaf/metrics': (this.metrics = {
          inc: sinon.stub(),
          summary: sinon.stub(),
        }),
      },
    }))
  })

  describe('subscribe', function () {
    describe('when there is no existing subscription for this redis client', function () {
      beforeEach(function (done) {
        this.rclient.subscribe = sinon.stub().resolves()
        this.ChannelManager.subscribe(
          this.rclient,
          'applied-ops',
          '1234567890abcdef'
        )
        return setTimeout(done)
      })

      return it('should subscribe to the redis channel', function () {
        return this.rclient.subscribe
          .calledWithExactly('applied-ops:1234567890abcdef')
          .should.equal(true)
      })
    })

    describe('when there is an existing subscription for this redis client', function () {
      beforeEach(function (done) {
        this.rclient.subscribe = sinon.stub().resolves()
        this.ChannelManager.subscribe(
          this.rclient,
          'applied-ops',
          '1234567890abcdef'
        )
        this.ChannelManager.subscribe(
          this.rclient,
          'applied-ops',
          '1234567890abcdef'
        )
        return setTimeout(done)
      })

      return it('should subscribe to the redis channel again', function () {
        return this.rclient.subscribe.callCount.should.equal(2)
      })
    })

    describe('when subscribe errors', function () {
      beforeEach(function (done) {
        this.rclient.subscribe = sinon
          .stub()
          .onFirstCall()
          .rejects(new Error('some redis error'))
          .onSecondCall()
          .resolves()
        const p = this.ChannelManager.subscribe(
          this.rclient,
          'applied-ops',
          '1234567890abcdef'
        )
        p.then(() => done(new Error('should not subscribe but fail'))).catch(
          err => {
            err.message.should.equal('failed to subscribe to channel')
            err.cause.message.should.equal('some redis error')
            this.ChannelManager.getClientMapEntry(this.rclient)
              .has('applied-ops:1234567890abcdef')
              .should.equal(false)
            this.ChannelManager.subscribe(
              this.rclient,
              'applied-ops',
              '1234567890abcdef'
            )
            // subscribe is wrapped in Promise, delay other assertions
            return setTimeout(done)
          }
        )
        return null
      })

      it('should have recorded the error', function () {
        return expect(
          this.metrics.inc.calledWithExactly('subscribe.failed.applied-ops')
        ).to.equal(true)
      })

      it('should subscribe again', function () {
        return this.rclient.subscribe.callCount.should.equal(2)
      })

      return it('should cleanup', function () {
        return this.ChannelManager.getClientMapEntry(this.rclient)
          .has('applied-ops:1234567890abcdef')
          .should.equal(false)
      })
    })

    describe('when subscribe errors and the clientChannelMap entry was replaced', function () {
      beforeEach(function (done) {
        this.rclient.subscribe = sinon
          .stub()
          .onFirstCall()
          .rejects(new Error('some redis error'))
          .onSecondCall()
          .resolves()
        this.first = this.ChannelManager.subscribe(
          this.rclient,
          'applied-ops',
          '1234567890abcdef'
        )
        // ignore error
        this.first.catch(() => {})
        expect(
          this.ChannelManager.getClientMapEntry(this.rclient).get(
            'applied-ops:1234567890abcdef'
          )
        ).to.equal(this.first)

        this.rclient.unsubscribe = sinon.stub().resolves()
        this.ChannelManager.unsubscribe(
          this.rclient,
          'applied-ops',
          '1234567890abcdef'
        )
        this.second = this.ChannelManager.subscribe(
          this.rclient,
          'applied-ops',
          '1234567890abcdef'
        )
        // should get replaced immediately
        expect(
          this.ChannelManager.getClientMapEntry(this.rclient).get(
            'applied-ops:1234567890abcdef'
          )
        ).to.equal(this.second)

        // let the first subscribe error -> unsubscribe -> subscribe
        return setTimeout(done)
      })

      return it('should cleanup the second subscribePromise', function () {
        return expect(
          this.ChannelManager.getClientMapEntry(this.rclient).has(
            'applied-ops:1234567890abcdef'
          )
        ).to.equal(false)
      })
    })

    return describe('when there is an existing subscription for another redis client but not this one', function () {
      beforeEach(function (done) {
        this.other_rclient.subscribe = sinon.stub().resolves()
        this.ChannelManager.subscribe(
          this.other_rclient,
          'applied-ops',
          '1234567890abcdef'
        )
        this.rclient.subscribe = sinon.stub().resolves() // discard the original stub
        this.ChannelManager.subscribe(
          this.rclient,
          'applied-ops',
          '1234567890abcdef'
        )
        return setTimeout(done)
      })

      return it('should subscribe to the redis channel on this redis client', function () {
        return this.rclient.subscribe
          .calledWithExactly('applied-ops:1234567890abcdef')
          .should.equal(true)
      })
    })
  })

  describe('unsubscribe', function () {
    describe('when there is no existing subscription for this redis client', function () {
      beforeEach(function (done) {
        this.rclient.unsubscribe = sinon.stub().resolves()
        this.ChannelManager.unsubscribe(
          this.rclient,
          'applied-ops',
          '1234567890abcdef'
        )
        return setTimeout(done)
      })

      return it('should unsubscribe from the redis channel', function () {
        return this.rclient.unsubscribe.called.should.equal(true)
      })
    })

    describe('when there is an existing subscription for this another redis client but not this one', function () {
      beforeEach(function (done) {
        this.other_rclient.subscribe = sinon.stub().resolves()
        this.rclient.unsubscribe = sinon.stub().resolves()
        this.ChannelManager.subscribe(
          this.other_rclient,
          'applied-ops',
          '1234567890abcdef'
        )
        this.ChannelManager.unsubscribe(
          this.rclient,
          'applied-ops',
          '1234567890abcdef'
        )
        return setTimeout(done)
      })

      return it('should still unsubscribe from the redis channel on this client', function () {
        return this.rclient.unsubscribe.called.should.equal(true)
      })
    })

    describe('when unsubscribe errors and completes', function () {
      beforeEach(function (done) {
        this.rclient.subscribe = sinon.stub().resolves()
        this.ChannelManager.subscribe(
          this.rclient,
          'applied-ops',
          '1234567890abcdef'
        )
        this.rclient.unsubscribe = sinon
          .stub()
          .rejects(new Error('some redis error'))
        this.ChannelManager.unsubscribe(
          this.rclient,
          'applied-ops',
          '1234567890abcdef'
        )
        setTimeout(done)
        return null
      })

      it('should have cleaned up', function () {
        return this.ChannelManager.getClientMapEntry(this.rclient)
          .has('applied-ops:1234567890abcdef')
          .should.equal(false)
      })

      return it('should not error out when subscribing again', function (done) {
        const p = this.ChannelManager.subscribe(
          this.rclient,
          'applied-ops',
          '1234567890abcdef'
        )
        p.then(() => done()).catch(done)
        return null
      })
    })

    describe('when unsubscribe errors and another client subscribes at the same time', function () {
      beforeEach(function (done) {
        this.rclient.subscribe = sinon.stub().resolves()
        this.ChannelManager.subscribe(
          this.rclient,
          'applied-ops',
          '1234567890abcdef'
        )
        let rejectSubscribe
        this.rclient.unsubscribe = () =>
          new Promise((resolve, reject) => (rejectSubscribe = reject))
        this.ChannelManager.unsubscribe(
          this.rclient,
          'applied-ops',
          '1234567890abcdef'
        )

        setTimeout(() => {
          // delay, actualUnsubscribe should not see the new subscribe request
          this.ChannelManager.subscribe(
            this.rclient,
            'applied-ops',
            '1234567890abcdef'
          )
            .then(() => setTimeout(done))
            .catch(done)
          return setTimeout(() =>
            // delay, rejectSubscribe is not defined immediately
            rejectSubscribe(new Error('redis error'))
          )
        })
        return null
      })

      it('should have recorded the error', function () {
        return expect(
          this.metrics.inc.calledWithExactly('unsubscribe.failed.applied-ops')
        ).to.equal(true)
      })

      it('should have subscribed', function () {
        return this.rclient.subscribe.called.should.equal(true)
      })

      return it('should have discarded the finished Promise', function () {
        return this.ChannelManager.getClientMapEntry(this.rclient)
          .has('applied-ops:1234567890abcdef')
          .should.equal(false)
      })
    })

    return describe('when there is an existing subscription for this redis client', function () {
      beforeEach(function (done) {
        this.rclient.subscribe = sinon.stub().resolves()
        this.rclient.unsubscribe = sinon.stub().resolves()
        this.ChannelManager.subscribe(
          this.rclient,
          'applied-ops',
          '1234567890abcdef'
        )
        this.ChannelManager.unsubscribe(
          this.rclient,
          'applied-ops',
          '1234567890abcdef'
        )
        return setTimeout(done)
      })

      return it('should unsubscribe from the redis channel', function () {
        return this.rclient.unsubscribe
          .calledWithExactly('applied-ops:1234567890abcdef')
          .should.equal(true)
      })
    })
  })

  return describe('publish', function () {
    describe("when the channel is 'all'", function () {
      beforeEach(function () {
        this.rclient.publish = sinon.stub()
        return this.ChannelManager.publish(
          this.rclient,
          'applied-ops',
          'all',
          'random-message'
        )
      })

      return it('should publish on the base channel', function () {
        return this.rclient.publish
          .calledWithExactly('applied-ops', 'random-message')
          .should.equal(true)
      })
    })

    describe('when the channel has an specific id', function () {
      describe('when the individual channel setting is false', function () {
        beforeEach(function () {
          this.rclient.publish = sinon.stub()
          this.settings.publishOnIndividualChannels = false
          return this.ChannelManager.publish(
            this.rclient,
            'applied-ops',
            '1234567890abcdef',
            'random-message'
          )
        })

        return it('should publish on the per-id channel', function () {
          this.rclient.publish
            .calledWithExactly('applied-ops', 'random-message')
            .should.equal(true)
          return this.rclient.publish.calledOnce.should.equal(true)
        })
      })

      return describe('when the individual channel setting is true', function () {
        beforeEach(function () {
          this.rclient.publish = sinon.stub()
          this.settings.publishOnIndividualChannels = true
          return this.ChannelManager.publish(
            this.rclient,
            'applied-ops',
            '1234567890abcdef',
            'random-message'
          )
        })

        return it('should publish on the per-id channel', function () {
          this.rclient.publish
            .calledWithExactly('applied-ops:1234567890abcdef', 'random-message')
            .should.equal(true)
          return this.rclient.publish.calledOnce.should.equal(true)
        })
      })
    })

    return describe('metrics', function () {
      beforeEach(function () {
        this.rclient.publish = sinon.stub()
        return this.ChannelManager.publish(
          this.rclient,
          'applied-ops',
          'all',
          'random-message'
        )
      })

      return it('should track the payload size', function () {
        return this.metrics.summary
          .calledWithExactly(
            'redis.publish.applied-ops',
            'random-message'.length
          )
          .should.equal(true)
      })
    })
  })
})
