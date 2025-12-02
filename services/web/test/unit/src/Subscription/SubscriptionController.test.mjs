import { vi, assert, expect } from 'vitest'
import sinon from 'sinon'
import MockRequest from '../helpers/MockRequest.mjs'
import MockResponse from '../helpers/MockResponse.mjs'
import SubscriptionErrors from '../../../../app/src/Features/Subscription/Errors.mjs'
import SubscriptionHelper from '../../../../app/src/Features/Subscription/SubscriptionHelper.mjs'
import { AI_ADD_ON_CODE } from '../../../../app/src/Features/Subscription/AiHelper.mjs'

const modulePath =
  '../../../../app/src/Features/Subscription/SubscriptionController.mjs'

const mockSubscriptions = {
  'subscription-123-active': {
    uuid: 'subscription-123-active',
    plan: {
      name: 'Gold',
      plan_code: 'gold',
    },
    current_period_ends_at: new Date(),
    state: 'active',
    unit_amount_in_cents: 999,
    account: {
      account_code: 'user-123',
    },
  },
}

describe('SubscriptionController', function () {
  beforeEach(async function (ctx) {
    ctx.logger = {
      debug: sinon.stub(),
      warn: sinon.stub(),
    }
    vi.doMock('@overleaf/logger', () => ({
      default: ctx.logger,
    }))

    ctx.user = {
      email: 'tom@yahoo.com',
      _id: 'one',
      signUpDate: new Date('2000-10-01'),
      emails: [{ email: 'tom@yahoo.com', confirmedAt: new Date('2000-10-02') }],
    }
    ctx.activeRecurlySubscription = mockSubscriptions['subscription-123-active']

    ctx.SessionManager = {
      getLoggedInUser: sinon.stub().callsArgWith(1, null, ctx.user),
      getLoggedInUserId: sinon.stub().returns(ctx.user._id),
      getSessionUser: sinon.stub().returns(ctx.user),
      isUserLoggedIn: sinon.stub().returns(true),
    }
    ctx.SubscriptionHandler = {
      createSubscription: sinon.stub().callsArgWith(3),
      updateSubscription: sinon.stub().callsArgWith(3),
      reactivateSubscription: sinon.stub().callsArgWith(1),
      cancelSubscription: sinon.stub().callsArgWith(1),
      syncSubscription: sinon.stub().yields(),
      attemptPaypalInvoiceCollection: sinon.stub().yields(),
      startFreeTrial: sinon.stub(),
      revertPlanChange: sinon.stub(),
      promises: {
        createSubscription: sinon.stub().resolves(),
        updateSubscription: sinon.stub().resolves(),
        reactivateSubscription: sinon.stub().resolves(),
        cancelSubscription: sinon.stub().resolves(),
        pauseSubscription: sinon.stub().resolves(),
        resumeSubscription: sinon.stub().resolves(),
        syncSubscription: sinon.stub().resolves(),
        attemptPaypalInvoiceCollection: sinon.stub().resolves(),
        startFreeTrial: sinon.stub().resolves(),
        purchaseAddon: sinon.stub().resolves(),
        previewAddonPurchase: sinon.stub().resolves({
          subscription: {
            currency: 'USD',
            netTerms: 0,
            periodEnd: new Date(),
            taxRate: 0,
          },
          immediateCharge: { amount: 0 },
          nextPlanCode: 'professional',
          nextPlanName: 'Professional',
          nextPlanPrice: 2000,
          nextAddOns: [],
          subtotal: 2000,
          tax: 0,
          total: 2000,
        }),
        revertPlanChange: sinon.stub().resolves(),
      },
    }

    ctx.LimitationsManager = {
      hasPaidSubscription: sinon.stub(),
      userHasSubscription: sinon
        .stub()
        .yields(null, { hasSubscription: false }),
      promises: {
        hasPaidSubscription: sinon.stub().resolves(),
        userHasSubscription: sinon.stub().resolves({ hasSubscription: false }),
      },
    }

    ctx.SubscriptionViewModelBuilder = {
      buildUsersSubscriptionViewModel: sinon.stub().callsArgWith(1, null, {}),
      buildPlansList: sinon.stub(),
      promises: {
        buildUsersSubscriptionViewModel: sinon.stub().resolves({}),
      },
      buildPlansListForSubscriptionDash: sinon
        .stub()
        .returns({ plans: [], planCodesChangingAtTermEnd: [] }),
    }
    ctx.settings = {
      coupon_codes: {
        upgradeToAnnualPromo: {
          student: 'STUDENTCODEHERE',
          collaborator: 'COLLABORATORCODEHERE',
        },
      },
      groupPlanModalOptions: {
        plan_codes: [],
        currencies: [
          {
            display: 'GBP (£)',
            code: 'GBP',
          },
        ],
        sizes: ['42'],
        usages: [{ code: 'foo', display: 'Foo' }],
      },
      apis: {
        recurly: {
          subdomain: 'sl',
        },
      },
      planReverts: {
        enabled: false,
      },
      siteUrl: 'http://de.overleaf.dev:3000',
    }
    ctx.AuthorizationManager = {
      promises: {
        isUserSiteAdmin: sinon.stub().resolves(false),
      },
    }
    ctx.GeoIpLookup = {
      isValidCurrencyParam: sinon.stub().returns(true),
      getCurrencyCode: sinon.stub().yields('USD', 'US'),
      promises: {
        getCurrencyCode: sinon.stub().resolves({
          countryCode: 'US',
          currencyCode: 'USD',
        }),
      },
    }
    ctx.UserGetter = {
      getUser: sinon.stub().callsArgWith(2, null, ctx.user),
      promises: {
        getUser: sinon.stub().resolves(ctx.user),
        getWritefullData: sinon
          .stub()
          .resolves({ isPremium: false, premiumSource: null }),
      },
    }
    ctx.SplitTestV2Hander = {
      promises: {
        getAssignment: sinon.stub().resolves({ variant: 'default' }),
      },
    }
    ctx.Features = {
      hasFeature: sinon.stub().returns(false),
    }

    vi.doMock(
      '../../../../app/src/Features/Authorization/AuthorizationManager',
      () => ({
        default: ctx.AuthorizationManager,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/SplitTests/SplitTestHandler',
      () => ({
        default: ctx.SplitTestV2Hander,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Authentication/SessionManager',
      () => ({
        default: ctx.SessionManager,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Subscription/SubscriptionHandler',
      () => ({
        default: ctx.SubscriptionHandler,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Subscription/SubscriptionHelper',
      () => ({
        default: SubscriptionHelper,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Subscription/SubscriptionViewModelBuilder',
      () => ({
        default: ctx.SubscriptionViewModelBuilder,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Subscription/LimitationsManager',
      () => ({
        default: ctx.LimitationsManager,
      })
    )

    vi.doMock('../../../../app/src/infrastructure/GeoIpLookup', () => ({
      default: ctx.GeoIpLookup,
    }))

    vi.doMock('@overleaf/settings', () => ({
      default: ctx.settings,
    }))

    vi.doMock('../../../../app/src/Features/User/UserGetter', () => ({
      default: ctx.UserGetter,
    }))

    vi.doMock(
      '../../../../app/src/Features/Subscription/RecurlyWrapper',
      () => ({
        default: (ctx.RecurlyWrapper = {
          promises: {
            updateAccountEmailAddress: sinon.stub().resolves(),
            getSubscription: sinon.stub().resolves({}),
          },
        }),
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Subscription/RecurlyEventHandler',
      () => ({
        default: {
          sendRecurlyAnalyticsEvent: sinon.stub().resolves(),
        },
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Subscription/FeaturesUpdater',
      () => ({
        default: (ctx.FeaturesUpdater = {
          promises: {
            refreshFeatures: sinon.stub().resolves({ features: {} }),
          },
        }),
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Subscription/GroupPlansData',
      () => ({
        default: (ctx.GroupPlansData = {}),
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Subscription/V1SubscriptionManager',
      () => ({
        default: (ctx.V1SubscriptionManager = {}),
      })
    )

    vi.doMock('../../../../app/src/Features/Errors/HttpErrorHandler', () => ({
      default: (ctx.HttpErrorHandler = {
        unprocessableEntity: sinon.stub().callsFake((req, res, message) => {
          res.status(422)
          res.json({ message })
        }),
        badRequest: sinon.stub().callsFake((req, res, message) => {
          res.status(400)
          res.json({ message })
        }),
      }),
    }))

    vi.doMock('../../../../app/src/Features/Subscription/Errors', () => ({
      default: SubscriptionErrors,
    }))

    vi.doMock(
      '../../../../app/src/Features/Analytics/AnalyticsManager',
      () => ({
        default: (ctx.AnalyticsManager = {
          recordEventForUser: sinon.stub(),
          recordEventForUserInBackground: sinon.stub(),
          recordEventForSession: sinon.stub(),
          setUserPropertyForUser: sinon.stub(),
        }),
      })
    )

    vi.doMock('../../../../app/src/infrastructure/Modules', () => ({
      default: (ctx.Modules = {
        promises: { hooks: { fire: sinon.stub().resolves() } },
      }),
    }))

    vi.doMock('../../../../app/src/infrastructure/Features', () => ({
      default: ctx.Features,
    }))

    vi.doMock('../../../../app/src/util/currency', () => ({
      default: (ctx.currency = {
        formatCurrency: sinon.stub(),
      }),
    }))

    vi.doMock('../../../../app/src/models/User', () => ({
      User: {
        findById: sinon.stub().resolves(ctx.user),
      },
    }))

    vi.doMock(
      '../../../../app/src/Features/Subscription/SubscriptionLocator',
      () => ({
        default: (ctx.SubscriptionLocator = {
          promises: {
            getUsersSubscription: sinon.stub().resolves(null),
          },
        }),
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Authorization/PermissionsManager',
      () => ({
        default: (ctx.PermissionsManager = {
          promises: {
            checkUserPermissions: sinon.stub().resolves(true),
          },
        }),
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Subscription/RecurlyClient',
      () => ({
        default: (ctx.RecurlyClient = {
          promises: {
            getAddOn: sinon.stub().resolves({
              code: 'ai-assistant',
              name: 'AI Assistant',
            }),
          },
        }),
      })
    )

    vi.doMock('../../../../app/src/Features/Subscription/PlansLocator', () => ({
      default: (ctx.PlansLocator = {
        findLocalPlanInSettings: sinon.stub().returns({
          annual: false,
        }),
      }),
    }))

    ctx.SubscriptionController = (await import(modulePath)).default

    ctx.res = new MockResponse(vi)
    ctx.req = new MockRequest(vi)
    ctx.req.body = {}
    ctx.req.query = { planCode: '123123' }

    ctx.stubbedCurrencyCode = 'GBP'
  })

  describe('successfulSubscription', function () {
    it('without a personal subscription', async function (ctx) {
      await new Promise(resolve => {
        ctx.SubscriptionViewModelBuilder.promises.buildUsersSubscriptionViewModel.resolves(
          {}
        )
        ctx.res.redirect = url => {
          url.should.equal('/user/subscription/plans')
          resolve()
        }
        ctx.SubscriptionController.successfulSubscription(ctx.req, ctx.res)
      })
    })

    it('with a personal subscription', async function (ctx) {
      await new Promise(resolve => {
        ctx.SubscriptionViewModelBuilder.promises.buildUsersSubscriptionViewModel.resolves(
          {
            personalSubscription: 'foo',
          }
        )
        ctx.res.render = (url, variables) => {
          url.should.equal('subscriptions/successful-subscription-react')
          assert.deepEqual(variables, {
            title: 'thank_you',
            personalSubscription: 'foo',
            postCheckoutRedirect: undefined,
            user: {
              _id: ctx.user._id,
              features: ctx.user.features,
            },
          })
          resolve()
        }
        ctx.SubscriptionController.successfulSubscription(ctx.req, ctx.res)
      })
    })

    it('with an error', async function (ctx) {
      await new Promise(resolve => {
        ctx.SubscriptionViewModelBuilder.promises.buildUsersSubscriptionViewModel.resolves(
          undefined
        )
        ctx.SubscriptionController.successfulSubscription(
          ctx.req,
          ctx.res,
          error => {
            assert.isNotNull(error)
            resolve()
          }
        )
      })
    })
  })

  describe('userSubscriptionPage', function () {
    beforeEach(async function (ctx) {
      await new Promise((resolve, reject) => {
        ctx.SubscriptionViewModelBuilder.promises.buildUsersSubscriptionViewModel.resolves(
          {
            personalSubscription: (ctx.personalSubscription = {
              'personal-subscription': 'mock',
            }),
            memberGroupSubscriptions: (ctx.memberGroupSubscriptions = {
              'group-subscriptions': 'mock',
            }),
          }
        )
        ctx.SubscriptionViewModelBuilder.buildPlansList.returns(
          (ctx.plans = { plans: 'mock' })
        )
        ctx.SubscriptionViewModelBuilder.buildPlansListForSubscriptionDash.returns(
          {
            plans: ctx.plans,
            planCodesChangingAtTermEnd: [],
          }
        )
        ctx.LimitationsManager.promises.userHasSubscription.resolves({
          hasSubscription: false,
        })
        ctx.res.render = (view, data) => {
          ctx.data = data
          expect(view).to.equal('subscriptions/dashboard-react')
          resolve()
        }
        ctx.SubscriptionController.userSubscriptionPage(
          ctx.req,
          ctx.res,
          ctx.rejectOnError(reject)
        )
      })
    })

    it('should load the personal, groups and v1 subscriptions', function (ctx) {
      expect(ctx.data.personalSubscription).to.deep.equal(
        ctx.personalSubscription
      )
      expect(ctx.data.memberGroupSubscriptions).to.deep.equal(
        ctx.memberGroupSubscriptions
      )
    })

    it('should load the user', function (ctx) {
      expect(ctx.data.user).to.deep.equal(ctx.user)
    })

    it('should load the plans', function (ctx) {
      expect(ctx.data.plans).to.deep.equal(ctx.plans)
    })

    it('should load an empty list of groups with settings available', function (ctx) {
      expect(ctx.data.groupSettingsEnabledFor).to.deep.equal([])
    })

    describe('when errorCode query param is present', function () {
      beforeEach(async function (ctx) {
        ctx.req.query.errorCode = 'payment_failed'
        await new Promise((resolve, reject) => {
          ctx.res.render = (view, data) => {
            ctx.data = data
            expect(view).to.equal('subscriptions/dashboard-react')
            resolve()
          }
          ctx.SubscriptionController.userSubscriptionPage(
            ctx.req,
            ctx.res,
            ctx.rejectOnError(reject)
          )
        })
      })

      it('should pass redirectedPaymentErrorCode to the view', function (ctx) {
        expect(ctx.data.redirectedPaymentErrorCode).to.equal('payment_failed')
      })
    })
  })

  describe('updateAccountEmailAddress via put', function () {
    beforeEach(function (ctx) {
      ctx.req.body = {
        account_email: 'current_account_email@overleaf.com',
      }
    })

    it('should send the user and subscriptionId to "updateAccountEmailAddress" hooks', async function (ctx) {
      ctx.res.sendStatus = sinon.spy()

      await ctx.SubscriptionController.updateAccountEmailAddress(
        ctx.req,
        ctx.res
      )

      expect(ctx.Modules.promises.hooks.fire).to.have.been.calledWith(
        'updateAccountEmailAddress',
        ctx.user._id,
        ctx.user.email
      )
    })

    it('should respond with 200', async function (ctx) {
      ctx.res.sendStatus = sinon.spy()
      await ctx.SubscriptionController.updateAccountEmailAddress(
        ctx.req,
        ctx.res
      )
      ctx.res.sendStatus.calledWith(200).should.equal(true)
    })

    it('should send the error to the next handler when updating recurly account email fails', async function (ctx) {
      ctx.Modules.promises.hooks.fire
        .withArgs('updateAccountEmailAddress', ctx.user._id, ctx.user.email)
        .rejects(new Error())

      ctx.next = sinon.spy(error => {
        expect(error).to.be.instanceOf(Error)
      })
      await ctx.SubscriptionController.updateAccountEmailAddress(
        ctx.req,
        ctx.res,
        ctx.next
      )
      expect(ctx.next.calledOnce).to.be.true
    })
  })

  describe('reactivateSubscription', function () {
    describe('when the user has permission', function () {
      beforeEach(async function (ctx) {
        await new Promise(resolve => {
          ctx.res = {
            redirect() {
              resolve()
            },
          }
          ctx.req.assertPermission = sinon.stub()
          ctx.next = sinon.stub().callsFake(error => {
            resolve(error)
          })
          sinon.spy(ctx.res, 'redirect')
          ctx.SubscriptionController.reactivateSubscription(
            ctx.req,
            ctx.res,
            ctx.next
          )
        })
      })

      it('should assert the user has permission to reactivate their subscription', async function (ctx) {
        await new Promise(resolve => {
          ctx.req.assertPermission
            .calledWith('reactivate-subscription')
            .should.equal(true)
          resolve()
        })
      })

      it('should tell the handler to reactivate this user', async function (ctx) {
        await new Promise(resolve => {
          ctx.SubscriptionHandler.reactivateSubscription
            .calledWith(ctx.user)
            .should.equal(true)
          resolve()
        })
      })

      it('should redurect to the subscription page', async function (ctx) {
        await new Promise(resolve => {
          ctx.res.redirect.calledWith('/user/subscription').should.equal(true)
          resolve()
        })
      })
    })

    describe('when the user does not have permission', function () {
      beforeEach(async function (ctx) {
        await new Promise(resolve => {
          ctx.res = {
            redirect() {
              resolve()
            },
          }
          ctx.req.assertPermission = sinon.stub().throws()
          ctx.next = sinon.stub().callsFake(() => {
            resolve()
          })
          sinon.spy(ctx.res, 'redirect')
          ctx.SubscriptionController.reactivateSubscription(
            ctx.req,
            ctx.res,
            ctx.next
          )
        })
      })

      it('should not reactivate the user', async function (ctx) {
        await new Promise(resolve => {
          ctx.req.assertPermission = sinon.stub().throws()
          ctx.SubscriptionHandler.reactivateSubscription.called.should.equal(
            false
          )
          resolve()
        })
      })

      it('should call next with an error', async function (ctx) {
        await new Promise(resolve => {
          ctx.next.calledWith(sinon.match.instanceOf(Error)).should.equal(true)
          resolve()
        })
      })
    })
  })

  describe('pauseSubscription', function () {
    it('should throw an error if no pause length is provided', async function (ctx) {
      ctx.res = new MockResponse(vi)
      ctx.req = new MockRequest(vi)
      ctx.next = sinon.stub()
      await expect(
        ctx.SubscriptionController.pauseSubscription(ctx.req, ctx.res, ctx.next)
      ).to.be.rejectedWith('Not found')
    })

    it('should throw an error if an invalid pause length is provided', async function (ctx) {
      ctx.res = new MockResponse(vi)
      ctx.req = new MockRequest(vi)
      ctx.req.params = { pauseCycles: '-10' }
      ctx.next = sinon.stub()
      await ctx.SubscriptionController.pauseSubscription(
        ctx.req,
        ctx.res,
        ctx.next
      )
      expect(ctx.res.statusCode).to.equal(400)
    })

    it('should return a 200 when requesting a pause', async function (ctx) {
      ctx.res = new MockResponse(vi)
      ctx.req = new MockRequest(vi)
      ctx.req.params = { pauseCycles: '3' }
      ctx.next = sinon.stub()
      await ctx.SubscriptionController.pauseSubscription(
        ctx.req,
        ctx.res,
        ctx.next
      )
      expect(ctx.res.statusCode).to.equal(200)
    })
  })

  describe('resumeSubscription', function () {
    it('should return a 200 when resuming a subscription', async function (ctx) {
      ctx.res = new MockResponse(vi)
      ctx.req = new MockRequest(vi)
      ctx.next = sinon.stub()
      await ctx.SubscriptionController.resumeSubscription(
        ctx.req,
        ctx.res,
        ctx.next
      )
      expect(ctx.res.statusCode).to.equal(200)
    })
  })

  describe('cancelSubscription', function () {
    it('should tell the handler to cancel this user', async function (ctx) {
      ctx.next = sinon.stub()
      await ctx.SubscriptionController.cancelSubscription(
        ctx.req,
        ctx.res,
        ctx.next
      )
      ctx.SubscriptionHandler.promises.cancelSubscription
        .calledWith(ctx.user)
        .should.equal(true)
    })

    it('should return a 200 on success', async function (ctx) {
      ctx.next = sinon.stub()
      await ctx.SubscriptionController.cancelSubscription(
        ctx.req,
        ctx.res,
        ctx.next
      )
      expect(ctx.res.statusCode).to.equal(200)
    })

    it('should call next with error', async function (ctx) {
      ctx.SubscriptionHandler.promises.cancelSubscription.rejects(
        new Error('cancel error')
      )
      ctx.next = sinon.stub()
      await ctx.SubscriptionController.cancelSubscription(
        ctx.req,
        ctx.res,
        ctx.next
      )
      ctx.next.calledWith(sinon.match.instanceOf(Error)).should.equal(true)
    })
  })

  describe('recurly callback', function () {
    describe('with a sync subscription request', function () {
      beforeEach(async function (ctx) {
        await new Promise(resolve => {
          ctx.req = {
            body: {
              expired_subscription_notification: {
                account: {
                  account_code: ctx.user._id,
                },
                subscription: {
                  uuid: ctx.activeRecurlySubscription.uuid,
                  plan: {
                    plan_code: 'collaborator',
                    state: 'active',
                  },
                },
              },
            },
          }
          ctx.res = {
            sendStatus() {
              resolve()
            },
          }
          sinon.spy(ctx.res, 'sendStatus')
          ctx.SubscriptionController.recurlyCallback(ctx.req, ctx.res)
        })
      })

      it('should tell the SubscriptionHandler to process the recurly callback', async function (ctx) {
        await new Promise(resolve => {
          ctx.SubscriptionHandler.syncSubscription.called.should.equal(true)
          resolve()
        })
      })

      it('should send a 200', async function (ctx) {
        await new Promise(resolve => {
          ctx.res.sendStatus.calledWith(200)
          resolve()
        })
      })
    })

    describe('with a billing info updated request', function () {
      beforeEach(async function (ctx) {
        await new Promise(resolve => {
          ctx.req = {
            body: {
              billing_info_updated_notification: {
                account: {
                  account_code: 'mock-account-code',
                },
              },
            },
          }
          ctx.res = {
            sendStatus() {
              resolve()
            },
          }
          sinon.spy(ctx.res, 'sendStatus')
          ctx.SubscriptionController.recurlyCallback(ctx.req, ctx.res)
        })
      })

      it('should call attemptPaypalInvoiceCollection', async function (ctx) {
        await new Promise(resolve => {
          ctx.SubscriptionHandler.attemptPaypalInvoiceCollection
            .calledWith('mock-account-code')
            .should.equal(true)
          resolve()
        })
      })

      it('should send a 200', async function (ctx) {
        await new Promise(resolve => {
          ctx.res.sendStatus.calledWith(200)
          resolve()
        })
      })
    })

    describe('with a non-actionable request', function () {
      beforeEach(async function (ctx) {
        await new Promise(resolve => {
          ctx.user.id = ctx.activeRecurlySubscription.account.account_code
          ctx.req = {
            body: {
              renewed_subscription_notification: {
                account: {
                  account_code: ctx.user._id,
                },
                subscription: {
                  uuid: ctx.activeRecurlySubscription.uuid,
                  plan: {
                    plan_code: 'collaborator',
                    state: 'active',
                  },
                },
              },
            },
          }
          ctx.res = {
            sendStatus() {
              resolve()
            },
          }
          sinon.spy(ctx.res, 'sendStatus')
          ctx.SubscriptionController.recurlyCallback(ctx.req, ctx.res)
        })
      })

      it('should not call the subscriptionshandler', function (ctx) {
        ctx.SubscriptionHandler.syncSubscription.called.should.equal(false)
        ctx.SubscriptionHandler.attemptPaypalInvoiceCollection.called.should.equal(
          false
        )
      })

      it('should respond with a 200 status', function (ctx) {
        ctx.res.sendStatus.calledWith(200)
      })
    })

    describe('with a failed payment notification', function () {
      describe('with planReverts disabled in settings', function () {
        beforeEach(async function (ctx) {
          await new Promise(resolve => {
            ctx.settings.planReverts = { enabled: false }
            ctx.SubscriptionHandler.revertPlanChange = sinon.stub()

            ctx.req.body = {
              failed_payment_notification: {
                transaction: {
                  subscription_id: 'subscription-123',
                },
              },
            }

            ctx.res = {
              sendStatus() {
                resolve()
              },
            }
            sinon.spy(ctx.res, 'sendStatus')
            ctx.SubscriptionController.recurlyCallback(ctx.req, ctx.res)
          })
        })
        it('should not call revertPlanChange', function (ctx) {
          expect(ctx.SubscriptionHandler.revertPlanChange.called).to.be.false
        })

        it('should respond with 200', async function (ctx) {
          await new Promise(resolve => {
            ctx.res.sendStatus.calledWith(200)
            resolve()
          })
        })
      })

      describe('with planReverts enabled in settings', function () {
        beforeEach(function (ctx) {
          ctx.settings.planReverts = { enabled: true }
        })

        describe('with no valid restore point', function () {
          beforeEach(async function (ctx) {
            await new Promise(resolve => {
              ctx.SubscriptionHandler.getSubscriptionRestorePoint = sinon
                .stub()
                .yields(null, null)
              ctx.SubscriptionHandler.revertPlanChange = sinon.stub()

              ctx.req.body = {
                failed_payment_notification: {
                  transaction: {
                    subscription_id: 'subscription-123',
                  },
                },
              }
              ctx.res = {
                sendStatus() {
                  resolve()
                },
              }
              sinon.spy(ctx.res, 'sendStatus')
              ctx.SubscriptionController.recurlyCallback(ctx.req, ctx.res)
            })
          })
          it('should not call revertPlanChange()', function (ctx) {
            expect(ctx.SubscriptionHandler.revertPlanChange.called).to.be.false
          })

          it('should respond with 200', function (ctx) {
            ctx.res.sendStatus.calledWith(200)
          })
        })

        describe('with a valid restore point', function () {
          beforeEach(async function (ctx) {
            await new Promise(resolve => {
              ctx.addOns = [
                {
                  addOnCode: 'addon-1',
                  quantity: 2,
                  unitAmountInCents: 500,
                },
                {
                  addOnCode: 'addon-2',
                  quantity: 1,
                  unitAmountInCents: 600,
                },
              ]
              ctx.lastSubscription = {
                planCode: 'gold',
                addOns: ctx.addOns,
              }
              ctx.SubscriptionHandler.getSubscriptionRestorePoint = sinon
                .stub()
                .yields(null, ctx.lastSubscription)
              ctx.SubscriptionHandler.revertPlanChange = sinon.stub().yields()
              ctx.req.body = {
                failed_payment_notification: {
                  transaction: {
                    subscription_id: 'subscription-123',
                  },
                },
              }
              ctx.res = {
                sendStatus() {
                  resolve()
                },
              }
              sinon.spy(ctx.res, 'sendStatus')
              ctx.SubscriptionController.recurlyCallback(ctx.req, ctx.res)
            })
          })

          it('should get the subscription restore point', function (ctx) {
            expect(
              ctx.SubscriptionHandler.getSubscriptionRestorePoint.calledWith(
                'subscription-123'
              )
            ).to.be.true
          })

          it('should call revertPlanChange()', function (ctx) {
            expect(
              ctx.SubscriptionHandler.revertPlanChange.calledWith(
                'subscription-123',
                ctx.lastSubscription
              )
            ).to.be.true
          })

          it('should respond with 200', function (ctx) {
            ctx.res.sendStatus.calledWith(200)
          })
        })
      })
    })
  })

  describe('purchaseAddon', function () {
    beforeEach(function (ctx) {
      ctx.SessionManager.getSessionUser.returns(ctx.user) // Make sure getSessionUser returns the user
      ctx.next = sinon.stub()
      ctx.req.params = { addOnCode: AI_ADD_ON_CODE } // Mock add-on code
    })

    it('should return 200 on successful purchase of AI add-on', async function (ctx) {
      await ctx.SubscriptionController.purchaseAddon(ctx.req, ctx.res, ctx.next)
      ctx.res.sendStatus = sinon.spy()

      await ctx.SubscriptionController.purchaseAddon(ctx.req, ctx.res, ctx.next)

      expect(ctx.SubscriptionHandler.promises.purchaseAddon).to.have.been.called
      expect(
        ctx.SubscriptionHandler.promises.purchaseAddon
      ).to.have.been.calledWith(ctx.user._id, AI_ADD_ON_CODE, 1)
      expect(
        ctx.FeaturesUpdater.promises.refreshFeatures
      ).to.have.been.calledWith(ctx.user._id, 'add-on-purchase')
      expect(ctx.res.sendStatus).to.have.been.calledWith(200)
      expect(ctx.logger.debug).to.have.been.calledWith(
        { userId: ctx.user._id, addOnCode: AI_ADD_ON_CODE },
        'purchasing add-ons'
      )
    })

    it('should return 404 if the add-on code is not AI_ADD_ON_CODE', async function (ctx) {
      ctx.req.params = { addOnCode: 'some-other-addon' }
      ctx.res.sendStatus = sinon.spy()

      await ctx.SubscriptionController.purchaseAddon(ctx.req, ctx.res, ctx.next)

      expect(ctx.SubscriptionHandler.promises.purchaseAddon).to.not.have.been
        .called
      expect(ctx.FeaturesUpdater.promises.refreshFeatures).to.not.have.been
        .called
      expect(ctx.res.sendStatus).to.have.been.calledWith(404)
    })

    it('should handle DuplicateAddOnError and send badRequest while sending 200', async function (ctx) {
      ctx.req.params.addOnCode = AI_ADD_ON_CODE
      ctx.SubscriptionHandler.promises.purchaseAddon.rejects(
        new SubscriptionErrors.DuplicateAddOnError()
      )

      await ctx.SubscriptionController.purchaseAddon(ctx.req, ctx.res, ctx.next)

      expect(ctx.HttpErrorHandler.badRequest).to.have.been.calledWith(
        ctx.req,
        ctx.res,
        'Your subscription already includes this add-on',
        { addon: AI_ADD_ON_CODE }
      )
      expect(
        ctx.FeaturesUpdater.promises.refreshFeatures
      ).to.have.been.calledWith(ctx.user._id, 'add-on-purchase')
      expect(ctx.res.sendStatus).toHaveBeenCalledWith(200)
    })

    it('should handle PaymentActionRequiredError and return 402 with details', async function (ctx) {
      ctx.req.params.addOnCode = AI_ADD_ON_CODE
      const paymentError = new SubscriptionErrors.PaymentActionRequiredError({
        clientSecret: 'secret123',
        publicKey: 'pubkey456',
      })
      ctx.SubscriptionHandler.promises.purchaseAddon.rejects(paymentError)

      await ctx.SubscriptionController.purchaseAddon(ctx.req, ctx.res, ctx.next)

      expect(ctx.res.status).toHaveBeenCalledWith(402)
      expect(ctx.res.json).toHaveBeenCalledWith({
        message: 'Payment action required',
        clientSecret: 'secret123',
        publicKey: 'pubkey456',
      })

      expect(ctx.FeaturesUpdater.promises.refreshFeatures).to.not.have.been
        .called
    })

    it('should refresh features', async function (ctx) {
      ctx.req.params.addOnCode = 'assistant'
      ctx.SubscriptionHandler.promises.purchaseAddon = sinon.stub().resolves()
      ctx.FeaturesUpdater.promises.refreshFeatures = sinon.stub().resolves()

      await ctx.SubscriptionController.purchaseAddon(ctx.req, ctx.res)

      expect(
        ctx.FeaturesUpdater.promises.refreshFeatures.calledWith(
          ctx.user._id,
          'add-on-purchase'
        )
      ).to.be.true
    })

    it('should respond with a bad request if the subscription already includes the addOn', async function (ctx) {
      ctx.req.params.addOnCode = 'assistant'
      ctx.SubscriptionHandler.promises.purchaseAddon = sinon
        .stub()
        .rejects(new SubscriptionErrors.DuplicateAddOnError())

      await ctx.SubscriptionController.purchaseAddon(ctx.req, ctx.res)

      expect(
        ctx.HttpErrorHandler.badRequest.calledWith(
          ctx.req,
          ctx.res,
          'Your subscription already includes this add-on',
          { addon: 'assistant' }
        )
      ).to.be.true
    })
  })

  describe('removeAddon', function () {
    beforeEach(function (ctx) {
      ctx.SessionManager.getSessionUser.returns(ctx.user)
      ctx.next = sinon.stub()
      ctx.req.params = { addOnCode: AI_ADD_ON_CODE }
      ctx.SubscriptionHandler.promises.removeAddon = sinon.stub().resolves()
    })

    it('should return 200 on successful removal of AI add-on', async function (ctx) {
      ctx.res.sendStatus = sinon.spy()

      await ctx.SubscriptionController.removeAddon(ctx.req, ctx.res, ctx.next)

      expect(ctx.SubscriptionHandler.promises.removeAddon).to.have.been.called
      expect(
        ctx.SubscriptionHandler.promises.removeAddon
      ).to.have.been.calledWith(ctx.user, AI_ADD_ON_CODE)
      expect(ctx.res.sendStatus).to.have.been.calledWith(200)
      expect(ctx.logger.debug).to.have.been.calledWith(
        { userId: ctx.user._id, addOnCode: AI_ADD_ON_CODE },
        'removing add-ons'
      )
    })

    it('should return 404 if the add-on code is not AI_ADD_ON_CODE', async function (ctx) {
      ctx.req.params = { addOnCode: 'some-other-addon' }
      ctx.res.sendStatus = sinon.spy()

      await ctx.SubscriptionController.removeAddon(ctx.req, ctx.res, ctx.next)

      expect(ctx.SubscriptionHandler.promises.removeAddon).to.not.have.been
        .called
      expect(ctx.res.sendStatus).to.have.been.calledWith(404)
    })

    it('should handle AddOnNotPresentError and send badRequest', async function (ctx) {
      ctx.SubscriptionHandler.promises.removeAddon.rejects(
        new SubscriptionErrors.AddOnNotPresentError()
      )

      await ctx.SubscriptionController.removeAddon(ctx.req, ctx.res, ctx.next)

      expect(ctx.HttpErrorHandler.badRequest).to.have.been.calledWith(
        ctx.req,
        ctx.res,
        'Your subscription does not contain the requested add-on',
        { addon: AI_ADD_ON_CODE }
      )
    })
  })

  describe('checkSubscriptionPauseStatus', function () {
    beforeEach(function (ctx) {
      ctx.user = {
        _id: 'user-id-123',
        email: 'test@example.com',
      }
    })

    it('should return isPaused: false when user has no subscription', async function (ctx) {
      ctx.LimitationsManager.promises.userHasSubscription.resolves({
        subscription: null,
      })

      const result =
        await ctx.SubscriptionController.checkSubscriptionPauseStatus(ctx.user)

      expect(result).to.deep.equal({ isPaused: false })
    })

    it('should return isPaused: false when subscription has no paymentProvider', async function (ctx) {
      const subscription = {
        planCode: 'professional',
      }
      ctx.LimitationsManager.promises.userHasSubscription.resolves({
        subscription,
      })

      const result =
        await ctx.SubscriptionController.checkSubscriptionPauseStatus(ctx.user)

      expect(result).to.deep.equal({ isPaused: false })
    })

    it('should return isPaused: false when subscription has no subscriptionId', async function (ctx) {
      const subscription = {
        paymentProvider: {
          service: 'stripe',
          subscriptionId: null,
        },
      }
      ctx.LimitationsManager.promises.userHasSubscription.resolves({
        subscription,
      })

      const result =
        await ctx.SubscriptionController.checkSubscriptionPauseStatus(ctx.user)

      expect(result).to.deep.equal({ isPaused: false })
    })

    it('should return isPaused: false when Stripe subscription has no remaining pause cycles', async function (ctx) {
      const subscription = {
        paymentProvider: {
          service: 'stripe',
          subscriptionId: 'sub-123',
        },
      }
      ctx.LimitationsManager.promises.userHasSubscription.resolves({
        subscription,
      })

      const paymentRecord = {
        subscription: {
          remainingPauseCycles: 0,
        },
      }
      ctx.Modules.promises.hooks.fire
        .withArgs('getPaymentFromRecord', subscription)
        .resolves([paymentRecord])

      const result =
        await ctx.SubscriptionController.checkSubscriptionPauseStatus(ctx.user)

      expect(result).to.deep.equal({ isPaused: false })
    })

    it('should return isPaused: false when Stripe subscription has no remainingPauseCycles property', async function (ctx) {
      const subscription = {
        paymentProvider: {
          service: 'stripe',
          subscriptionId: 'sub-123',
        },
      }
      ctx.LimitationsManager.promises.userHasSubscription.resolves({
        subscription,
      })

      const paymentRecord = {
        subscription: {},
      }
      ctx.Modules.promises.hooks.fire
        .withArgs('getPaymentFromRecord', subscription)
        .resolves([paymentRecord])

      const result =
        await ctx.SubscriptionController.checkSubscriptionPauseStatus(ctx.user)

      expect(result).to.deep.equal({ isPaused: false })
    })

    it('should return isPaused: true with redirect path when Stripe subscription has remaining pause cycles', async function (ctx) {
      const subscription = {
        paymentProvider: {
          service: 'stripe',
          subscriptionId: 'sub-123',
        },
      }
      ctx.LimitationsManager.promises.userHasSubscription.resolves({
        subscription,
      })

      const paymentRecord = {
        subscription: {
          remainingPauseCycles: 2,
        },
      }
      ctx.Modules.promises.hooks.fire
        .withArgs('getPaymentFromRecord', subscription)
        .resolves([paymentRecord])

      const result =
        await ctx.SubscriptionController.checkSubscriptionPauseStatus(ctx.user)

      expect(result).to.deep.equal({
        isPaused: true,
        redirectPath: '/user/subscription?redirect-reason=subscription-paused',
      })
    })

    it('should return isPaused: true when remainingPauseCycles is exactly 1', async function (ctx) {
      const subscription = {
        paymentProvider: {
          service: 'stripe',
          subscriptionId: 'sub-123',
        },
      }
      ctx.LimitationsManager.promises.userHasSubscription.resolves({
        subscription,
      })

      const paymentRecord = {
        subscription: {
          remainingPauseCycles: 1,
        },
      }
      ctx.Modules.promises.hooks.fire
        .withArgs('getPaymentFromRecord', subscription)
        .resolves([paymentRecord])

      const result =
        await ctx.SubscriptionController.checkSubscriptionPauseStatus(ctx.user)

      expect(result).to.deep.equal({
        isPaused: true,
        redirectPath: '/user/subscription?redirect-reason=subscription-paused',
      })
    })

    it('should return isPaused: false when userHasSubscription throws error', async function (ctx) {
      const error = new Error('Something bad happened')
      ctx.LimitationsManager.promises.userHasSubscription.rejects(error)

      const result =
        await ctx.SubscriptionController.checkSubscriptionPauseStatus(ctx.user)

      expect(result).to.deep.equal({ isPaused: false })
    })

    it('should return isPaused: false when getPaymentFromRecord throws error', async function (ctx) {
      const subscription = {
        paymentProvider: {
          service: 'stripe',
          subscriptionId: 'sub-123',
        },
      }
      ctx.LimitationsManager.promises.userHasSubscription.resolves({
        subscription,
      })

      const error = new Error('Something bad happened')
      ctx.Modules.promises.hooks.fire
        .withArgs('getPaymentFromRecord', subscription)
        .rejects(error)

      const result =
        await ctx.SubscriptionController.checkSubscriptionPauseStatus(ctx.user)

      expect(result).to.deep.equal({ isPaused: false })
    })

    it('should return isPaused: false when Recurly subscription is not paused', async function (ctx) {
      const subscription = {
        recurlySubscription_id: 'uuid-123',
        recurlyStatus: {
          state: 'active',
        },
      }
      ctx.LimitationsManager.promises.userHasSubscription.resolves({
        subscription,
      })

      const result =
        await ctx.SubscriptionController.checkSubscriptionPauseStatus(ctx.user)

      expect(result).to.deep.equal({ isPaused: false })
    })

    it('should return isPaused: true when Recurly subscription is paused', async function (ctx) {
      const subscription = {
        recurlySubscription_id: 'uuid-123',
        recurlyStatus: {
          state: 'paused',
        },
      }
      ctx.LimitationsManager.promises.userHasSubscription.resolves({
        subscription,
      })

      const result =
        await ctx.SubscriptionController.checkSubscriptionPauseStatus(ctx.user)

      expect(result).to.deep.equal({
        isPaused: true,
        redirectPath: '/user/subscription?redirect-reason=subscription-paused',
      })
    })

    it('should return isPaused: true when Recurly subscription has pending pause cycles', async function (ctx) {
      const subscription = {
        recurlySubscription_id: 'uuid-123',
        recurlyStatus: {
          state: 'active',
        },
      }
      ctx.LimitationsManager.promises.userHasSubscription.resolves({
        subscription,
      })

      const recurlySubscriptionData = {
        remaining_pause_cycles: 2,
      }
      ctx.RecurlyWrapper.promises.getSubscription.resolves(
        recurlySubscriptionData
      )

      const result =
        await ctx.SubscriptionController.checkSubscriptionPauseStatus(ctx.user)

      expect(result).to.deep.equal({
        isPaused: true,
        redirectPath: '/user/subscription?redirect-reason=subscription-paused',
      })
      expect(
        ctx.RecurlyWrapper.promises.getSubscription
      ).to.have.been.calledWith('uuid-123')
    })

    it('should return isPaused: false when Recurly subscription has no remaining pause cycles', async function (ctx) {
      const subscription = {
        recurlySubscription_id: 'uuid-123',
        recurlyStatus: {
          state: 'active',
        },
      }
      ctx.LimitationsManager.promises.userHasSubscription.resolves({
        subscription,
      })

      const recurlySubscriptionData = {
        remaining_pause_cycles: 0,
      }
      ctx.RecurlyWrapper.promises.getSubscription.resolves(
        recurlySubscriptionData
      )

      const result =
        await ctx.SubscriptionController.checkSubscriptionPauseStatus(ctx.user)

      expect(result).to.deep.equal({ isPaused: false })
    })

    it('should return isPaused: false when Recurly subscription has no remaining_pause_cycles property', async function (ctx) {
      const subscription = {
        recurlySubscription_id: 'uuid-123',
        recurlyStatus: {
          state: 'active',
        },
      }
      ctx.LimitationsManager.promises.userHasSubscription.resolves({
        subscription,
      })

      const recurlySubscriptionData = {}
      ctx.RecurlyWrapper.promises.getSubscription.resolves(
        recurlySubscriptionData
      )

      const result =
        await ctx.SubscriptionController.checkSubscriptionPauseStatus(ctx.user)

      expect(result).to.deep.equal({ isPaused: false })
    })

    it('should return isPaused: false when Recurly API call fails', async function (ctx) {
      const subscription = {
        recurlySubscription_id: 'uuid-123',
        recurlyStatus: {
          state: 'active',
        },
      }
      ctx.LimitationsManager.promises.userHasSubscription.resolves({
        subscription,
      })

      const error = new Error('Recurly API failed')
      ctx.RecurlyWrapper.promises.getSubscription.rejects(error)

      const result =
        await ctx.SubscriptionController.checkSubscriptionPauseStatus(ctx.user)

      expect(result).to.deep.equal({ isPaused: false })
    })
  })

  describe('previewAddonPurchase', function () {
    beforeEach(function (ctx) {
      ctx.req = new MockRequest(vi)
      ctx.req.params = { addOnCode: 'assistant' }
      ctx.req.query = { purchaseReferrer: 'fake-referrer' }
      ctx.res = new MockResponse(vi)

      ctx.Modules.promises.hooks.fire
        .withArgs('getPaymentMethod')
        .resolves(['fake-method'])
      ctx.SubscriptionLocator.promises.getUsersSubscription.resolves(null)
    })

    describe('when user has manual or custom subscription', function () {
      it('should redirect with ai-assist-unavailable when subscription has customAccount = true', async function (ctx) {
        const customSubscription = {
          _id: 'sub-123',
          customAccount: true,
          collectionMethod: 'automatic',
        }
        ctx.SubscriptionLocator.promises.getUsersSubscription.resolves(
          customSubscription
        )

        ctx.res.redirect = sinon.stub()

        await ctx.SubscriptionController.previewAddonPurchase(ctx.req, ctx.res)

        expect(ctx.res.redirect).to.have.been.calledWith(
          '/user/subscription?redirect-reason=ai-assist-unavailable'
        )
      })

      it('should redirect with ai-assist-unavailable when subscription has collectionMethod = manual', async function (ctx) {
        const manualSubscription = {
          _id: 'sub-123',
          customAccount: false,
          collectionMethod: 'manual',
        }
        ctx.SubscriptionLocator.promises.getUsersSubscription.resolves(
          manualSubscription
        )

        ctx.res.redirect = sinon.stub()

        await ctx.SubscriptionController.previewAddonPurchase(ctx.req, ctx.res)

        expect(ctx.res.redirect).to.have.been.calledWith(
          '/user/subscription?redirect-reason=ai-assist-unavailable'
        )
      })

      it('should redirect with ai-assist-unavailable when subscription has both customAccount and manual collection', async function (ctx) {
        const customManualSubscription = {
          _id: 'sub-123',
          customAccount: true,
          collectionMethod: 'manual',
        }
        ctx.SubscriptionLocator.promises.getUsersSubscription.resolves(
          customManualSubscription
        )

        ctx.res.redirect = sinon.stub()

        await ctx.SubscriptionController.previewAddonPurchase(ctx.req, ctx.res)

        expect(ctx.res.redirect).to.have.been.calledWith(
          '/user/subscription?redirect-reason=ai-assist-unavailable'
        )
      })
    })

    describe('when user has normal subscription', function () {
      it('should proceed with preview when subscription is not manual or custom', async function (ctx) {
        const normalSubscription = {
          _id: 'sub-123',
          customAccount: false,
          collectionMethod: 'automatic',
        }
        ctx.SubscriptionLocator.promises.getUsersSubscription.resolves(
          normalSubscription
        )

        ctx.res.render = sinon.stub()

        await ctx.SubscriptionController.previewAddonPurchase(ctx.req, ctx.res)

        expect(ctx.res.render).to.have.been.calledWith(
          'subscriptions/preview-change',
          sinon.match({
            changePreview: sinon.match.object,
            purchaseReferrer: 'fake-referrer',
            redirectedPaymentErrorCode: undefined,
          })
        )
        expect(
          ctx.SubscriptionHandler.promises.previewAddonPurchase
        ).to.have.been.calledWith(ctx.user._id, 'assistant')
      })

      it('should pass redirectedPaymentErrorCode to the view when errorCode query param is present', async function (ctx) {
        const normalSubscription = {
          _id: 'sub-123',
          customAccount: false,
          collectionMethod: 'automatic',
        }
        ctx.SubscriptionLocator.promises.getUsersSubscription.resolves(
          normalSubscription
        )
        ctx.req.query.errorCode = 'payment_failed'

        ctx.res.render = sinon.stub()

        await ctx.SubscriptionController.previewAddonPurchase(ctx.req, ctx.res)

        expect(ctx.res.render).to.have.been.calledWith(
          'subscriptions/preview-change',
          sinon.match({
            changePreview: sinon.match.object,
            purchaseReferrer: 'fake-referrer',
            redirectedPaymentErrorCode: 'payment_failed',
          })
        )
      })

      it('should proceed with preview when customAccount is undefined and collectionMethod is automatic', async function (ctx) {
        const normalSubscription = {
          _id: 'sub-123',
          // customAccount: undefined (not set)
          collectionMethod: 'automatic',
        }
        ctx.SubscriptionLocator.promises.getUsersSubscription.resolves(
          normalSubscription
        )

        ctx.res.render = sinon.stub()

        await ctx.SubscriptionController.previewAddonPurchase(ctx.req, ctx.res)

        expect(ctx.res.render).to.have.been.calledWith(
          'subscriptions/preview-change'
        )
        expect(
          ctx.SubscriptionHandler.promises.previewAddonPurchase
        ).to.have.been.calledWith(ctx.user._id, 'assistant')
      })
    })
  })
})
