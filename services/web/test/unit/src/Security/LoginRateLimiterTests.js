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
    it('should consume points', function (done) {
      this.LoginRateLimiter.processLoginRequest(this.email, (err, allow) => {
        if (err) {
          return done(err)
        }
        expect(this.rateLimiter.consume).to.have.been.calledWith(this.email)
        done()
      })
    })

    describe('when login is allowed', function () {
      it('should call pass allow=true', function (done) {
        this.LoginRateLimiter.processLoginRequest(this.email, (err, allow) => {
          expect(err).to.equal(null)
          expect(allow).to.equal(true)
          done()
        })
      })
    })

    describe('when login is blocked', function () {
      beforeEach(function () {
        this.rateLimiter.consume.rejects({ remainingPoints: 0 })
      })

      it('should call pass allow=false', function (done) {
        this.LoginRateLimiter.processLoginRequest(this.email, (err, allow) => {
          expect(err).to.equal(null)
          expect(allow).to.equal(false)
          done()
        })
      })
    })

    describe('when consume produces an error', function () {
      beforeEach(function () {
        this.rateLimiter.consume.rejects(new Error('woops'))
      })

      it('should produce an error', function (done) {
        this.LoginRateLimiter.processLoginRequest(this.email, (err, allow) => {
          expect(err).to.not.equal(null)
          expect(err).to.be.instanceof(Error)
          done()
        })
      })
    })
  })

  describe('recordSuccessfulLogin', function () {
    it('should clear the rate limit', function (done) {
      this.LoginRateLimiter.recordSuccessfulLogin(this.email, () => {
        expect(this.rateLimiter.delete).to.have.been.calledWith(this.email)
        done()
      })
    })
  })
})
