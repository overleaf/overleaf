import { vi, assert } from 'vitest'
import sinon from 'sinon'
import PaymentProviderEntities from '../../../../app/src/Features/Subscription/PaymentProviderEntities.mjs'
import SubscriptionHelper from '../../../../app/src/Features/Subscription/SubscriptionHelper.mjs'

const {
  PaymentProviderAccount,
  PaymentProviderSubscription,
  PaymentProviderSubscriptionAddOn,
  PaymentProviderSubscriptionChange,
} = PaymentProviderEntities
const modulePath =
  '../../../../app/src/Features/Subscription/SubscriptionViewModelBuilder.mjs'

describe('SubscriptionViewModelBuilder', function () {
  beforeEach(async function (ctx) {
    ctx.user = { _id: '5208dd34438842e2db333333' }
    ctx.recurlySubscription_id = '123abc456def'
    ctx.planCode = 'collaborator_monthly'
    ctx.planFeatures = {
      compileGroup: 'priority',
      collaborators: -1,
      compileTimeout: 240,
    }
    ctx.plan = {
      planCode: ctx.planCode,
      features: ctx.planFeatures,
    }
    ctx.annualPlanCode = 'collaborator_annual'
    ctx.annualPlan = {
      planCode: ctx.annualPlanCode,
      features: ctx.planFeatures,
    }
    ctx.individualSubscription = {
      planCode: ctx.planCode,
      plan: ctx.plan,
      recurlySubscription_id: ctx.recurlySubscription_id,
      recurlyStatus: {
        state: 'active',
      },
    }
    ctx.paymentRecord = new PaymentProviderSubscription({
      id: ctx.recurlySubscription_id,
      userId: ctx.user._id,
      currency: 'EUR',
      planCode: 'plan-code',
      planName: 'plan-name',
      planPrice: 13,
      addOns: [
        new PaymentProviderSubscriptionAddOn({
          code: 'addon-code',
          name: 'addon name',
          quantity: 1,
          unitPrice: 2,
        }),
      ],
      subtotal: 15,
      taxRate: 0.1,
      taxAmount: 1.5,
      total: 16.5,
      periodStart: new Date('2025-01-20T12:00:00.000Z'),
      periodEnd: new Date('2025-02-20T12:00:00.000Z'),
      collectionMethod: 'automatic',
    })

    ctx.individualCustomSubscription = {
      planCode: ctx.planCode,
      plan: ctx.plan,
      recurlySubscription_id: ctx.recurlySubscription_id,
    }

    ctx.groupPlanCode = 'group_collaborator_monthly'
    ctx.groupPlanFeatures = {
      compileGroup: 'priority',
      collaborators: 10,
      compileTimeout: 240,
    }
    ctx.groupPlan = {
      planCode: ctx.groupPlanCode,
      features: ctx.groupPlanFeatures,
      membersLimit: 4,
      membersLimitAddOn: 'additional-license',
      groupPlan: true,
    }
    ctx.groupSubscription = {
      planCode: ctx.groupPlanCode,
      plan: ctx.plan,
      recurlyStatus: {
        state: 'active',
      },
    }

    ctx.commonsPlanCode = 'commons_license'
    ctx.commonsPlanFeatures = {
      compileGroup: 'priority',
      collaborators: '-1',
      compileTimeout: 240,
    }
    ctx.commonsPlan = {
      planCode: ctx.commonsPlanCode,
      features: ctx.commonsPlanFeatures,
    }
    ctx.commonsSubscription = {
      planCode: ctx.commonsPlanCode,
      plan: ctx.commonsPlan,
      name: 'Digital Science',
    }

    ctx.Settings = {
      institutionPlanCode: ctx.commonsPlanCode,
    }
    ctx.SubscriptionLocator = {
      promises: {
        getUsersSubscription: sinon.stub().resolves(),
        getMemberSubscriptions: sinon.stub().resolves(),
        getManagedGroupSubscriptions: sinon.stub().resolves([]),
      },
      getUsersSubscription: sinon.stub().yields(),
      getMemberSubscriptions: sinon.stub().yields(null, []),
      getManagedGroupSubscriptions: sinon.stub().yields(null, []),
      findLocalPlanInSettings: sinon.stub(),
    }
    ctx.InstitutionsGetter = {
      promises: {
        getCurrentInstitutionsWithLicence: sinon.stub().resolves(),
      },
      getCurrentInstitutionsWithLicence: sinon.stub().yields(null, []),
      getManagedInstitutions: sinon.stub().yields(null, []),
    }
    ctx.InstitutionsManager = {
      promises: {
        fetchV1Data: sinon.stub().resolves(),
      },
    }
    ctx.PublishersGetter = {
      promises: {
        fetchV1Data: sinon.stub().resolves(),
      },
      getManagedPublishers: sinon.stub().yields(null, []),
    }
    ctx.RecurlyWrapper = {
      promises: {
        getSubscription: sinon.stub().resolves(),
      },
    }
    ctx.SubscriptionUpdater = {
      promises: {
        updateSubscriptionFromRecurly: sinon.stub().resolves(),
      },
    }
    ctx.PlansLocator = {
      findLocalPlanInSettings: sinon.stub(),
    }
    ctx.SplitTestHandler = {
      promises: {
        getAssignmentForUser: sinon.stub().resolves({ variant: 'default' }),
      },
    }

    vi.doMock('@overleaf/settings', () => ({
      default: ctx.Settings,
    }))

    vi.doMock(
      '../../../../app/src/Features/Subscription/SubscriptionLocator',
      () => ({
        default: ctx.SubscriptionLocator,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Institutions/InstitutionsGetter',
      () => ({
        default: ctx.InstitutionsGetter,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Institutions/InstitutionsManager',
      () => ({
        default: ctx.InstitutionsManager,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Subscription/RecurlyWrapper',
      () => ({
        default: ctx.RecurlyWrapper,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Subscription/SubscriptionUpdater',
      () => ({
        default: ctx.SubscriptionUpdater,
      })
    )

    vi.doMock('../../../../app/src/Features/Subscription/PlansLocator', () => ({
      default: ctx.PlansLocator,
    }))

    vi.doMock('../../../../app/src/infrastructure/Modules', () => ({
      default: (ctx.Modules = {
        promises: { hooks: { fire: sinon.stub().resolves([]) } },
        hooks: {
          fire: sinon.stub().yields(null, []),
        },
      }),
    }))

    vi.doMock(
      '../../../../app/src/Features/Subscription/V1SubscriptionManager',
      () => ({
        default: {},
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Publishers/PublishersGetter',
      () => ({
        default: ctx.PublishersGetter,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Subscription/SubscriptionHelper',
      () => ({
        default: SubscriptionHelper,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/SplitTests/SplitTestHandler',
      () => ({
        default: ctx.SplitTestHandler,
      })
    )

    ctx.SubscriptionViewModelBuilder = (await import(modulePath)).default

    ctx.PlansLocator.findLocalPlanInSettings
      .withArgs(ctx.planCode)
      .returns(ctx.plan)
      .withArgs(ctx.annualPlanCode)
      .returns(ctx.annualPlan)
      .withArgs(ctx.groupPlanCode)
      .returns(ctx.groupPlan)
      .withArgs(ctx.commonsPlanCode)
      .returns(ctx.commonsPlan)
  })

  describe('getUsersSubscriptionDetails', function () {
    it('should return a free plan when user has no subscription or affiliation', async function (ctx) {
      const { bestSubscription: usersBestSubscription } =
        await ctx.SubscriptionViewModelBuilder.promises.getUsersSubscriptionDetails(
          ctx.user
        )
      assert.deepEqual(usersBestSubscription, { type: 'free' })
    })

    describe('with a individual subscription only', function () {
      it('should return a individual subscription when user has non-Recurly one', async function (ctx) {
        ctx.SubscriptionLocator.promises.getUsersSubscription
          .withArgs(ctx.user)
          .resolves(ctx.individualCustomSubscription)

        const { bestSubscription: usersBestSubscription } =
          await ctx.SubscriptionViewModelBuilder.promises.getUsersSubscriptionDetails(
            ctx.user
          )

        assert.deepEqual(usersBestSubscription, {
          type: 'individual',
          subscription: ctx.individualCustomSubscription,
          plan: ctx.plan,
          remainingTrialDays: -1,
        })
      })

      it('should return a individual subscription when user has an active one', async function (ctx) {
        ctx.SubscriptionLocator.promises.getUsersSubscription
          .withArgs(ctx.user)
          .resolves(ctx.individualSubscription)

        const { bestSubscription: usersBestSubscription } =
          await ctx.SubscriptionViewModelBuilder.promises.getUsersSubscriptionDetails(
            ctx.user
          )

        assert.deepEqual(usersBestSubscription, {
          type: 'individual',
          subscription: ctx.individualSubscription,
          plan: ctx.plan,
          remainingTrialDays: -1,
        })
      })

      it('should return a individual subscription with remaining free trial days', async function (ctx) {
        const threeDaysLater = new Date()
        threeDaysLater.setDate(threeDaysLater.getDate() + 3)
        ctx.individualSubscription.recurlyStatus.trialEndsAt = threeDaysLater
        ctx.SubscriptionLocator.promises.getUsersSubscription
          .withArgs(ctx.user)
          .resolves(ctx.individualSubscription)

        const { bestSubscription: usersBestSubscription } =
          await ctx.SubscriptionViewModelBuilder.promises.getUsersSubscriptionDetails(
            ctx.user
          )

        assert.deepEqual(usersBestSubscription, {
          type: 'individual',
          subscription: ctx.individualSubscription,
          plan: ctx.plan,
          remainingTrialDays: 3,
        })
      })

      it('should return a individual subscription with free trial on last day', async function (ctx) {
        const threeHoursLater = new Date()
        threeHoursLater.setTime(threeHoursLater.getTime() + 3 * 60 * 60 * 1000)
        ctx.individualSubscription.recurlyStatus.trialEndsAt = threeHoursLater
        ctx.SubscriptionLocator.promises.getUsersSubscription
          .withArgs(ctx.user)
          .resolves(ctx.individualSubscription)

        const { bestSubscription: usersBestSubscription } =
          await ctx.SubscriptionViewModelBuilder.promises.getUsersSubscriptionDetails(
            ctx.user
          )

        assert.deepEqual(usersBestSubscription, {
          type: 'individual',
          subscription: ctx.individualSubscription,
          plan: ctx.plan,
          remainingTrialDays: 1,
        })
      })

      it('should update subscription if recurly payment state is missing', async function (ctx) {
        ctx.individualSubscriptionWithoutPaymentState = {
          planCode: ctx.planCode,
          plan: ctx.plan,
          recurlySubscription_id: ctx.recurlySubscription_id,
        }
        ctx.paymentRecord = {
          state: 'active',
        }
        ctx.SubscriptionLocator.promises.getUsersSubscription
          .withArgs(ctx.user)
          .onCall(0)
          .resolves(ctx.individualSubscriptionWithoutPaymentState)
          .withArgs(ctx.user)
          .onCall(1)
          .resolves(ctx.individualSubscription)
        const payment = {
          subscription: ctx.paymentRecord,
          account: new PaymentProviderAccount({}),
          coupons: [],
        }

        ctx.Modules.promises.hooks.fire
          .withArgs(
            'getPaymentFromRecordPromise',
            ctx.individualSubscriptionWithoutPaymentState
          )
          .resolves([payment])
        ctx.Modules.promises.hooks.fire
          .withArgs(
            'syncSubscription',
            payment,
            ctx.individualSubscriptionWithoutPaymentState
          )
          .resolves([])

        const { bestSubscription: usersBestSubscription } =
          await ctx.SubscriptionViewModelBuilder.promises.getUsersSubscriptionDetails(
            ctx.user
          )

        assert.deepEqual(usersBestSubscription, {
          type: 'individual',
          subscription: ctx.individualSubscription,
          plan: ctx.plan,
          remainingTrialDays: -1,
        })
        assert.isTrue(
          ctx.Modules.promises.hooks.fire.withArgs(
            'getPaymentFromRecordPromise',
            ctx.individualSubscriptionWithoutPaymentState
          ).calledOnce
        )
      })

      it('should update subscription if stripe payment state is missing', async function (ctx) {
        ctx.individualSubscriptionWithoutPaymentState = {
          planCode: ctx.planCode,
          plan: ctx.plan,
          paymentProvider: {
            subscriptionId: ctx.recurlySubscription_id,
          },
        }
        ctx.paymentRecord = {
          state: 'active',
        }
        ctx.SubscriptionLocator.promises.getUsersSubscription
          .withArgs(ctx.user)
          .onCall(0)
          .resolves(ctx.individualSubscriptionWithoutPaymentState)
          .withArgs(ctx.user)
          .onCall(1)
          .resolves(ctx.individualSubscription)
        const payment = {
          subscription: ctx.paymentRecord,
          account: new PaymentProviderAccount({}),
          coupons: [],
        }

        ctx.Modules.promises.hooks.fire
          .withArgs(
            'getPaymentFromRecordPromise',
            ctx.individualSubscriptionWithoutPaymentState
          )
          .resolves([payment])
        ctx.Modules.promises.hooks.fire
          .withArgs(
            'syncSubscription',
            payment,
            ctx.individualSubscriptionWithoutPaymentState
          )
          .resolves([])

        const { bestSubscription: usersBestSubscription } =
          await ctx.SubscriptionViewModelBuilder.promises.getUsersSubscriptionDetails(
            ctx.user
          )

        assert.deepEqual(usersBestSubscription, {
          type: 'individual',
          subscription: ctx.individualSubscription,
          plan: ctx.plan,
          remainingTrialDays: -1,
        })
        assert.isTrue(
          ctx.Modules.promises.hooks.fire.withArgs(
            'getPaymentFromRecordPromise',
            ctx.individualSubscriptionWithoutPaymentState
          ).calledOnce
        )
      })
    })

    it('should return a group subscription when user has one', async function (ctx) {
      ctx.SubscriptionLocator.promises.getMemberSubscriptions
        .withArgs(ctx.user)
        .resolves([ctx.groupSubscription])
      const { bestSubscription: usersBestSubscription } =
        await ctx.SubscriptionViewModelBuilder.promises.getUsersSubscriptionDetails(
          ctx.user
        )
      assert.deepEqual(usersBestSubscription, {
        type: 'group',
        subscription: {},
        plan: ctx.groupPlan,
        remainingTrialDays: -1,
      })
    })

    it('should return a group subscription with team name when user has one', async function (ctx) {
      ctx.SubscriptionLocator.promises.getMemberSubscriptions
        .withArgs(ctx.user)
        .resolves([
          Object.assign({}, ctx.groupSubscription, { teamName: 'test team' }),
        ])
      const { bestSubscription: usersBestSubscription } =
        await ctx.SubscriptionViewModelBuilder.promises.getUsersSubscriptionDetails(
          ctx.user
        )
      assert.deepEqual(usersBestSubscription, {
        type: 'group',
        subscription: { teamName: 'test team' },
        plan: ctx.groupPlan,
        remainingTrialDays: -1,
      })
    })

    it('should return a commons subscription when user has an institution affiliation', async function (ctx) {
      ctx.InstitutionsGetter.promises.getCurrentInstitutionsWithLicence
        .withArgs(ctx.user._id)
        .resolves([ctx.commonsSubscription])

      const { bestSubscription: usersBestSubscription } =
        await ctx.SubscriptionViewModelBuilder.promises.getUsersSubscriptionDetails(
          ctx.user
        )

      assert.deepEqual(usersBestSubscription, {
        type: 'commons',
        subscription: ctx.commonsSubscription,
        plan: ctx.commonsPlan,
      })
    })

    describe('with multiple subscriptions', function () {
      beforeEach(function (ctx) {
        ctx.SubscriptionLocator.promises.getUsersSubscription
          .withArgs(ctx.user)
          .resolves(ctx.individualSubscription)
        ctx.SubscriptionLocator.promises.getMemberSubscriptions
          .withArgs(ctx.user)
          .resolves([ctx.groupSubscription])
        ctx.InstitutionsGetter.promises.getCurrentInstitutionsWithLicence
          .withArgs(ctx.user._id)
          .resolves([ctx.commonsSubscription])
      })

      it('should return individual when the individual subscription has the best feature set', async function (ctx) {
        ctx.commonsPlan.features = {
          compileGroup: 'standard',
          collaborators: 1,
          compileTimeout: 60,
        }

        const { bestSubscription: usersBestSubscription } =
          await ctx.SubscriptionViewModelBuilder.promises.getUsersSubscriptionDetails(
            ctx.user
          )

        assert.deepEqual(usersBestSubscription, {
          type: 'individual',
          subscription: ctx.individualSubscription,
          plan: ctx.plan,
          remainingTrialDays: -1,
        })
      })

      it('should return group when the group subscription has the best feature set', async function (ctx) {
        ctx.plan.features = {
          compileGroup: 'standard',
          collaborators: 1,
          compileTimeout: 60,
        }
        ctx.commonsPlan.features = {
          compileGroup: 'standard',
          collaborators: 1,
          compileTimeout: 60,
        }

        const { bestSubscription: usersBestSubscription } =
          await ctx.SubscriptionViewModelBuilder.promises.getUsersSubscriptionDetails(
            ctx.user
          )

        assert.deepEqual(usersBestSubscription, {
          type: 'group',
          subscription: {},
          plan: ctx.groupPlan,
          remainingTrialDays: -1,
        })
      })

      it('should return commons when the commons affiliation has the best feature set', async function (ctx) {
        ctx.plan.features = {
          compileGroup: 'priority',
          collaborators: 5,
          compileTimeout: 240,
        }
        ctx.groupPlan.features = {
          compileGroup: 'standard',
          collaborators: 1,
          compileTimeout: 60,
        }
        ctx.commonsPlan.features = {
          compileGroup: 'priority',
          collaborators: -1,
          compileTimeout: 240,
        }

        const { bestSubscription: usersBestSubscription } =
          await ctx.SubscriptionViewModelBuilder.promises.getUsersSubscriptionDetails(
            ctx.user
          )

        assert.deepEqual(usersBestSubscription, {
          type: 'commons',
          subscription: ctx.commonsSubscription,
          plan: ctx.commonsPlan,
        })
      })

      it('should return individual with equal feature sets', async function (ctx) {
        ctx.plan.features = {
          compileGroup: 'priority',
          collaborators: -1,
          compileTimeout: 240,
        }
        ctx.groupPlan.features = {
          compileGroup: 'priority',
          collaborators: -1,
          compileTimeout: 240,
        }
        ctx.commonsPlan.features = {
          compileGroup: 'priority',
          collaborators: -1,
          compileTimeout: 240,
        }

        const { bestSubscription: usersBestSubscription } =
          await ctx.SubscriptionViewModelBuilder.promises.getUsersSubscriptionDetails(
            ctx.user
          )

        assert.deepEqual(usersBestSubscription, {
          type: 'individual',
          subscription: ctx.individualSubscription,
          plan: ctx.plan,
          remainingTrialDays: -1,
        })
      })

      it('should return group over commons with equal feature sets', async function (ctx) {
        ctx.plan.features = {
          compileGroup: 'standard',
          collaborators: 1,
          compileTimeout: 60,
        }
        ctx.groupPlan.features = {
          compileGroup: 'priority',
          collaborators: -1,
          compileTimeout: 240,
        }
        ctx.commonsPlan.features = {
          compileGroup: 'priority',
          collaborators: -1,
          compileTimeout: 240,
        }

        const { bestSubscription: usersBestSubscription } =
          await ctx.SubscriptionViewModelBuilder.promises.getUsersSubscriptionDetails(
            ctx.user
          )

        assert.deepEqual(usersBestSubscription, {
          type: 'group',
          subscription: {},
          plan: ctx.groupPlan,
          remainingTrialDays: -1,
        })
      })
    })
  })

  describe('buildUsersSubscriptionViewModel', function () {
    beforeEach(function (ctx) {
      ctx.SubscriptionLocator.getUsersSubscription.yields(
        null,
        ctx.individualSubscription
      )
      ctx.Modules.hooks.fire
        .withArgs('getPaymentFromRecord', ctx.individualSubscription)
        .yields(null, [
          {
            subscription: ctx.paymentRecord,
            account: new PaymentProviderAccount({}),
            coupons: [],
          },
        ])
    })

    describe('with a paid subscription', function () {
      it('adds payment data to the personal subscription', async function (ctx) {
        ctx.Modules.hooks.fire
          .withArgs('getPaymentFromRecord', ctx.individualSubscription)
          .yields(null, [
            {
              subscription: ctx.paymentRecord,
              account: new PaymentProviderAccount({
                email: 'example@example.com',
                hasPastDueInvoice: false,
              }),
              coupons: [],
            },
          ])
        const result =
          await ctx.SubscriptionViewModelBuilder.promises.buildUsersSubscriptionViewModel(
            ctx.user
          )
        assert.deepEqual(result.personalSubscription.payment, {
          taxRate: 0.1,
          billingDetailsLink: '/user/subscription/payment/billing-details',
          accountManagementLink:
            '/user/subscription/payment/account-management',
          additionalLicenses: 0,
          addOns: [
            {
              code: 'addon-code',
              name: 'addon name',
              quantity: 1,
              unitPrice: 2,
              preTaxTotal: 2,
            },
          ],
          totalLicenses: 0,
          nextPaymentDueAt: 'February 20th, 2025 12:00 PM UTC',
          nextPaymentDueDate: 'February 20th, 2025',
          currency: 'EUR',
          state: 'active',
          trialEndsAtFormatted: null,
          trialEndsAt: null,
          activeCoupons: [],
          accountEmail: 'example@example.com',
          hasPastDueInvoice: false,
          pausedAt: null,
          remainingPauseCycles: null,
          displayPrice: '€16.50',
          planOnlyDisplayPrice: '€14.30',
          addOnDisplayPricesWithoutAdditionalLicense: {
            'addon-code': '€2.20',
          },
          isEligibleForGroupPlan: true,
          isEligibleForPause: false,
          isEligibleForDowngradeUpsell: true,
        })
      })

      it('filters out single-use coupons for stripe subscriptions', async function (ctx) {
        ctx.paymentRecord.service = 'stripe-us'
        const foreverCoupon = {
          code: 'forever',
          name: 'Forever',
          isSingleUse: false,
        }
        const singleUseCoupon = {
          code: 'once',
          name: 'Once',
          isSingleUse: true,
        }
        ctx.Modules.hooks.fire
          .withArgs('getPaymentFromRecord', ctx.individualSubscription)
          .yields(null, [
            {
              subscription: ctx.paymentRecord,
              account: new PaymentProviderAccount({
                email: 'example@example.com',
                hasPastDueInvoice: false,
              }),
              coupons: [foreverCoupon, singleUseCoupon],
            },
          ])
        const result =
          await ctx.SubscriptionViewModelBuilder.promises.buildUsersSubscriptionViewModel(
            ctx.user
          )
        assert.deepEqual(result.personalSubscription.payment.activeCoupons, [
          foreverCoupon,
        ])
      })

      describe('isEligibleForGroupPlan', function () {
        it('is false when in trial', async function (ctx) {
          const msIn24Hours = 24 * 60 * 60 * 1000
          const tomorrow = new Date(Date.now() + msIn24Hours)
          ctx.paymentRecord.trialPeriodEnd = tomorrow
          ctx.paymentRecord.service = 'recurly'
          const result =
            await ctx.SubscriptionViewModelBuilder.promises.buildUsersSubscriptionViewModel(
              ctx.user
            )
          assert.isFalse(
            result.personalSubscription.payment.isEligibleForGroupPlan
          )
        })

        it('is true when not in trial', async function (ctx) {
          const result =
            await ctx.SubscriptionViewModelBuilder.promises.buildUsersSubscriptionViewModel(
              ctx.user
            )
          assert.isTrue(
            result.personalSubscription.payment.isEligibleForGroupPlan
          )
        })
      })

      describe('isEligibleForPause', function () {
        beforeEach(function (ctx) {
          ctx.paymentRecord.service = 'recurly'
          ctx.paymentRecord.addOns = []
          ctx.paymentRecord.planCode = 'plan-code'
          ctx.paymentRecord.trialPeriodEnd = null
          ctx.individualSubscription.pendingPlan = undefined
          ctx.individualSubscription.groupPlan = undefined
        })

        it('is false for Stripe subscriptions when feature flag is disabled', async function (ctx) {
          ctx.paymentRecord.service = 'stripe-us'
          ctx.SplitTestHandler.promises.getAssignmentForUser
            .withArgs(ctx.user._id, 'stripe-pause')
            .resolves({ variant: 'default' })
          const result =
            await ctx.SubscriptionViewModelBuilder.promises.buildUsersSubscriptionViewModel(
              ctx.user
            )
          assert.isFalse(result.personalSubscription.payment.isEligibleForPause)
        })

        it('is true for Stripe subscriptions when feature flag is enabled', async function (ctx) {
          ctx.paymentRecord.service = 'stripe-us'
          ctx.SplitTestHandler.promises.getAssignmentForUser
            .withArgs(ctx.user._id, 'stripe-pause')
            .resolves({ variant: 'enabled' })
          const result =
            await ctx.SubscriptionViewModelBuilder.promises.buildUsersSubscriptionViewModel(
              ctx.user
            )
          assert.isTrue(result.personalSubscription.payment.isEligibleForPause)
        })

        it('is false for Stripe subscriptions with pending plan even when feature flag is enabled', async function (ctx) {
          ctx.paymentRecord.service = 'stripe-us'
          ctx.individualSubscription.pendingPlan = {} // anything
          ctx.SplitTestHandler.promises.getAssignmentForUser
            .withArgs(ctx.user._id, 'stripe-pause')
            .resolves({ variant: 'enabled' })
          const result =
            await ctx.SubscriptionViewModelBuilder.promises.buildUsersSubscriptionViewModel(
              ctx.user
            )
          assert.isFalse(result.personalSubscription.payment.isEligibleForPause)
        })

        it('is false for Stripe subscriptions with annual plan even when feature flag is enabled', async function (ctx) {
          ctx.paymentRecord.service = 'stripe-us'
          ctx.paymentRecord.planCode = 'collaborator-annual'
          ctx.SplitTestHandler.promises.getAssignmentForUser
            .withArgs(ctx.user._id, 'stripe-pause')
            .resolves({ variant: 'enabled' })
          const result =
            await ctx.SubscriptionViewModelBuilder.promises.buildUsersSubscriptionViewModel(
              ctx.user
            )
          assert.isFalse(result.personalSubscription.payment.isEligibleForPause)
        })

        it('is false for subscriptions with pending plan', async function (ctx) {
          ctx.paymentRecord.service = 'recurly'
          ctx.individualSubscription.pendingPlan = {} // anything
          const result =
            await ctx.SubscriptionViewModelBuilder.promises.buildUsersSubscriptionViewModel(
              ctx.user
            )
          assert.isFalse(result.personalSubscription.payment.isEligibleForPause)
        })

        it('is false for a group subscription', async function (ctx) {
          ctx.paymentRecord.service = 'recurly'
          ctx.individualSubscription.groupPlan = true
          const result =
            await ctx.SubscriptionViewModelBuilder.promises.buildUsersSubscriptionViewModel(
              ctx.user
            )
          assert.isFalse(result.personalSubscription.payment.isEligibleForPause)
        })

        it('is false when in trial', async function (ctx) {
          ctx.paymentRecord.service = 'recurly'
          const msIn24Hours = 24 * 60 * 60 * 1000
          const tomorrow = new Date(Date.now() + msIn24Hours)
          ctx.paymentRecord.trialPeriodEnd = tomorrow
          const result =
            await ctx.SubscriptionViewModelBuilder.promises.buildUsersSubscriptionViewModel(
              ctx.user
            )
          assert.isFalse(result.personalSubscription.payment.isEligibleForPause)
        })

        it('is false for annual subscriptions', async function (ctx) {
          ctx.paymentRecord.service = 'recurly'
          ctx.paymentRecord.planCode = 'collaborator-annual'
          const result =
            await ctx.SubscriptionViewModelBuilder.promises.buildUsersSubscriptionViewModel(
              ctx.user
            )
          assert.isFalse(result.personalSubscription.payment.isEligibleForPause)
        })

        it('is false for subscriptions with add-ons', async function (ctx) {
          ctx.paymentRecord.service = 'recurly'
          ctx.paymentRecord.addOns = [{}] // anything
          const result =
            await ctx.SubscriptionViewModelBuilder.promises.buildUsersSubscriptionViewModel(
              ctx.user
            )
          assert.isFalse(result.personalSubscription.payment.isEligibleForPause)
        })

        it('is true when conditions are met', async function (ctx) {
          ctx.paymentRecord.service = 'recurly'
          ctx.paymentRecord.addOns = []
          const result =
            await ctx.SubscriptionViewModelBuilder.promises.buildUsersSubscriptionViewModel(
              ctx.user
            )
          assert.isTrue(result.personalSubscription.payment.isEligibleForPause)
        })
      })

      describe('isEligibleForDowngradeUpsell', function () {
        it('is true for eligible individual subscriptions', async function (ctx) {
          ctx.paymentRecord.pausePeriodStart = null
          ctx.paymentRecord.remainingPauseCycles = null
          ctx.paymentRecord.trialPeriodEnd = null
          ctx.paymentRecord.service = 'recurly'
          const result =
            await ctx.SubscriptionViewModelBuilder.promises.buildUsersSubscriptionViewModel(
              ctx.user
            )
          assert.isTrue(
            result.personalSubscription.payment.isEligibleForDowngradeUpsell
          )
        })

        it('is false for group plans', async function (ctx) {
          ctx.individualSubscription.planCode = ctx.groupPlanCode
          ctx.paymentRecord.pausePeriodStart = null
          ctx.paymentRecord.remainingPauseCycles = null
          ctx.paymentRecord.trialPeriodEnd = null
          ctx.paymentRecord.service = 'recurly'
          const result =
            await ctx.SubscriptionViewModelBuilder.promises.buildUsersSubscriptionViewModel(
              ctx.user
            )
          assert.isFalse(
            result.personalSubscription.payment.isEligibleForDowngradeUpsell
          )
        })

        it('is false for annual individual plans', async function (ctx) {
          ctx.individualSubscription.planCode = ctx.annualPlanCode
          ctx.paymentRecord.pausePeriodStart = null
          ctx.paymentRecord.remainingPauseCycles = null
          ctx.paymentRecord.trialPeriodEnd = null
          ctx.paymentRecord.service = 'recurly'
          const result =
            await ctx.SubscriptionViewModelBuilder.promises.buildUsersSubscriptionViewModel(
              ctx.user
            )
          assert.isFalse(
            result.personalSubscription.payment.isEligibleForDowngradeUpsell
          )
        })

        it('is false for paused plans', async function (ctx) {
          ctx.paymentRecord.pausePeriodStart = new Date()
          ctx.paymentRecord.remainingPauseCycles = 1
          ctx.paymentRecord.trialPeriodEnd = null
          ctx.paymentRecord.service = 'recurly'
          const result =
            await ctx.SubscriptionViewModelBuilder.promises.buildUsersSubscriptionViewModel(
              ctx.user
            )
          assert.isFalse(
            result.personalSubscription.payment.isEligibleForDowngradeUpsell
          )
        })

        it('is false for plans in free trial period', async function (ctx) {
          ctx.paymentRecord.pausePeriodStart = null
          ctx.paymentRecord.remainingPauseCycles = null
          ctx.paymentRecord.trialPeriodEnd = new Date(
            Date.now() + 24 * 60 * 60 * 1000 // tomorrow
          )
          ctx.paymentRecord.service = 'recurly'
          const result =
            await ctx.SubscriptionViewModelBuilder.promises.buildUsersSubscriptionViewModel(
              ctx.user
            )
          assert.isFalse(
            result.personalSubscription.payment.isEligibleForDowngradeUpsell
          )
        })

        it('is false for Stripe subscriptions', async function (ctx) {
          ctx.paymentRecord.pausePeriodStart = null
          ctx.paymentRecord.remainingPauseCycles = null
          ctx.paymentRecord.trialPeriodEnd = null
          ctx.paymentRecord.service = 'stripe-us'
          const result =
            await ctx.SubscriptionViewModelBuilder.promises.buildUsersSubscriptionViewModel(
              ctx.user
            )
          assert.isFalse(
            result.personalSubscription.payment.isEligibleForDowngradeUpsell
          )
        })
      })

      it('includes pending changes', async function (ctx) {
        ctx.paymentRecord.pendingChange = new PaymentProviderSubscriptionChange(
          {
            subscription: ctx.paymentRecord,
            nextPlanCode: ctx.groupPlanCode,
            nextPlanName: 'Group Collaborator (Annual) 4 licenses',
            nextPlanPrice: 1400,
            nextAddOns: [
              new PaymentProviderSubscriptionAddOn({
                code: 'additional-license',
                name: 'additional license',
                quantity: 8,
                unitPrice: 24.4,
              }),
              new PaymentProviderSubscriptionAddOn({
                code: 'addon-code',
                name: 'addon name',
                quantity: 1,
                unitPrice: 2,
              }),
            ],
          }
        )
        ctx.Modules.hooks.fire
          .withArgs('getPaymentFromRecord', ctx.individualSubscription)
          .yields(null, [
            {
              subscription: ctx.paymentRecord,
              account: {},
              coupons: [],
            },
          ])
        const result =
          await ctx.SubscriptionViewModelBuilder.promises.buildUsersSubscriptionViewModel(
            ctx.user
          )
        assert.equal(result.personalSubscription.payment.displayPrice, '€16.50')
        assert.equal(
          result.personalSubscription.payment.planOnlyDisplayPrice,
          '€14.30'
        )
        assert.deepEqual(
          result.personalSubscription.payment
            .addOnDisplayPricesWithoutAdditionalLicense,
          { 'addon-code': '€2.20' }
        )
        assert.equal(
          result.personalSubscription.payment.pendingAdditionalLicenses,
          8
        )
        assert.equal(
          result.personalSubscription.payment.pendingTotalLicenses,
          12
        )
      })

      it('does not add a billing details link for a Stripe subscription', async function (ctx) {
        ctx.paymentRecord.service = 'stripe-us'
        ctx.Modules.hooks.fire
          .withArgs('getPaymentFromRecord', ctx.individualSubscription)
          .yields(null, [
            {
              subscription: ctx.paymentRecord,
              account: new PaymentProviderAccount({}),
              coupons: [],
            },
          ])
        const result =
          await ctx.SubscriptionViewModelBuilder.promises.buildUsersSubscriptionViewModel(
            ctx.user
          )
        assert.equal(
          result.personalSubscription.payment.billingDetailsLink,
          undefined
        )
        assert.equal(
          result.personalSubscription.payment.accountManagementLink,
          '/user/subscription/payment/account-management'
        )
      })
    })
  })
})
