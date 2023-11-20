const SandboxedModule = require('sandboxed-module')
const sinon = require('sinon')
const modulePath =
  '../../../../app/src/Features/Subscription/TeamInvitesController'

describe('TeamInvitesController', function () {
  beforeEach(function () {
    this.user = { _id: '!@312431', email: 'user@email.com' }
    this.adminUserId = '123jlkj'
    this.subscriptionId = '123434325412'
    this.user_email = 'bob@gmail.com'
    this.req = {
      session: {
        user: {
          _id: this.adminUserId,
          email: this.user_email,
        },
      },
      params: {},
      query: {},
      ip: '0.0.0.0',
    }

    this.subscription = {
      _id: this.subscriptionId,
    }

    this.TeamInvitesHandler = {
      promises: { acceptInvite: sinon.stub().resolves(this.subscription) },
    }

    this.SubscriptionLocator = {
      promises: {
        hasSSOEnabled: sinon.stub().resolves(true),
      },
    }
    this.ErrorController = { notFound: sinon.stub() }

    this.SessionManager = {
      getLoggedInUserId(session) {
        return session.user._id
      },
      getSessionUser(session) {
        return session.user
      },
    }

    this.UserAuditLogHandler = {
      promises: {
        addEntry: sinon.stub().resolves(),
      },
    }
    this.UserGetter = {
      promises: {
        getUser: sinon.stub().resolves(this.user),
        getUserByMainEmail: sinon.stub().resolves(this.user),
        getUserByAnyEmail: sinon.stub().resolves(this.user),
      },
    }
    this.EmailHandler = {
      sendDeferredEmail: sinon.stub().resolves(),
    }

    this.RateLimiter = {
      RateLimiter: class {},
    }

    this.Controller = SandboxedModule.require(modulePath, {
      requires: {
        './TeamInvitesHandler': this.TeamInvitesHandler,
        '../Authentication/SessionManager': this.SessionManager,
        './SubscriptionLocator': this.SubscriptionLocator,
        '../User/UserAuditLogHandler': this.UserAuditLogHandler,
        '../Errors/ErrorController': this.ErrorController,
        '../User/UserGetter': this.UserGetter,
        '../Email/EmailHandler': this.EmailHandler,
        '../../infrastructure/RateLimiter': this.RateLimiter,
      },
    })
  })

  describe('acceptInvite', function () {
    it('should add an audit log entry', function (done) {
      this.req.params.token = 'foo'
      this.req.session.user = this.user
      const res = {
        json: () => {
          sinon.assert.calledWith(
            this.UserAuditLogHandler.promises.addEntry,
            this.user._id,
            'accept-group-invitation',
            this.user._id,
            this.req.ip,
            { subscriptionId: this.subscriptionId }
          )
          done()
        },
      }
      this.Controller.acceptInvite(this.req, res)
    })
  })
})
