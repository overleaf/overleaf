const SandboxedModule = require('sandboxed-module')
const sinon = require('sinon')
const { expect } = require('chai')
const modulePath = require('path').join(
  __dirname,
  '../../../../app/src/Features/Security/LoginRateLimiter'
)

describe('LoginRateLimiter', function () {
  beforeEach(function () {
    this.email = 'bob@bob.com'
    this.rateLimiter = {
      consume: sinon.stub().resolves(),
      delete: sinon.stub().resolves(),
    }
    this.RateLimiter = {
      RateLimiter: sinon.stub().withArgs('login').returns(this.rateLimiter),
    }

    this.LoginRateLimiter = SandboxedModule.require(modulePath, {
      requires: {
        '../../infrastructure/RateLimiter': this.RateLimiter,
      },
    })
  })

  describe('processLoginRequest', function () {
    it('should consume points', async function () {
      await this.LoginRateLimiter.promises.processLoginRequest(this.email)
      expect(this.rateLimiter.consume).to.have.been.calledWith(this.email)
    })

    describe('when login is allowed', function () {
      it('should call pass allow=true', async function () {
        const allow = await this.LoginRateLimiter.promises.processLoginRequest(
          this.email
        )
        expect(allow).to.equal(true)
      })
    })

    describe('when login is blocked', function () {
      beforeEach(function () {
        this.rateLimiter.consume.rejects({ remainingPoints: 0 })
      })

      it('should call pass allow=false', async function () {
        const allow = await this.LoginRateLimiter.promises.processLoginRequest(
          this.email
        )
        expect(allow).to.equal(false)
      })
    })

    describe('when consume produces an error', function () {
      beforeEach(function () {
        this.rateLimiter.consume.rejects(new Error('woops'))
      })

      it('should produce an error', async function () {
        let error

        try {
          await this.LoginRateLimiter.promises.processLoginRequest(this.email)
        } catch (err) {
          error = err
        }

        expect(error).to.exist
      })
    })
  })

  describe('recordSuccessfulLogin', function () {
    it('should clear the rate limit', async function () {
      await this.LoginRateLimiter.promises.recordSuccessfulLogin(this.email)
      expect(this.rateLimiter.delete).to.have.been.calledWith(this.email)
    })
  })
})
