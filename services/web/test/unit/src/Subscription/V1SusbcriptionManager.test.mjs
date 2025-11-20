import { vi, expect } from 'vitest'
import path from 'node:path'
import sinon from 'sinon'
const modulePath = path.join(
  import.meta.dirname,
  '../../../../app/src/Features/Subscription/V1SubscriptionManager'
)

describe('V1SubscriptionManager', function () {
  beforeEach(async function (ctx) {
    vi.doMock('../../../../app/src/Features/User/UserGetter', () => ({
      default: (ctx.UserGetter = {}),
    }))

    vi.doMock('@overleaf/settings', () => ({
      default: (ctx.Settings = {
        apis: {
          v1: {
            host: (ctx.host = 'http://overleaf.example.com'),
            url: 'v1.url',
          },
        },
        v1GrandfatheredFeaturesUidCutoff: 10,
        v1GrandfatheredFeatures: {
          github: true,
          mendeley: true,
        },
      }),
    }))

    vi.doMock('requestretry', () => ({
      default: (ctx.request = sinon.stub()),
    }))

    ctx.V1SubscriptionManager = (await import(modulePath)).default
    ctx.userId = 'abcd'
    ctx.v1UserId = 42
    ctx.user = {
      _id: ctx.userId,
      email: 'user@example.com',
      overleaf: {
        id: ctx.v1UserId,
      },
    }
  })

  describe('getGrandfatheredFeaturesForV1User', function () {
    describe('when the user ID is greater than the cutoff', function () {
      it('should return an empty feature set', async function (ctx) {
        await new Promise(resolve => {
          expect(
            ctx.V1SubscriptionManager.getGrandfatheredFeaturesForV1User(100)
          ).to.eql({})
          resolve()
        })
      })
    })

    describe('when the user ID is less than the cutoff', function () {
      it('should return a feature set with grandfathered properties for github and mendeley', async function (ctx) {
        await new Promise(resolve => {
          expect(
            ctx.V1SubscriptionManager.getGrandfatheredFeaturesForV1User(1)
          ).to.eql({
            github: true,
            mendeley: true,
          })
          resolve()
        })
      })
    })
  })

  describe('_v1Request', function () {
    beforeEach(function (ctx) {
      ctx.UserGetter.getUser = sinon.stub().yields(null, ctx.user)
    })

    describe('when v1IdForUser produces an error', function () {
      beforeEach(function (ctx) {
        ctx.V1SubscriptionManager.v1IdForUser = sinon
          .stub()
          .yields(new Error('woops'))
        ctx.call = cb => {
          ctx.V1SubscriptionManager._v1Request(
            ctx.user_id,
            {
              url() {
                return '/foo'
              },
            },
            cb
          )
        }
      })

      it('should not call request', async function (ctx) {
        await new Promise(resolve => {
          ctx.call(() => {
            expect(ctx.request.callCount).to.equal(0)
            resolve()
          })
        })
      })

      it('should produce an error', async function (ctx) {
        await new Promise(resolve => {
          ctx.call((err, planCode) => {
            expect(err).to.exist
            resolve()
          })
        })
      })
    })

    describe('when v1IdForUser does not find a user', function () {
      beforeEach(function (ctx) {
        ctx.V1SubscriptionManager.v1IdForUser = sinon.stub().yields(null, null)
        ctx.call = cb => {
          ctx.V1SubscriptionManager._v1Request(
            ctx.user_id,
            {
              url() {
                return '/foo'
              },
            },
            cb
          )
        }
      })

      it('should not call request', async function (ctx) {
        await new Promise(resolve => {
          ctx.call((err, planCode) => {
            if (err) return resolve(err)
            expect(ctx.request.callCount).to.equal(0)
            resolve()
          })
        })
      })

      it('should not error', async function (ctx) {
        await new Promise(resolve => {
          ctx.call(err => {
            expect(err).to.not.exist
            resolve()
          })
        })
      })
    })

    describe('when the request to v1 fails', function () {
      beforeEach(function (ctx) {
        ctx.request.yields(new Error('woops'))
        ctx.call = cb => {
          ctx.V1SubscriptionManager._v1Request(
            ctx.user_id,
            {
              url() {
                return '/foo'
              },
            },
            cb
          )
        }
      })

      it('should produce an error', async function (ctx) {
        await new Promise(resolve => {
          ctx.call(err => {
            expect(err).to.exist
            resolve()
          })
        })
      })
    })

    describe('when the call succeeds', function () {
      beforeEach(function (ctx) {
        ctx.V1SubscriptionManager.v1IdForUser = sinon
          .stub()
          .yields(null, ctx.v1UserId)
        ctx.request.yields(null, { statusCode: 200 }, '{}')
        ctx.call = cb => {
          ctx.V1SubscriptionManager._v1Request(
            ctx.user_id,
            {
              method: 'GET',
              url() {
                return '/foo'
              },
            },
            cb
          )
        }
      })

      it('should not produce an error', async function (ctx) {
        await new Promise(resolve => {
          ctx.call((err, body, v1Id) => {
            expect(err).not.to.exist
            resolve()
          })
        })
      })

      it('should have supplied retry options to request', async function (ctx) {
        await new Promise(resolve => {
          ctx.call((err, body, v1Id) => {
            if (err) return resolve(err)
            const requestOptions = ctx.request.lastCall.args[0]
            expect(requestOptions.url).to.equal('/foo')
            expect(requestOptions.maxAttempts).to.exist
            expect(requestOptions.maxAttempts > 0).to.be.true
            expect(requestOptions.retryDelay).to.exist
            expect(requestOptions.retryDelay > 0).to.be.true
            resolve()
          })
        })
      })

      it('should return the v1 user id', async function (ctx) {
        await new Promise(resolve => {
          ctx.call((err, body, v1Id) => {
            if (err) return resolve(err)
            expect(v1Id).to.equal(ctx.v1UserId)
            resolve()
          })
        })
      })

      it('should return the http response body', async function (ctx) {
        await new Promise(resolve => {
          ctx.call((err, body, v1Id) => {
            if (err) return resolve(err)
            expect(body).to.equal('{}')
            resolve()
          })
        })
      })
    })

    describe('when the call returns an http error status code', function () {
      beforeEach(function (ctx) {
        ctx.V1SubscriptionManager.v1IdForUser = sinon
          .stub()
          .yields(null, ctx.v1UserId)
        ctx.request.yields(null, { statusCode: 500 }, '{}')
        ctx.call = cb => {
          ctx.V1SubscriptionManager._v1Request(
            ctx.user_id,
            {
              url() {
                return '/foo'
              },
            },
            cb
          )
        }
      })

      it('should produce an error', async function (ctx) {
        await new Promise(resolve => {
          ctx.call((err, body, v1Id) => {
            expect(err).to.exist
            resolve()
          })
        })
      })
    })

    describe('when the call returns an http not-found status code', function () {
      beforeEach(function (ctx) {
        ctx.V1SubscriptionManager.v1IdForUser = sinon
          .stub()
          .yields(null, ctx.v1UserId)
        ctx.request.yields(null, { statusCode: 404 }, '{}')
        ctx.call = cb => {
          ctx.V1SubscriptionManager._v1Request(
            ctx.user_id,
            {
              url() {
                return '/foo'
              },
            },
            cb
          )
        }
      })

      it('should produce an not-found error', async function (ctx) {
        await new Promise(resolve => {
          ctx.call((err, body, v1Id) => {
            expect(err).to.exist
            expect(err.name).to.equal('NotFoundError')
            resolve()
          })
        })
      })
    })
  })

  describe('v1IdForUser', function () {
    beforeEach(function (ctx) {
      ctx.UserGetter.getUser = sinon.stub().yields(null, ctx.user)
    })

    describe('when getUser produces an error', function () {
      beforeEach(function (ctx) {
        ctx.UserGetter.getUser = sinon.stub().yields(new Error('woops'))
        ctx.call = cb => {
          ctx.V1SubscriptionManager.v1IdForUser(ctx.user_id, cb)
        }
      })

      it('should produce an error', async function (ctx) {
        await new Promise(resolve => {
          ctx.call(err => {
            expect(err).to.exist
            resolve()
          })
        })
      })
    })

    describe('when getUser does not find a user', function () {
      beforeEach(function (ctx) {
        ctx.UserGetter.getUser = sinon.stub().yields(null, null)
        ctx.call = cb => {
          ctx.V1SubscriptionManager.v1IdForUser(ctx.user_id, cb)
        }
      })

      it('should not error', async function (ctx) {
        await new Promise(resolve => {
          ctx.call((err, userId) => {
            expect(err).to.not.exist
            resolve()
          })
        })
      })
    })

    describe('when it works', function () {
      beforeEach(function (ctx) {
        ctx.call = cb => {
          ctx.V1SubscriptionManager.v1IdForUser(ctx.user_id, cb)
        }
      })

      it('should not error', async function (ctx) {
        await new Promise(resolve => {
          ctx.call((err, userId) => {
            expect(err).to.not.exist
            resolve()
          })
        })
      })

      it('should return the v1 user id', async function (ctx) {
        await new Promise(resolve => {
          ctx.call((err, userId) => {
            if (err) return resolve(err)
            expect(userId).to.eql(42)
            resolve()
          })
        })
      })
    })
  })
})
