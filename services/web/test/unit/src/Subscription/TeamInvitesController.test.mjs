import { expect, vi } from 'vitest'
import sinon from 'sinon'
import MockResponse from '../helpers/MockResponse.mjs'

const modulePath =
  '../../../../app/src/Features/Subscription/TeamInvitesController'

describe('TeamInvitesController', function () {
  beforeEach(async function (ctx) {
    ctx.user = { _id: '!@312431', email: 'user@email.com' }
    ctx.adminUserId = '123jlkj'
    ctx.subscriptionId = '123434325412'
    ctx.user_email = 'bob@gmail.com'
    ctx.req = {
      session: {
        user: {
          _id: ctx.adminUserId,
          email: ctx.user_email,
        },
      },
      params: {},
      query: {},
      ip: '0.0.0.0',
    }

    ctx.subscription = {
      _id: ctx.subscriptionId,
    }

    ctx.TeamInvitesHandler = {
      promises: {
        acceptInvite: sinon.stub().resolves(ctx.subscription),
        getInvite: sinon.stub().resolves({
          invite: {
            email: ctx.user.email,
            token: 'token123',
            inviterName: ctx.user_email,
          },
          subscription: ctx.subscription,
        }),
      },
    }

    ctx.SubscriptionLocator = {
      promises: {
        hasSSOEnabled: sinon.stub().resolves(true),
        getUsersSubscription: sinon.stub().resolves(),
      },
    }
    ctx.ErrorController = { notFound: sinon.stub() }

    ctx.SessionManager = {
      getLoggedInUserId(session) {
        return session.user?._id
      },
      getSessionUser(session) {
        return session.user
      },
    }

    ctx.UserAuditLogHandler = {
      promises: {
        addEntry: sinon.stub().resolves(),
      },
    }
    ctx.UserGetter = {
      promises: {
        getUser: sinon.stub().resolves(ctx.user),
        getUserByMainEmail: sinon.stub().resolves(ctx.user),
        getUserByAnyEmail: sinon.stub().resolves(ctx.user),
      },
    }
    ctx.EmailHandler = {
      sendDeferredEmail: sinon.stub().resolves(),
    }

    ctx.RateLimiter = {
      RateLimiter: class {
        consume = sinon.stub().resolves()
      },
    }

    vi.doMock(
      '../../../../app/src/Features/Subscription/TeamInvitesHandler',
      () => ({
        default: ctx.TeamInvitesHandler,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Authentication/SessionManager',
      () => ({
        default: ctx.SessionManager,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Subscription/SubscriptionLocator',
      () => ({
        default: ctx.SubscriptionLocator,
      })
    )

    vi.doMock('../../../../app/src/Features/User/UserAuditLogHandler', () => ({
      default: ctx.UserAuditLogHandler,
    }))

    vi.doMock('../../../../app/src/Features/Errors/ErrorController', () => ({
      default: ctx.ErrorController,
    }))

    vi.doMock('../../../../app/src/Features/User/UserGetter', () => ({
      default: ctx.UserGetter,
    }))

    vi.doMock('../../../../app/src/Features/Email/EmailHandler', () => ({
      default: ctx.EmailHandler,
    }))

    vi.doMock(
      '../../../../app/src/infrastructure/RateLimiter',
      () => ctx.RateLimiter
    )

    vi.doMock('../../../../app/src/infrastructure/Modules', () => ({
      default: (ctx.Modules = {
        promises: {
          hooks: {
            fire: sinon.stub().resolves([]),
          },
        },
      }),
    }))

    vi.doMock(
      '../../../../app/src/Features/SplitTests/SplitTestHandler',
      () => ({
        default: (ctx.SplitTestHandler = {
          promises: {
            getAssignment: sinon.stub().resolves({}),
          },
        }),
      })
    )

    ctx.Controller = (await import(modulePath)).default
  })

  describe('acceptInvite', function () {
    it('should add an audit log entry', async function (ctx) {
      await new Promise(resolve => {
        ctx.req.params.token = 'foo'
        ctx.req.session.user = ctx.user
        const res = {
          json: () => {
            sinon.assert.calledWith(
              ctx.UserAuditLogHandler.promises.addEntry,
              ctx.user._id,
              'accept-group-invitation',
              ctx.user._id,
              ctx.req.ip,
              { subscriptionId: ctx.subscriptionId }
            )
            resolve()
          },
        }
        ctx.Controller.acceptInvite(ctx.req, res)
      })
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

    describe('hasIndividualPaidSubscription', function () {
      it('is true for personal subscription', async function (ctx) {
        await new Promise(resolve => {
          ctx.SubscriptionLocator.promises.getUsersSubscription.resolves({
            recurlySubscription_id: 'subscription123',
            groupPlan: false,
          })
          const res = {
            render: (template, data) => {
              expect(data.hasIndividualPaidSubscription).to.be.true
              resolve()
            },
          }
          ctx.Controller.viewInvite(req, res)
        })
      })

      it('is true for group subscriptions', async function (ctx) {
        await new Promise(resolve => {
          ctx.SubscriptionLocator.promises.getUsersSubscription.resolves({
            recurlySubscription_id: 'subscription123',
            groupPlan: true,
          })
          const res = {
            render: (template, data) => {
              expect(data.hasIndividualPaidSubscription).to.be.false
              resolve()
            },
          }
          ctx.Controller.viewInvite(req, res)
        })
      })

      it('is false for canceled subscriptions', async function (ctx) {
        await new Promise(resolve => {
          ctx.SubscriptionLocator.promises.getUsersSubscription.resolves({
            recurlySubscription_id: 'subscription123',
            groupPlan: false,
            recurlyStatus: {
              state: 'canceled',
            },
          })
          const res = {
            render: (template, data) => {
              expect(data.hasIndividualPaidSubscription).to.be.false
              resolve()
            },
          }
          ctx.Controller.viewInvite(req, res)
        })
      })
    })

    describe('when user is logged out', function () {
      it('renders logged out invite page', async function (ctx) {
        await new Promise(resolve => {
          const res = {
            render: (template, data) => {
              expect(template).to.equal('subscriptions/team/invite_logged_out')
              expect(data.groupSSOActive).to.be.undefined
              resolve()
            },
          }
          ctx.Controller.viewInvite(
            { params: { token: 'token123' }, session: {} },
            res
          )
        })
      })

      it('includes groupSSOActive flag when the group has SSO enabled', async function (ctx) {
        await new Promise(resolve => {
          ctx.Modules.promises.hooks.fire = sinon.stub().resolves([true])
          const res = {
            render: (template, data) => {
              expect(data.groupSSOActive).to.be.true
              resolve()
            },
          }
          ctx.Controller.viewInvite(
            { params: { token: 'token123' }, session: {} },
            res
          )
        })
      })
    })

    it('renders the view', async function (ctx) {
      await new Promise(resolve => {
        const res = {
          render: template => {
            expect(template).to.equal('subscriptions/team/invite')
            resolve()
          },
        }
        ctx.Controller.viewInvite(req, res)
      })
    })
  })

  describe('resendInvite', function () {
    const email = 'user@example.com'
    const initPath = '/saml/ukamf/init?group_id=12345'
    beforeEach(function (ctx) {
      ctx.subscription = { teamInvites: [{ email }], populate: sinon.stub() }
      ctx.req = {
        entity: ctx.subscription,
        body: {
          email,
        },
      }
      ctx.res = new MockResponse(vi)
      ctx.next = sinon.stub()
    })

    it('sends the invite email again', async function (ctx) {
      await new Promise(resolve => {
        const res = new MockResponse(vi)
        res.callback = () => {
          res.statusCode.should.equal(200)
          resolve()
        }

        ctx.Controller.resendInvite(ctx.req, res, ctx.next)
      })
    })

    describe('when domain capture is enabled', function () {
      beforeEach(function (ctx) {
        ctx.req.entity.domainCaptureEnabled = true

        ctx.Modules.promises.hooks.fire.resolves([initPath])
      })

      it('sends the invite again', async function (ctx) {
        await new Promise(resolve => {
          const res = new MockResponse(vi)
          res.callback = () => {
            sinon.assert.calledWith(
              ctx.Modules.promises.hooks.fire,
              'getGroupSSOInitPath',
              ctx.subscription,
              email
            )
            res.statusCode.should.equal(200)
            resolve()
          }

          ctx.Controller.resendInvite(ctx.req, res, ctx.next)
        })
      })
    })
  })
})
