import { beforeEach, describe, it, vi } from 'vitest'
import sinon from 'sinon'

const modulePath =
  '../../../../app/src/Features/Subscription/SubscriptionGroupController'

describe('SubscriptionGroupController', function () {
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
      params: {
        subscriptionId: ctx.subscriptionId,
      },
      query: {},
    }

    ctx.subscription = {
      _id: ctx.subscriptionId,
      teamName: 'Cool group',
      groupPlan: true,
      membersLimit: 5,
    }

    ctx.plan = {
      canUseFlexibleLicensing: true,
    }

    ctx.recurlySubscription = {
      get isCollectionMethodManual() {
        return true
      },
    }

    ctx.previewSubscriptionChangeData = {
      change: {},
      currency: 'USD',
    }

    ctx.createSubscriptionChangeData = { adding: 1 }

    ctx.paymentMethod = { cardType: 'Visa', lastFour: '1111' }

    ctx.SubscriptionGroupHandler = {
      promises: {
        removeUserFromGroup: sinon.stub().resolves(),
        getUsersGroupSubscriptionDetails: sinon.stub().resolves({
          subscription: ctx.subscription,
          plan: ctx.plan,
          paymentProviderSubscription: ctx.recurlySubscription,
        }),
        previewAddSeatsSubscriptionChange: sinon
          .stub()
          .resolves(ctx.previewSubscriptionChangeData),
        createAddSeatsSubscriptionChange: sinon
          .stub()
          .resolves(ctx.createSubscriptionChangeData),
        ensureFlexibleLicensingEnabled: sinon.stub().resolves(),
        ensureSubscriptionIsActive: sinon.stub().resolves(),
        ensureSubscriptionCollectionMethodIsNotManual: sinon.stub().resolves(),
        ensureSubscriptionHasNoPendingChanges: sinon.stub().resolves(),
        ensureSubscriptionHasNoPastDueInvoice: sinon.stub().resolves(),
        getGroupPlanUpgradePreview: sinon
          .stub()
          .resolves(ctx.previewSubscriptionChangeData),
        checkBillingInfoExistence: sinon.stub().resolves(ctx.paymentMethod),
        updateSubscriptionPaymentTerms: sinon.stub().resolves(),
        ensureSubscriptionHasAdditionalLicenseAddOnWhenCollectionMethodIsManual:
          sinon.stub().resolves(),
      },
    }

    ctx.SubscriptionLocator = {
      promises: {
        getSubscription: sinon.stub().resolves(ctx.subscription),
      },
    }

    ctx.SessionManager = {
      getLoggedInUserId(session) {
        return session.user._id
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

    ctx.Modules = {
      promises: {
        hooks: {
          fire: sinon.stub().resolves(),
        },
      },
    }

    ctx.UserGetter = {
      promises: {
        getUserEmail: sinon.stub().resolves(ctx.user.email),
      },
    }

    ctx.paymentMethod = { cardType: 'Visa', lastFour: '1111' }

    ctx.RecurlyClient = {
      promises: {
        getPaymentMethod: sinon.stub().resolves(ctx.paymentMethod),
      },
    }

    ctx.SubscriptionController = {}

    ctx.SubscriptionModel = { Subscription: {} }

    ctx.PlansHelper = {
      isProfessionalGroupPlan: sinon.stub().returns(false),
    }

    ctx.Errors = {
      MissingBillingInfoError: class extends Error {},
      ManuallyCollectedError: class extends Error {},
      PendingChangeError: class extends Error {},
      InactiveError: class extends Error {},
      SubtotalLimitExceededError: class extends Error {},
      HasPastDueInvoiceError: class extends Error {},
      HasNoAdditionalLicenseWhenManuallyCollectedError: class extends Error {},
      PaymentActionRequiredError: class extends Error {
        constructor(info) {
          super('Payment action required')
          this.info = info
        }
      },
    }

    vi.doMock(
      '../../../../app/src/Features/Subscription/SubscriptionGroupHandler',
      () => ({
        default: ctx.SubscriptionGroupHandler,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Subscription/SubscriptionLocator',
      () => ({
        default: ctx.SubscriptionLocator,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Authentication/SessionManager',
      () => ({
        default: ctx.SessionManager,
      })
    )

    vi.doMock('../../../../app/src/Features/User/UserAuditLogHandler', () => ({
      default: ctx.UserAuditLogHandler,
    }))

    vi.doMock('../../../../app/src/infrastructure/Modules', () => ({
      default: ctx.Modules,
    }))

    vi.doMock('../../../../app/src/Features/User/UserGetter', () => ({
      default: ctx.UserGetter,
    }))

    vi.doMock('../../../../app/src/Features/Errors/ErrorController', () => ({
      default: (ctx.ErrorController = {
        notFound: sinon.stub(),
      }),
    }))

    vi.doMock(
      '../../../../app/src/Features/Subscription/SubscriptionController',
      () => ({
        default: ctx.SubscriptionController,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Subscription/RecurlyClient',
      () => ({
        default: ctx.RecurlyClient,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Subscription/PlansHelper',
      () => ctx.PlansHelper
    )

    vi.doMock(
      '../../../../app/src/Features/Subscription/Errors',
      () => ctx.Errors
    )

    vi.doMock(
      '../../../../app/src/models/Subscription',
      () => ctx.SubscriptionModel
    )

    vi.doMock('@overleaf/logger', () => ({
      default: {
        err: sinon.stub(),
        error: sinon.stub(),
        warn: sinon.stub(),
        log: sinon.stub(),
        debug: sinon.stub(),
      },
    }))

    ctx.Controller = (await import(modulePath)).default
  })

  describe('removeUserFromGroup', function () {
    it('should use the subscription id for the logged in user and take the user id from the params', async function (ctx) {
      await new Promise(resolve => {
        const userIdToRemove = '31231'
        ctx.req.params = { user_id: userIdToRemove }
        ctx.req.entity = ctx.subscription

        const res = {
          sendStatus: () => {
            ctx.SubscriptionGroupHandler.promises.removeUserFromGroup
              .calledWith(ctx.subscriptionId, userIdToRemove, {
                initiatorId: ctx.req.session.user._id,
                ipAddress: ctx.req.ip,
              })
              .should.equal(true)
            resolve()
          },
        }
        ctx.Controller.removeUserFromGroup(ctx.req, res, resolve)
      })
    })

    it('should log that the user has been removed', async function (ctx) {
      await new Promise(resolve => {
        const userIdToRemove = '31231'
        ctx.req.params = { user_id: userIdToRemove }
        ctx.req.entity = ctx.subscription

        const res = {
          sendStatus: () => {
            sinon.assert.calledWith(
              ctx.UserAuditLogHandler.promises.addEntry,
              userIdToRemove,
              'remove-from-group-subscription',
              ctx.adminUserId,
              ctx.req.ip,
              { subscriptionId: ctx.subscriptionId }
            )
            resolve()
          },
        }
        ctx.Controller.removeUserFromGroup(ctx.req, res, resolve)
      })
    })

    it('should call the group SSO hooks with group SSO enabled', async function (ctx) {
      await new Promise(resolve => {
        const userIdToRemove = '31231'
        ctx.req.params = { user_id: userIdToRemove }
        ctx.req.entity = ctx.subscription
        ctx.Modules.promises.hooks.fire
          .withArgs('hasGroupSSOEnabled', ctx.subscription)
          .resolves([true])

        const res = {
          sendStatus: () => {
            ctx.Modules.promises.hooks.fire
              .calledWith('hasGroupSSOEnabled', ctx.subscription)
              .should.equal(true)
            ctx.Modules.promises.hooks.fire
              .calledWith(
                'unlinkUserFromGroupSSO',
                userIdToRemove,
                ctx.subscriptionId
              )
              .should.equal(true)
            sinon.assert.calledTwice(ctx.Modules.promises.hooks.fire)
            resolve()
          },
        }
        ctx.Controller.removeUserFromGroup(ctx.req, res, resolve)
      })
    })

    it('should call the group SSO hooks with group SSO disabled', async function (ctx) {
      await new Promise(resolve => {
        const userIdToRemove = '31231'
        ctx.req.params = { user_id: userIdToRemove }
        ctx.req.entity = ctx.subscription
        ctx.Modules.promises.hooks.fire
          .withArgs('hasGroupSSOEnabled', ctx.subscription)
          .resolves([false])

        const res = {
          sendStatus: () => {
            ctx.Modules.promises.hooks.fire
              .calledWith('hasGroupSSOEnabled', ctx.subscription)
              .should.equal(true)
            sinon.assert.calledOnce(ctx.Modules.promises.hooks.fire)
            resolve()
          },
        }
        ctx.Controller.removeUserFromGroup(ctx.req, res, resolve)
      })
    })
  })

  describe('removeSelfFromGroup', function () {
    it('gets subscription and remove user', async function (ctx) {
      await new Promise(resolve => {
        ctx.req.query = { subscriptionId: ctx.subscriptionId }
        const memberUserIdToremove = 123456789
        ctx.req.session.user._id = memberUserIdToremove

        const res = {
          sendStatus: () => {
            sinon.assert.calledWith(
              ctx.SubscriptionLocator.promises.getSubscription,
              ctx.subscriptionId
            )
            sinon.assert.calledWith(
              ctx.SubscriptionGroupHandler.promises.removeUserFromGroup,
              ctx.subscriptionId,
              memberUserIdToremove,
              {
                initiatorId: ctx.req.session.user._id,
                ipAddress: ctx.req.ip,
              }
            )
            resolve()
          },
        }
        ctx.Controller.removeSelfFromGroup(ctx.req, res, resolve)
      })
    })

    it('should log that the user has left the subscription', async function (ctx) {
      await new Promise(resolve => {
        ctx.req.query = { subscriptionId: ctx.subscriptionId }
        const memberUserIdToremove = '123456789'
        ctx.req.session.user._id = memberUserIdToremove

        const res = {
          sendStatus: () => {
            sinon.assert.calledWith(
              ctx.UserAuditLogHandler.promises.addEntry,
              memberUserIdToremove,
              'remove-from-group-subscription',
              memberUserIdToremove,
              ctx.req.ip,
              { subscriptionId: ctx.subscriptionId }
            )
            resolve()
          },
        }
        ctx.Controller.removeSelfFromGroup(ctx.req, res, resolve)
      })
    })

    it('should call the group SSO hooks with group SSO enabled', async function (ctx) {
      await new Promise(resolve => {
        ctx.req.query = { subscriptionId: ctx.subscriptionId }
        const memberUserIdToremove = '123456789'
        ctx.req.session.user._id = memberUserIdToremove

        ctx.Modules.promises.hooks.fire
          .withArgs('hasGroupSSOEnabled', ctx.subscription)
          .resolves([true])

        const res = {
          sendStatus: () => {
            ctx.Modules.promises.hooks.fire
              .calledWith('hasGroupSSOEnabled', ctx.subscription)
              .should.equal(true)
            ctx.Modules.promises.hooks.fire
              .calledWith(
                'unlinkUserFromGroupSSO',
                memberUserIdToremove,
                ctx.subscriptionId
              )
              .should.equal(true)
            sinon.assert.calledTwice(ctx.Modules.promises.hooks.fire)
            resolve()
          },
        }
        ctx.Controller.removeSelfFromGroup(ctx.req, res, resolve)
      })
    })

    it('should call the group SSO hooks with group SSO disabled', async function (ctx) {
      await new Promise(resolve => {
        const userIdToRemove = '31231'
        ctx.req.session.user._id = userIdToRemove
        ctx.req.params = { user_id: userIdToRemove }
        ctx.req.entity = ctx.subscription
        ctx.Modules.promises.hooks.fire
          .withArgs('hasGroupSSOEnabled', ctx.subscription)
          .resolves([false])

        const res = {
          sendStatus: () => {
            ctx.Modules.promises.hooks.fire
              .calledWith('hasGroupSSOEnabled', ctx.subscription)
              .should.equal(true)
            sinon.assert.calledOnce(ctx.Modules.promises.hooks.fire)
            resolve()
          },
        }
        ctx.Controller.removeSelfFromGroup(ctx.req, res, resolve)
      })
    })
  })

  describe('addSeatsToGroupSubscription', function () {
    it('should render the "add seats" page', async function (ctx) {
      await new Promise((resolve, reject) => {
        const res = {
          render: (page, props) => {
            ctx.SubscriptionGroupHandler.promises.getUsersGroupSubscriptionDetails
              .calledWith(ctx.req.session.user._id)
              .should.equal(true)
            ctx.SubscriptionGroupHandler.promises.ensureFlexibleLicensingEnabled
              .calledWith(ctx.plan)
              .should.equal(true)
            ctx.SubscriptionGroupHandler.promises.ensureSubscriptionHasNoPendingChanges
              .calledWith(ctx.recurlySubscription)
              .should.equal(true)
            ctx.SubscriptionGroupHandler.promises.ensureSubscriptionIsActive
              .calledWith(ctx.subscription)
              .should.equal(true)
            ctx.SubscriptionGroupHandler.promises.ensureSubscriptionHasNoPastDueInvoice
              .calledWith(ctx.subscription)
              .should.equal(true)
            ctx.SubscriptionGroupHandler.promises.checkBillingInfoExistence
              .calledWith(ctx.recurlySubscription, ctx.adminUserId)
              .should.equal(true)
            ctx.SubscriptionGroupHandler.promises.ensureSubscriptionHasAdditionalLicenseAddOnWhenCollectionMethodIsManual
              .calledWith(ctx.recurlySubscription)
              .should.equal(true)
            page.should.equal('subscriptions/add-seats')
            props.subscriptionId.should.equal(ctx.subscriptionId)
            props.groupName.should.equal(ctx.subscription.teamName)
            props.totalLicenses.should.equal(ctx.subscription.membersLimit)
            props.isProfessional.should.equal(false)
            props.isCollectionMethodManual.should.equal(true)
            resolve()
          },
        }

        ctx.Controller.addSeatsToGroupSubscription(ctx.req, res)
      })
    })

    it('should redirect to subscription page when getting subscription details fails', async function (ctx) {
      await new Promise(resolve => {
        ctx.SubscriptionGroupHandler.promises.getUsersGroupSubscriptionDetails =
          sinon.stub().rejects()

        const res = {
          redirect: url => {
            url.should.equal('/user/subscription')
            resolve()
          },
        }

        ctx.Controller.addSeatsToGroupSubscription(ctx.req, res)
      })
    })

    it('should redirect to subscription page when flexible licensing is not enabled', async function (ctx) {
      await new Promise(resolve => {
        ctx.SubscriptionGroupHandler.promises.ensureFlexibleLicensingEnabled =
          sinon.stub().rejects()

        const res = {
          redirect: url => {
            url.should.equal('/user/subscription')
            resolve()
          },
        }

        ctx.Controller.addSeatsToGroupSubscription(ctx.req, res)
      })
    })

    it('should redirect to missing billing information page when billing information is missing', async function (ctx) {
      await new Promise(resolve => {
        ctx.SubscriptionGroupHandler.promises.checkBillingInfoExistence = sinon
          .stub()
          .throws(new ctx.Errors.MissingBillingInfoError())

        const res = {
          redirect: url => {
            url.should.equal(
              '/user/subscription/group/missing-billing-information'
            )
            resolve()
          },
        }

        ctx.Controller.addSeatsToGroupSubscription(ctx.req, res)
      })
    })

    it('should redirect to manually collected subscription error page when collection method is manual and has no additional license add-on', async function (ctx) {
      await new Promise(resolve => {
        ctx.SubscriptionGroupHandler.promises.ensureSubscriptionHasAdditionalLicenseAddOnWhenCollectionMethodIsManual =
          sinon
            .stub()
            .throws(
              new ctx.Errors.HasNoAdditionalLicenseWhenManuallyCollectedError()
            )

        const res = {
          redirect: url => {
            url.should.equal(
              '/user/subscription/group/manually-collected-subscription'
            )
            resolve()
          },
        }

        ctx.Controller.addSeatsToGroupSubscription(ctx.req, res)
      })
    })

    it('should redirect to subscription page when there is a pending change', async function (ctx) {
      await new Promise(resolve => {
        ctx.SubscriptionGroupHandler.promises.ensureSubscriptionHasNoPendingChanges =
          sinon.stub().throws(new ctx.Errors.PendingChangeError())

        const res = {
          redirect: url => {
            url.should.equal('/user/subscription')
            resolve()
          },
        }

        ctx.Controller.addSeatsToGroupSubscription(ctx.req, res)
      })
    })

    it('should redirect to subscription page when subscription is not active', async function (ctx) {
      await new Promise(resolve => {
        ctx.SubscriptionGroupHandler.promises.ensureSubscriptionIsActive = sinon
          .stub()
          .rejects()

        const res = {
          redirect: url => {
            url.should.equal('/user/subscription')
            resolve()
          },
        }

        ctx.Controller.addSeatsToGroupSubscription(ctx.req, res)
      })
    })

    it('should redirect to subscription page when subscription has pending invoice', async function (ctx) {
      ctx.SubscriptionGroupHandler.promises.ensureSubscriptionHasNoPastDueInvoice =
        sinon.stub().rejects()

      await new Promise(resolve => {
        const res = {
          redirect: url => {
            url.should.equal('/user/subscription')
            resolve()
          },
        }

        ctx.Controller.addSeatsToGroupSubscription(ctx.req, res)
      })
    })
  })

  describe('previewAddSeatsSubscriptionChange', function () {
    it('should preview "add seats" change', async function (ctx) {
      await new Promise(resolve => {
        ctx.req.body = { adding: 2 }

        const res = {
          json: data => {
            ctx.SubscriptionGroupHandler.promises.previewAddSeatsSubscriptionChange
              .calledWith(ctx.req.session.user._id, ctx.req.body.adding)
              .should.equal(true)
            data.should.deep.equal(ctx.previewSubscriptionChangeData)
            resolve()
          },
        }

        ctx.Controller.previewAddSeatsSubscriptionChange(ctx.req, res)
      })
    })

    it('should fail previewing "add seats" change', async function (ctx) {
      ctx.SubscriptionGroupHandler.promises.previewAddSeatsSubscriptionChange =
        sinon.stub().rejects()
      ctx.req.body = { adding: 2 }

      await new Promise(resolve => {
        const res = {
          status: statusCode => {
            statusCode.should.equal(500)
            return {
              end: () => {
                resolve()
              },
            }
          },
        }

        ctx.Controller.previewAddSeatsSubscriptionChange(ctx.req, res)
      })
    })

    it('should fail previewing "add seats" change with SubtotalLimitExceededError', async function (ctx) {
      await new Promise(resolve => {
        ctx.req.body = { adding: 2 }
        ctx.SubscriptionGroupHandler.promises.previewAddSeatsSubscriptionChange =
          sinon.stub().throws(new ctx.Errors.SubtotalLimitExceededError())

        const res = {
          status: statusCode => {
            statusCode.should.equal(422)

            return {
              json: data => {
                data.should.deep.equal({
                  code: 'subtotal_limit_exceeded',
                  adding: ctx.req.body.adding,
                })
                resolve()
              },
            }
          },
        }

        ctx.Controller.previewAddSeatsSubscriptionChange(ctx.req, res)
      })
    })
  })

  describe('createAddSeatsSubscriptionChange', function () {
    it('should apply "add seats" change', async function (ctx) {
      await new Promise(resolve => {
        ctx.req.body = { adding: 2 }

        const res = {
          json: data => {
            ctx.SubscriptionGroupHandler.promises.createAddSeatsSubscriptionChange
              .calledWith(ctx.req.session.user._id, ctx.req.body.adding)
              .should.equal(true)
            data.should.deep.equal(ctx.createSubscriptionChangeData)
            resolve()
          },
        }

        ctx.Controller.createAddSeatsSubscriptionChange(ctx.req, res)
      })
    })

    it('should fail applying "add seats" change', async function (ctx) {
      await new Promise(resolve => {
        ctx.SubscriptionGroupHandler.promises.createAddSeatsSubscriptionChange =
          sinon.stub().rejects()

        const res = {
          status: statusCode => {
            statusCode.should.equal(500)

            return {
              end: () => {
                resolve()
              },
            }
          },
        }

        ctx.Controller.createAddSeatsSubscriptionChange(ctx.req, res)
      })
    })

    it('should fail applying "add seats" change with SubtotalLimitExceededError', async function (ctx) {
      await new Promise(resolve => {
        ctx.req.body = { adding: 2 }
        ctx.SubscriptionGroupHandler.promises.createAddSeatsSubscriptionChange =
          sinon.stub().throws(new ctx.Errors.SubtotalLimitExceededError())

        const res = {
          status: statusCode => {
            statusCode.should.equal(422)

            return {
              json: data => {
                data.should.deep.equal({
                  code: 'subtotal_limit_exceeded',
                  adding: ctx.req.body.adding,
                })
                resolve()
              },
            }
          },
        }

        ctx.Controller.createAddSeatsSubscriptionChange(ctx.req, res)
      })
    })

    it('should send 402 response with PaymentActionRequiredError', async function (ctx) {
      await new Promise(resolve => {
        const adding = 2
        ctx.req.body = { adding }
        const error = new ctx.Errors.PaymentActionRequiredError({
          clientSecret: 'secret',
          publicKey: 'key',
        })
        ctx.SubscriptionGroupHandler.promises.createAddSeatsSubscriptionChange =
          sinon.stub().throws(error)

        const res = {
          status: statusCode => {
            statusCode.should.equal(402)

            return {
              json: data => {
                data.should.deep.equal({
                  message: 'Payment action required',
                  clientSecret: error.info.clientSecret,
                  publicKey: error.info.publicKey,
                })
                resolve()
              },
            }
          },
        }

        ctx.Controller.createAddSeatsSubscriptionChange(ctx.req, res)
      })
    })
  })

  describe('submitForm', function () {
    it('should build and pass the request body to the sales submit handler', async function (ctx) {
      await new Promise(resolve => {
        const adding = 100
        const poNumber = 'PO123456'
        ctx.req.body = { adding, poNumber }

        const res = {
          sendStatus: code => {
            ctx.SubscriptionGroupHandler.promises.updateSubscriptionPaymentTerms(
              ctx.adminUserId,
              ctx.recurlySubscription,
              poNumber
            )
            ctx.Modules.promises.hooks.fire
              .calledWith('sendSupportRequest', {
                email: ctx.user.email,
                subject: 'Sales Contact Form',
                message:
                  '\n' +
                  '**Overleaf Sales Contact Form:**\n' +
                  '\n' +
                  '**Subject:** Self-Serve Group User Increase Request\n' +
                  '\n' +
                  `**Estimated Number of Users:** ${adding}\n` +
                  '\n' +
                  `**PO Number:** ${poNumber}\n` +
                  '\n' +
                  `**Message:** This email has been generated on behalf of user with email **${ctx.user.email}** to request an increase in the total number of users for their subscription.`,
                inbox: 'sales',
              })
              .should.equal(true)
            sinon.assert.calledOnce(ctx.Modules.promises.hooks.fire)
            code.should.equal(204)
            resolve()
          },
        }
        ctx.Controller.submitForm(ctx.req, res, resolve)
      })
    })
  })

  describe('subscriptionUpgradePage', function () {
    it('should render "subscription upgrade" page', async function (ctx) {
      await new Promise(resolve => {
        const olSubscription = { membersLimit: 1, teamName: 'test team' }
        ctx.SubscriptionModel.Subscription.findOne = () => {
          return {
            exec: () => olSubscription,
          }
        }

        const res = {
          render: (page, data) => {
            ctx.SubscriptionGroupHandler.promises.getGroupPlanUpgradePreview
              .calledWith(ctx.req.session.user._id)
              .should.equal(true)
            page.should.equal('subscriptions/upgrade-group-subscription-react')
            data.totalLicenses.should.equal(olSubscription.membersLimit)
            data.groupName.should.equal(olSubscription.teamName)
            data.changePreview.should.equal(ctx.previewSubscriptionChangeData)
            resolve()
          },
        }

        ctx.Controller.subscriptionUpgradePage(ctx.req, res)
      })
    })

    it('should redirect if failed to generate preview', async function (ctx) {
      await new Promise(resolve => {
        ctx.SubscriptionGroupHandler.promises.getGroupPlanUpgradePreview = sinon
          .stub()
          .rejects()

        const res = {
          redirect: url => {
            url.should.equal('/user/subscription')
            resolve()
          },
        }

        ctx.Controller.subscriptionUpgradePage(ctx.req, res)
      })
    })

    it('should redirect to missing billing information page when billing information is missing', async function (ctx) {
      await new Promise(resolve => {
        ctx.SubscriptionGroupHandler.promises.getGroupPlanUpgradePreview = sinon
          .stub()
          .throws(new ctx.Errors.MissingBillingInfoError())

        const res = {
          redirect: url => {
            url.should.equal(
              '/user/subscription/group/missing-billing-information'
            )
            resolve()
          },
        }

        ctx.Controller.subscriptionUpgradePage(ctx.req, res)
      })
    })

    it('should redirect to manually collected subscription error page when collection method is manual', async function (ctx) {
      await new Promise(resolve => {
        ctx.SubscriptionGroupHandler.promises.getGroupPlanUpgradePreview = sinon
          .stub()
          .throws(new ctx.Errors.ManuallyCollectedError())

        const res = {
          redirect: url => {
            url.should.equal(
              '/user/subscription/group/manually-collected-subscription'
            )
            resolve()
          },
        }

        ctx.Controller.subscriptionUpgradePage(ctx.req, res)
      })
    })

    it('should redirect to subtotal limit exceeded page', async function (ctx) {
      await new Promise(resolve => {
        ctx.SubscriptionGroupHandler.promises.getGroupPlanUpgradePreview = sinon
          .stub()
          .throws(new ctx.Errors.SubtotalLimitExceededError())

        const res = {
          redirect: url => {
            url.should.equal('/user/subscription/group/subtotal-limit-exceeded')
            resolve()
          },
        }

        ctx.Controller.subscriptionUpgradePage(ctx.req, res)
      })
    })
  })

  describe('upgradeSubscription', function () {
    it('should send 200 response', async function (ctx) {
      await new Promise(resolve => {
        ctx.SubscriptionGroupHandler.promises.upgradeGroupPlan = sinon
          .stub()
          .resolves()

        const res = {
          sendStatus: code => {
            code.should.equal(200)
            resolve()
          },
        }

        ctx.Controller.upgradeSubscription(ctx.req, res)
      })
    })

    it('should send 500 response', async function (ctx) {
      await new Promise(resolve => {
        ctx.SubscriptionGroupHandler.promises.upgradeGroupPlan = sinon
          .stub()
          .rejects()

        const res = {
          sendStatus: code => {
            code.should.equal(500)
            resolve()
          },
        }

        ctx.Controller.upgradeSubscription(ctx.req, res)
      })
    })

    it('should send 402 response with PaymentActionRequiredError', async function (ctx) {
      await new Promise(resolve => {
        const error = new ctx.Errors.PaymentActionRequiredError({
          clientSecret: 'secret',
          publicKey: 'public',
        })
        ctx.SubscriptionGroupHandler.promises.upgradeGroupPlan = sinon
          .stub()
          .rejects(error)
        const res = {
          status: code => {
            code.should.equal(402)
            return {
              json: data => {
                data.should.deep.equal({
                  message: 'Payment action required',
                  clientSecret: error.info.clientSecret,
                  publicKey: error.info.publicKey,
                })
                resolve()
              },
            }
          },
        }

        ctx.Controller.upgradeSubscription(ctx.req, res)
      })
    })
  })
})
