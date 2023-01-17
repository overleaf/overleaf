const SandboxedModule = require('sandboxed-module')
const sinon = require('sinon')
const modulePath = require('path').join(
  __dirname,
  '../../../../app/src/Features/Security/RateLimiterMiddleware'
)

describe('RateLimiterMiddleware', function () {
  beforeEach(function () {
    this.SessionManager = {
      getLoggedInUserId: () => this.req.session?.user?._id,
    }
    this.RateLimiter = {
      addCount: sinon.stub().yields(null, true),
    }
    this.RateLimiterMiddleware = SandboxedModule.require(modulePath, {
      requires: {
        '@overleaf/settings': (this.settings = {}),
        '../../infrastructure/RateLimiter': this.RateLimiter,
        './LoginRateLimiter': {},
        '../Authentication/SessionManager': this.SessionManager,
      },
    })
    this.req = { params: {} }
    this.res = {
      status: sinon.stub(),
      write: sinon.stub(),
      end: sinon.stub(),
    }
    this.next = sinon.stub()
  })

  describe('rateLimit', function () {
    beforeEach(function () {
      this.middleware = this.RateLimiterMiddleware.rateLimit({
        endpointName: 'test-endpoint',
        params: ['project_id', 'doc_id'],
        timeInterval: 42,
        maxRequests: 12,
      })
      this.req.params = {
        project_id: (this.project_id = 'project-id'),
        doc_id: (this.doc_id = 'doc-id'),
      }
    })

    describe('when there is no session', function () {
      beforeEach(function () {
        this.req.ip = this.ip = '1.2.3.4'
        this.middleware(this.req, this.res, this.next)
      })

      it('should call the rate limiter backend with the ip address', function () {
        this.RateLimiter.addCount
          .calledWith({
            endpointName: 'test-endpoint',
            timeInterval: 42,
            throttle: 12,
            subjectName: `${this.project_id}:${this.doc_id}:${this.ip}`,
          })
          .should.equal(true)
      })

      it('should pass on to next()', function () {})
    })

    describe('when smoke test user', function () {
      beforeEach(function () {
        this.req.session = {
          user: {
            _id: (this.user_id = 'smoke-test-user-id'),
          },
        }
        this.settings.smokeTest = { userId: this.user_id }
        this.middleware(this.req, this.res, this.next)
      })

      it('should not call the rate limiter backend with the user_id', function () {
        this.RateLimiter.addCount
          .calledWith({
            endpointName: 'test-endpoint',
            timeInterval: 42,
            throttle: 12,
            subjectName: `${this.project_id}:${this.doc_id}:${this.user_id}`,
          })
          .should.equal(false)
        this.RateLimiter.addCount.callCount.should.equal(0)
      })

      it('should pass on to next()', function () {
        this.next.called.should.equal(true)
      })
    })

    describe('when under the rate limit with logged in user', function () {
      beforeEach(function () {
        this.req.session = {
          user: {
            _id: (this.user_id = 'user-id'),
          },
        }
        this.middleware(this.req, this.res, this.next)
      })

      it('should call the rate limiter backend with the user_id', function () {
        this.RateLimiter.addCount
          .calledWith({
            endpointName: 'test-endpoint',
            timeInterval: 42,
            throttle: 12,
            subjectName: `${this.project_id}:${this.doc_id}:${this.user_id}`,
          })
          .should.equal(true)
      })

      it('should pass on to next()', function () {
        this.next.called.should.equal(true)
      })
    })

    describe('when under the rate limit with anonymous user', function () {
      beforeEach(function () {
        this.req.ip = this.ip = '1.2.3.4'
        this.middleware(this.req, this.res, this.next)
      })

      it('should call the rate limiter backend with the ip address', function () {
        this.RateLimiter.addCount
          .calledWith({
            endpointName: 'test-endpoint',
            timeInterval: 42,
            throttle: 12,
            subjectName: `${this.project_id}:${this.doc_id}:${this.ip}`,
          })
          .should.equal(true)
      })

      it('should pass on to next()', function () {
        this.next.called.should.equal(true)
      })
    })

    describe('when over the rate limit', function () {
      beforeEach(function () {
        this.req.session = {
          user: {
            _id: (this.user_id = 'user-id'),
          },
        }
        this.RateLimiter.addCount.yields(null, false)
        this.middleware(this.req, this.res, this.next)
      })

      it('should return a 429', function () {
        this.res.status.calledWith(429).should.equal(true)
        this.res.end.called.should.equal(true)
      })

      it('should not continue', function () {
        this.next.called.should.equal(false)
      })

      it('should log a warning', function () {
        this.logger.warn
          .calledWith(
            {
              endpointName: 'test-endpoint',
              timeInterval: 42,
              throttle: 12,
              subjectName: `${this.project_id}:${this.doc_id}:${this.user_id}`,
            },
            'rate limit exceeded'
          )
          .should.equal(true)
      })
    })
  })

  describe('rateLimitV2', function () {
    beforeEach(function () {
      this.projectId = 'project-id'
      this.docId = 'doc-id'
      this.rateLimiter = {
        consume: sinon.stub().resolves({ remainingPoints: 2 }),
      }
      this.middleware = this.RateLimiterMiddleware.rateLimitV2(
        this.rateLimiter,
        { params: ['projectId', 'docId'] }
      )
      this.req.params = { projectId: this.projectId, docId: this.docId }
    })

    describe('when there is no session', function () {
      beforeEach(function (done) {
        this.req.ip = this.ip = '1.2.3.4'
        this.middleware(this.req, this.res, () => {
          done()
        })
      })

      it('should call the rate limiter with the ip address', function () {
        this.rateLimiter.consume.should.have.been.calledWith(
          `${this.projectId}:${this.docId}:${this.ip}`
        )
      })
    })

    describe('when smoke test user', function () {
      beforeEach(function (done) {
        this.userId = 'smoke-test-user-id'
        this.req.session = {
          user: { _id: this.userId },
        }
        this.settings.smokeTest = { userId: this.userId }
        this.middleware(this.req, this.res, () => {
          done()
        })
      })

      it('should not call the rate limiter', function () {
        this.rateLimiter.consume.should.not.have.been.called
      })
    })

    describe('when under the rate limit with logged in user', function () {
      beforeEach(function (done) {
        this.userId = 'user-id'
        this.req.session = {
          user: { _id: this.userId },
        }
        this.middleware(this.req, this.res, () => {
          done()
        })
      })

      it('should call the rate limiter backend with the userId', function () {
        this.rateLimiter.consume.should.have.been.calledWith(
          `${this.projectId}:${this.docId}:${this.userId}`
        )
      })
    })

    describe('when under the rate limit with anonymous user', function () {
      beforeEach(function (done) {
        this.req.ip = '1.2.3.4'
        this.middleware(this.req, this.res, () => {
          done()
        })
      })

      it('should call the rate limiter backend with the ip address', function () {
        this.rateLimiter.consume.should.have.been.calledWith(
          `${this.projectId}:${this.docId}:${this.req.ip}`
        )
      })
    })

    describe('when over the rate limit', function () {
      beforeEach(function (done) {
        this.userId = 'user-id'
        this.req.session = {
          user: { _id: this.userId },
        }
        this.res.end.callsFake(() => {
          done()
        })
        this.rateLimiter.consume.rejects({ remainingPoints: 0 })
        this.middleware(this.req, this.res, this.next)
      })

      it('should return a 429', function () {
        this.res.status.should.have.been.calledWith(429)
      })

      it('should not continue', function () {
        this.next.should.not.have.been.called
      })
    })
  })
})
