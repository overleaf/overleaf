/* eslint-disable
    handle-callback-err,
    max-len,
    no-return-assign,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const SandboxedModule = require('sandboxed-module')
const sinon = require('sinon')
require('chai').should()
const { expect } = require('chai')
const modulePath = require('path').join(
  __dirname,
  '../../../../app/src/Features/Security/LoginRateLimiter'
)

describe('LoginRateLimiter', function() {
  beforeEach(function() {
    this.email = 'bob@bob.com'
    this.RateLimiter = {
      clearRateLimit: sinon.stub(),
      addCount: sinon.stub()
    }

    return (this.LoginRateLimiter = SandboxedModule.require(modulePath, {
      globals: {
        console: console
      },
      requires: {
        '../../infrastructure/RateLimiter': this.RateLimiter
      }
    }))
  })

  describe('processLoginRequest', function() {
    beforeEach(function() {
      return (this.RateLimiter.addCount = sinon
        .stub()
        .callsArgWith(1, null, true))
    })

    it('should call RateLimiter.addCount', function(done) {
      return this.LoginRateLimiter.processLoginRequest(
        this.email,
        (err, allow) => {
          this.RateLimiter.addCount.callCount.should.equal(1)
          expect(
            this.RateLimiter.addCount.lastCall.args[0].endpointName
          ).to.equal('login')
          expect(
            this.RateLimiter.addCount.lastCall.args[0].subjectName
          ).to.equal(this.email)
          return done()
        }
      )
    })

    describe('when login is allowed', function() {
      beforeEach(function() {
        return (this.RateLimiter.addCount = sinon
          .stub()
          .callsArgWith(1, null, true))
      })

      it('should call pass allow=true', function(done) {
        return this.LoginRateLimiter.processLoginRequest(
          this.email,
          (err, allow) => {
            expect(err).to.equal(null)
            expect(allow).to.equal(true)
            return done()
          }
        )
      })
    })

    describe('when login is blocked', function() {
      beforeEach(function() {
        return (this.RateLimiter.addCount = sinon
          .stub()
          .callsArgWith(1, null, false))
      })

      it('should call pass allow=false', function(done) {
        return this.LoginRateLimiter.processLoginRequest(
          this.email,
          (err, allow) => {
            expect(err).to.equal(null)
            expect(allow).to.equal(false)
            return done()
          }
        )
      })
    })

    describe('when addCount produces an error', function() {
      beforeEach(function() {
        return (this.RateLimiter.addCount = sinon
          .stub()
          .callsArgWith(1, new Error('woops')))
      })

      it('should produce an error', function(done) {
        return this.LoginRateLimiter.processLoginRequest(
          this.email,
          (err, allow) => {
            expect(err).to.not.equal(null)
            expect(err).to.be.instanceof(Error)
            return done()
          }
        )
      })
    })
  })

  describe('recordSuccessfulLogin', function() {
    beforeEach(function() {
      return (this.RateLimiter.clearRateLimit = sinon
        .stub()
        .callsArgWith(2, null))
    })

    it('should call clearRateLimit', function(done) {
      return this.LoginRateLimiter.recordSuccessfulLogin(this.email, () => {
        this.RateLimiter.clearRateLimit.callCount.should.equal(1)
        this.RateLimiter.clearRateLimit
          .calledWith('login', this.email)
          .should.equal(true)
        return done()
      })
    })
  })
})
