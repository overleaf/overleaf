import { vi, expect } from 'vitest'
import sinon from 'sinon'
const modulePath = '../../../../app/src/infrastructure/RateLimiter'

describe('RateLimiter', function () {
  beforeEach(async function (ctx) {
    ctx.rclient = {}
    ctx.RedisWrapper = {
      client: sinon.stub().returns(ctx.rclient),
    }
    ctx.RateLimiter = {
      RateLimiter: sinon.stub().withArgs('login').returns(ctx.rateLimiter),
    }

    ctx.RateLimiterFlexible = {
      RateLimiterRedis: sinon.stub(),
    }
    ctx.Settings = {}

    vi.doMock('../../../../app/src/infrastructure/RedisWrapper', () => ({
      default: ctx.RedisWrapper,
    }))

    vi.doMock('rate-limiter-flexible', () => ({
      default: ctx.RateLimiterFlexible,
    }))

    vi.doMock('@overleaf/settings', () => ({
      default: ctx.Settings,
    }))

    ctx.RateLimiter = (await import(modulePath)).default
  })

  describe('getSubnetKeyFromIp', function () {
    beforeEach(function (ctx) {
      ctx.rateLimiter = new ctx.RateLimiter.RateLimiter('some-limit', {
        points: 20,
        subnetPoints: 200,
        duration: 60,
      })
    })

    it('should correctly extract a subnet key from an ip address', function (ctx) {
      expect(ctx.rateLimiter.getSubnetKeyFromIp('255.255.255.255')).to.equal(
        '255.255.255'
      )
      expect(ctx.rateLimiter.getSubnetKeyFromIp('127.0.0.1')).to.equal(
        '127.0.0'
      )
      expect(ctx.rateLimiter.getSubnetKeyFromIp('243.12.3.126')).to.equal(
        '243.12.3'
      )
    })

    it('should throw an error when given an incorrectly formatted ip', function (ctx) {
      expect(() => ctx.rateLimiter.getSubnetKeyFromIp(1)).to.throw()
      expect(() => ctx.rateLimiter.getSubnetKeyFromIp('Not an ip')).to.throw()
      expect(() =>
        ctx.rateLimiter.getSubnetKeyFromIp('255.255.255.255.255.255')
      ).to.throw()
      expect(() => ctx.rateLimiter.getSubnetKeyFromIp('255.255.255')).to.throw()
    })
  })

  describe('_subnetRateLimiter', function () {
    it('should be defined by default', function (ctx) {
      const rateLimiter = new ctx.RateLimiter.RateLimiter('some-limit', {
        points: 20,
        subnetPoints: 200,
        duration: 60,
      })
      expect(rateLimiter._subnetRateLimiter).not.to.be.undefined
    })

    it('should be undefined when subnet rate limiting is disabled', function (ctx) {
      ctx.Settings.rateLimit = { subnetRateLimiterDisabled: true }

      const rateLimiter = new ctx.RateLimiter.RateLimiter('some-limit', {
        points: 20,
        subnetPoints: 200,
        duration: 60,
      })
      expect(rateLimiter._subnetRateLimiter).to.be.undefined
    })

    it('should be undefined when subnetPoints are not passed as an option', function (ctx) {
      const rateLimiter = new ctx.RateLimiter.RateLimiter('some-limit', {
        points: 20,
        duration: 60,
      })
      expect(rateLimiter._subnetRateLimiter).to.be.undefined
    })
  })
})
