/* eslint-disable
    camelcase,
    handle-callback-err,
    max-len,
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
const should = require('chai').should()
const SandboxedModule = require('sandboxed-module')
const assert = require('assert')
const path = require('path')
const modulePath = path.join(
  __dirname,
  '../../../../app/src/Features/Subscription/V1SubscriptionManager'
)
const sinon = require('sinon')
const { expect } = require('chai')

describe('V1SubscriptionManager', function() {
  beforeEach(function() {
    this.V1SubscriptionManager = SandboxedModule.require(modulePath, {
      globals: {
        console: console
      },
      requires: {
        '../User/UserGetter': (this.UserGetter = {}),
        'logger-sharelatex': {
          log: sinon.stub(),
          err: sinon.stub(),
          warn: sinon.stub()
        },
        'settings-sharelatex': (this.Settings = {
          apis: {
            v1: {
              host: (this.host = 'http://overleaf.example.com'),
              url: 'v1.url'
            }
          },
          v1GrandfatheredFeaturesUidCutoff: 10,
          v1GrandfatheredFeatures: {
            github: true,
            mendeley: true
          }
        }),
        request: (this.request = sinon.stub())
      }
    })
    this.userId = 'abcd'
    this.v1UserId = 42
    return (this.user = {
      _id: this.userId,
      email: 'user@example.com',
      overleaf: {
        id: this.v1UserId
      }
    })
  })

  describe('getPlanCodeFromV1', function() {
    beforeEach(function() {
      this.responseBody = {
        id: 32,
        plan_name: 'pro'
      }
      this.V1SubscriptionManager._v1Request = sinon
        .stub()
        .yields(null, this.responseBody)
      return (this.call = cb => {
        return this.V1SubscriptionManager.getPlanCodeFromV1(this.userId, cb)
      })
    })

    describe('when all goes well', function() {
      it('should call _v1Request', function(done) {
        return this.call((err, planCode) => {
          expect(this.V1SubscriptionManager._v1Request.callCount).to.equal(1)
          expect(
            this.V1SubscriptionManager._v1Request.calledWith(this.userId)
          ).to.equal(true)
          return done()
        })
      })

      it('should return the v1 user id', function(done) {
        return this.call(function(err, planCode, v1Id) {
          expect(v1Id).to.equal(this.v1UserId)
          return done()
        })
      })

      it('should produce a plan-code without error', function(done) {
        return this.call((err, planCode) => {
          expect(err).to.not.exist
          expect(planCode).to.equal('v1_pro')
          return done()
        })
      })

      describe('when the plan_name from v1 is null', function() {
        beforeEach(function() {
          return (this.responseBody.plan_name = null)
        })

        it('should produce a null plan-code without error', function(done) {
          return this.call((err, planCode) => {
            expect(err).to.not.exist
            expect(planCode).to.equal(null)
            return done()
          })
        })
      })
    })
  })

  describe('getGrandfatheredFeaturesForV1User', function() {
    describe('when the user ID is greater than the cutoff', function() {
      it('should return an empty feature set', function(done) {
        expect(
          this.V1SubscriptionManager.getGrandfatheredFeaturesForV1User(100)
        ).to.eql({})
        return done()
      })
    })

    describe('when the user ID is less than the cutoff', function() {
      it('should return a feature set with grandfathered properties for github and mendeley', function(done) {
        expect(
          this.V1SubscriptionManager.getGrandfatheredFeaturesForV1User(1)
        ).to.eql({
          github: true,
          mendeley: true
        })
        return done()
      })
    })
  })

  describe('_v1Request', function() {
    beforeEach(function() {
      return (this.UserGetter.getUser = sinon.stub().yields(null, this.user))
    })

    describe('when v1IdForUser produces an error', function() {
      beforeEach(function() {
        this.V1SubscriptionManager.v1IdForUser = sinon
          .stub()
          .yields(new Error('woops'))
        return (this.call = cb => {
          return this.V1SubscriptionManager._v1Request(
            this.user_id,
            {
              url() {
                return '/foo'
              }
            },
            cb
          )
        })
      })

      it('should not call request', function(done) {
        return this.call((err, planCode) => {
          expect(this.request.callCount).to.equal(0)
          return done()
        })
      })

      it('should produce an error', function(done) {
        return this.call((err, planCode) => {
          expect(err).to.exist
          return done()
        })
      })
    })

    describe('when v1IdForUser does not find a user', function() {
      beforeEach(function() {
        this.V1SubscriptionManager.v1IdForUser = sinon.stub().yields(null, null)
        return (this.call = cb => {
          return this.V1SubscriptionManager._v1Request(
            this.user_id,
            {
              url() {
                return '/foo'
              }
            },
            cb
          )
        })
      })

      it('should not call request', function(done) {
        return this.call((err, planCode) => {
          expect(this.request.callCount).to.equal(0)
          return done()
        })
      })

      it('should not error', function(done) {
        return this.call(err => {
          expect(err).to.not.exist
          return done()
        })
      })
    })

    describe('when the request to v1 fails', function() {
      beforeEach(function() {
        this.request.yields(new Error('woops'))
        return (this.call = cb => {
          return this.V1SubscriptionManager._v1Request(
            this.user_id,
            {
              url() {
                return '/foo'
              }
            },
            cb
          )
        })
      })

      it('should produce an error', function(done) {
        return this.call(err => {
          expect(err).to.exist
          return done()
        })
      })
    })

    describe('when the call succeeds', function() {
      beforeEach(function() {
        this.V1SubscriptionManager.v1IdForUser = sinon
          .stub()
          .yields(null, this.v1UserId)
        this.request.yields(null, { statusCode: 200 }, '{}')
        return (this.call = cb => {
          return this.V1SubscriptionManager._v1Request(
            this.user_id,
            {
              url() {
                return '/foo'
              }
            },
            cb
          )
        })
      })

      it('should not produce an error', function(done) {
        return this.call((err, body, v1Id) => {
          expect(err).not.to.exist
          return done()
        })
      })

      it('should return the v1 user id', function(done) {
        return this.call((err, body, v1Id) => {
          expect(v1Id).to.equal(this.v1UserId)
          return done()
        })
      })

      it('should return the http response body', function(done) {
        return this.call((err, body, v1Id) => {
          expect(body).to.equal('{}')
          return done()
        })
      })
    })

    describe('when the call returns an http error status code', function() {
      beforeEach(function() {
        this.V1SubscriptionManager.v1IdForUser = sinon
          .stub()
          .yields(null, this.v1UserId)
        this.request.yields(null, { statusCode: 500 }, '{}')
        return (this.call = cb => {
          return this.V1SubscriptionManager._v1Request(
            this.user_id,
            {
              url() {
                return '/foo'
              }
            },
            cb
          )
        })
      })

      it('should produce an error', function(done) {
        return this.call((err, body, v1Id) => {
          expect(err).to.exist
          return done()
        })
      })
    })

    describe('when the call returns an http not-found status code', function() {
      beforeEach(function() {
        this.V1SubscriptionManager.v1IdForUser = sinon
          .stub()
          .yields(null, this.v1UserId)
        this.request.yields(null, { statusCode: 404 }, '{}')
        return (this.call = cb => {
          return this.V1SubscriptionManager._v1Request(
            this.user_id,
            {
              url() {
                return '/foo'
              }
            },
            cb
          )
        })
      })

      it('should produce an not-found error', function(done) {
        return this.call((err, body, v1Id) => {
          expect(err).to.exist
          expect(err.name).to.equal('NotFoundError')
          return done()
        })
      })
    })
  })

  describe('v1IdForUser', function() {
    beforeEach(function() {
      return (this.UserGetter.getUser = sinon.stub().yields(null, this.user))
    })

    describe('when getUser produces an error', function() {
      beforeEach(function() {
        this.UserGetter.getUser = sinon.stub().yields(new Error('woops'))
        return (this.call = cb => {
          return this.V1SubscriptionManager.v1IdForUser(this.user_id, cb)
        })
      })

      it('should produce an error', function(done) {
        return this.call(err => {
          expect(err).to.exist
          return done()
        })
      })
    })

    describe('when getUser does not find a user', function() {
      beforeEach(function() {
        this.UserGetter.getUser = sinon.stub().yields(null, null)
        return (this.call = cb => {
          return this.V1SubscriptionManager.v1IdForUser(this.user_id, cb)
        })
      })

      it('should not error', function(done) {
        return this.call((err, user_id) => {
          expect(err).to.not.exist
          return done()
        })
      })
    })

    describe('when it works', function() {
      beforeEach(function() {
        return (this.call = cb => {
          return this.V1SubscriptionManager.v1IdForUser(this.user_id, cb)
        })
      })

      it('should not error', function(done) {
        return this.call((err, user_id) => {
          expect(err).to.not.exist
          return done()
        })
      })

      it('should return the v1 user id', function(done) {
        return this.call((err, user_id) => {
          expect(user_id).to.eql(42)
          return done()
        })
      })
    })
  })
})
