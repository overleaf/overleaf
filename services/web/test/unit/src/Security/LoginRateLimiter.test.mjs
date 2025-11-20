import { vi, expect } from 'vitest'
import sinon from 'sinon'
const modulePath = '../../../../app/src/Features/Security/LoginRateLimiter'

describe('LoginRateLimiter', function () {
  beforeEach(async function (ctx) {
    ctx.email = 'bob@bob.com'
    ctx.rateLimiter = {
      consume: sinon.stub().resolves(),
      delete: sinon.stub().resolves(),
    }
    ctx.RateLimiter = {
      RateLimiter: sinon.stub().withArgs('login').returns(ctx.rateLimiter),
    }

    vi.doMock(
      '../../../../app/src/infrastructure/RateLimiter',
      () => ctx.RateLimiter
    )

    ctx.LoginRateLimiter = (await import(modulePath)).default
  })

  describe('processLoginRequest', function () {
    it('should consume points', async function (ctx) {
      await ctx.LoginRateLimiter.promises.processLoginRequest(ctx.email)
      expect(ctx.rateLimiter.consume).to.have.been.calledWith(ctx.email)
    })

    describe('when login is allowed', function () {
      it('should call pass allow=true', async function (ctx) {
        const allow = await ctx.LoginRateLimiter.promises.processLoginRequest(
          ctx.email
        )
        expect(allow).to.equal(true)
      })
    })

    describe('when login is blocked', function () {
      beforeEach(function (ctx) {
        ctx.rateLimiter.consume.rejects({ remainingPoints: 0 })
      })

      it('should call pass allow=false', async function (ctx) {
        const allow = await ctx.LoginRateLimiter.promises.processLoginRequest(
          ctx.email
        )
        expect(allow).to.equal(false)
      })
    })

    describe('when consume produces an error', function () {
      beforeEach(function (ctx) {
        ctx.rateLimiter.consume.rejects(new Error('woops'))
      })

      it('should produce an error', async function (ctx) {
        let error

        try {
          await ctx.LoginRateLimiter.promises.processLoginRequest(ctx.email)
        } catch (err) {
          error = err
        }

        expect(error).to.exist
      })
    })
  })

  describe('recordSuccessfulLogin', function () {
    it('should clear the rate limit', async function (ctx) {
      await ctx.LoginRateLimiter.promises.recordSuccessfulLogin(ctx.email)
      expect(ctx.rateLimiter.delete).to.have.been.calledWith(ctx.email)
    })
  })
})
