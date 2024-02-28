const SandboxedModule = require('sandboxed-module')
const sinon = require('sinon')
const { expect } = require('chai')
const modulePath = require('path').join(
  __dirname,
  '../../../../app/src/infrastructure/RateLimiter'
)

describe('RateLimiter', function () {
  beforeEach(function () {
    this.rclient = {}
    this.RedisWrapper = {
      client: sinon.stub().returns(this.rclient),
    }
    this.RateLimiter = {
      RateLimiter: sinon.stub().withArgs('login').returns(this.rateLimiter),
    }

    this.RateLimiterFlexible = {
      RateLimiterRedis: sinon.stub(),
    }

    this.RateLimiter = SandboxedModule.require(modulePath, {
      requires: {
        './RedisWrapper': this.RedisWrapper,
        'rate-limiter-flexible': this.RateLimiterFlexible,
      },
    })
  })

  describe('getSubnetKeyFromIp', function () {
    beforeEach(function () {
      this.rateLimiter = new this.RateLimiter.RateLimiter('some-limit', {
        points: 20,
        subnetPoints: 200,
        duration: 60,
      })
    })

    it('should correctly extract a subnet key from an ip address', function () {
      expect(this.rateLimiter.getSubnetKeyFromIp('255.255.255.255')).to.equal(
        '255.255.255'
      )
      expect(this.rateLimiter.getSubnetKeyFromIp('127.0.0.1')).to.equal(
        '127.0.0'
      )
      expect(this.rateLimiter.getSubnetKeyFromIp('243.12.3.126')).to.equal(
        '243.12.3'
      )
    })

    it('should throw an error when given an incorrectly formatted ip', function () {
      expect(() => this.rateLimiter.getSubnetKeyFromIp(1)).to.throw()
      expect(() => this.rateLimiter.getSubnetKeyFromIp('Not an ip')).to.throw()
      expect(() =>
        this.rateLimiter.getSubnetKeyFromIp('255.255.255.255.255.255')
      ).to.throw()
      expect(() =>
        this.rateLimiter.getSubnetKeyFromIp('255.255.255')
      ).to.throw()
    })
  })
})
