/* eslint-disable
    max-len,
    no-return-assign,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const SandboxedModule = require('sandboxed-module')
const sinon = require('sinon')
require('chai').should()
const modulePath = require('path').join(
  __dirname,
  '../../../../app/src/Features/Security/RateLimiterMiddleware'
)

describe('RateLimiterMiddleware', function() {
  beforeEach(function() {
    this.AuthenticationController = {
      getLoggedInUserId: () => {
        return __guard__(
          __guard__(
            this.req != null ? this.req.session : undefined,
            x1 => x1.user
          ),
          x => x._id
        )
      }
    }
    this.RateLimiterMiddleware = SandboxedModule.require(modulePath, {
      globals: {
        console: console
      },
      requires: {
        '../../infrastructure/RateLimiter': (this.RateLimiter = {}),
        'logger-sharelatex': (this.logger = { warn: sinon.stub() }),
        '../Authentication/AuthenticationController': this
          .AuthenticationController
      }
    })
    this.req = { params: {} }
    this.res = {
      status: sinon.stub(),
      write: sinon.stub(),
      end: sinon.stub()
    }
    return (this.next = sinon.stub())
  })

  describe('rateLimit', function() {
    beforeEach(function() {
      this.rateLimiter = this.RateLimiterMiddleware.rateLimit({
        endpointName: 'test-endpoint',
        params: ['project_id', 'doc_id'],
        timeInterval: 42,
        maxRequests: 12
      })
      return (this.req.params = {
        project_id: (this.project_id = 'project-id'),
        doc_id: (this.doc_id = 'doc-id')
      })
    })

    describe('when there is no session', function() {
      beforeEach(function() {
        this.RateLimiter.addCount = sinon.stub().callsArgWith(1, null, true)
        this.req.ip = this.ip = '1.2.3.4'
        return this.rateLimiter(this.req, this.res, this.next)
      })

      it('should call the rate limiter backend with the ip address', function() {
        return this.RateLimiter.addCount
          .calledWith({
            endpointName: 'test-endpoint',
            timeInterval: 42,
            throttle: 12,
            subjectName: `${this.project_id}:${this.doc_id}:${this.ip}`
          })
          .should.equal(true)
      })

      it('should pass on to next()', function() {})
    })

    describe('when under the rate limit with logged in user', function() {
      beforeEach(function() {
        this.req.session = {
          user: {
            _id: (this.user_id = 'user-id')
          }
        }
        this.RateLimiter.addCount = sinon.stub().callsArgWith(1, null, true)
        return this.rateLimiter(this.req, this.res, this.next)
      })

      it('should call the rate limiter backend with the user_id', function() {
        return this.RateLimiter.addCount
          .calledWith({
            endpointName: 'test-endpoint',
            timeInterval: 42,
            throttle: 12,
            subjectName: `${this.project_id}:${this.doc_id}:${this.user_id}`
          })
          .should.equal(true)
      })

      it('should pass on to next()', function() {
        return this.next.called.should.equal(true)
      })
    })

    describe('when under the rate limit with anonymous user', function() {
      beforeEach(function() {
        this.req.ip = this.ip = '1.2.3.4'
        this.RateLimiter.addCount = sinon.stub().callsArgWith(1, null, true)
        return this.rateLimiter(this.req, this.res, this.next)
      })

      it('should call the rate limiter backend with the ip address', function() {
        return this.RateLimiter.addCount
          .calledWith({
            endpointName: 'test-endpoint',
            timeInterval: 42,
            throttle: 12,
            subjectName: `${this.project_id}:${this.doc_id}:${this.ip}`
          })
          .should.equal(true)
      })

      it('should pass on to next()', function() {
        return this.next.called.should.equal(true)
      })
    })

    describe('when over the rate limit', function() {
      beforeEach(function() {
        this.req.session = {
          user: {
            _id: (this.user_id = 'user-id')
          }
        }
        this.RateLimiter.addCount = sinon.stub().callsArgWith(1, null, false)
        return this.rateLimiter(this.req, this.res, this.next)
      })

      it('should return a 429', function() {
        this.res.status.calledWith(429).should.equal(true)
        return this.res.end.called.should.equal(true)
      })

      it('should not continue', function() {
        return this.next.called.should.equal(false)
      })

      it('should log a warning', function() {
        return this.logger.warn
          .calledWith(
            {
              endpointName: 'test-endpoint',
              timeInterval: 42,
              throttle: 12,
              subjectName: `${this.project_id}:${this.doc_id}:${this.user_id}`
            },
            'rate limit exceeded'
          )
          .should.equal(true)
      })
    })
  })
})

function __guard__(value, transform) {
  return typeof value !== 'undefined' && value !== null
    ? transform(value)
    : undefined
}
