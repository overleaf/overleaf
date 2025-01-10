import esmock from 'esmock'
import sinon from 'sinon'
import { expect } from 'chai'
const modulePath =
  '../../../../app/src/Features/Subscription/TeamInvitesController'

describe('TeamInvitesController', function () {
  beforeEach(async function () {
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
      promises: {
        acceptInvite: sinon.stub().resolves(this.subscription),
        getInvite: sinon.stub().resolves({
          invite: {
            email: this.user.email,
            token: 'token123',
            inviterName: this.user_email,
          },
          subscription: this.subscription,
        }),
      },
    }

    this.SubscriptionLocator = {
      promises: {
        hasSSOEnabled: sinon.stub().resolves(true),
        getUsersSubscription: sinon.stub().resolves(),
      },
    }
    this.ErrorController = { notFound: sinon.stub() }

    this.SessionManager = {
      getLoggedInUserId(session) {
        return session.user?._id
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

    this.Controller = await esmock.strict(modulePath, {
      '../../../../app/src/Features/Subscription/TeamInvitesHandler':
        this.TeamInvitesHandler,
      '../../../../app/src/Features/Authentication/SessionManager':
        this.SessionManager,
      '../../../../app/src/Features/Subscription/SubscriptionLocator':
        this.SubscriptionLocator,
      '../../../../app/src/Features/User/UserAuditLogHandler':
        this.UserAuditLogHandler,
      '../../../../app/src/Features/Errors/ErrorController':
        this.ErrorController,
      '../../../../app/src/Features/User/UserGetter': this.UserGetter,
      '../../../../app/src/Features/Email/EmailHandler': this.EmailHandler,
      '../../../../app/src/infrastructure/RateLimiter': this.RateLimiter,
      '../../../../app/src/infrastructure/Modules': (this.Modules = {
        promises: {
          hooks: {
            fire: sinon.stub().resolves([]),
          },
        },
      }),
      '../../../../app/src/Features/SplitTests/SplitTestHandler':
        (this.SplitTestHandler = {
          promises: {
            getAssignment: sinon.stub().resolves({}),
          },
        }),
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

  describe('viewInvite', function () {
    const req = {
      params: { token: 'token123' },
      query: {},
      session: {
        user: { _id: 'user123' },
      },
    }

    describe('hasIndividualRecurlySubscription', function () {
      it('is true for personal subscription', function (done) {
        this.SubscriptionLocator.promises.getUsersSubscription.resolves({
          recurlySubscription_id: 'subscription123',
          groupPlan: false,
        })
        const res = {
          render: (template, data) => {
            expect(data.hasIndividualRecurlySubscription).to.be.true
            done()
          },
        }
        this.Controller.viewInvite(req, res)
      })

      it('is true for group subscriptions', function (done) {
        this.SubscriptionLocator.promises.getUsersSubscription.resolves({
          recurlySubscription_id: 'subscription123',
          groupPlan: true,
        })
        const res = {
          render: (template, data) => {
            expect(data.hasIndividualRecurlySubscription).to.be.false
            done()
          },
        }
        this.Controller.viewInvite(req, res)
      })

      it('is false for canceled subscriptions', function (done) {
        this.SubscriptionLocator.promises.getUsersSubscription.resolves({
          recurlySubscription_id: 'subscription123',
          groupPlan: false,
          recurlyStatus: {
            state: 'canceled',
          },
        })
        const res = {
          render: (template, data) => {
            expect(data.hasIndividualRecurlySubscription).to.be.false
            done()
          },
        }
        this.Controller.viewInvite(req, res)
      })
    })

    describe('when user is logged out', function () {
      it('renders logged out invite page', function (done) {
        const res = {
          render: (template, data) => {
            expect(template).to.equal('subscriptions/team/invite_logged_out')
            expect(data.groupSSOActive).to.be.undefined
            done()
          },
        }
        this.Controller.viewInvite(
          { params: { token: 'token123' }, session: {} },
          res
        )
      })

      it('includes groupSSOActive flag when the group has SSO enabled', function (done) {
        this.Modules.promises.hooks.fire = sinon.stub().resolves([true])
        const res = {
          render: (template, data) => {
            expect(data.groupSSOActive).to.be.true
            done()
          },
        }
        this.Controller.viewInvite(
          { params: { token: 'token123' }, session: {} },
          res
        )
      })
    })

    it('renders the view', function (done) {
      const res = {
        render: template => {
          expect(template).to.equal('subscriptions/team/invite')
          done()
        },
      }
      this.Controller.viewInvite(req, res)
    })
  })
})
