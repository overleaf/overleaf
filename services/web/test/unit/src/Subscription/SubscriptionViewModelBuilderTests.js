const SandboxedModule = require('sandboxed-module')
const sinon = require('sinon')
const { assert } = require('chai')
const {
  PaymentProviderAccount,
  PaymentProviderSubscription,
  PaymentProviderSubscriptionAddOn,
  PaymentProviderSubscriptionChange,
} = require('../../../../app/src/Features/Subscription/PaymentProviderEntities')
const SubscriptionHelper = require('../../../../app/src/Features/Subscription/SubscriptionHelper')

const modulePath =
  '../../../../app/src/Features/Subscription/SubscriptionViewModelBuilder'

describe('SubscriptionViewModelBuilder', function () {
  beforeEach(function () {
    this.user = { _id: '5208dd34438842e2db333333' }
    this.recurlySubscription_id = '123abc456def'
    this.planCode = 'collaborator_monthly'
    this.planFeatures = {
      compileGroup: 'priority',
      collaborators: -1,
      compileTimeout: 240,
    }
    this.plan = {
      planCode: this.planCode,
      features: this.planFeatures,
    }
    this.annualPlanCode = 'collaborator_annual'
    this.annualPlan = {
      planCode: this.annualPlanCode,
      features: this.planFeatures,
    }
    this.individualSubscription = {
      planCode: this.planCode,
      plan: this.plan,
      recurlySubscription_id: this.recurlySubscription_id,
      recurlyStatus: {
        state: 'active',
      },
    }
    this.paymentRecord = new PaymentProviderSubscription({
      id: this.recurlySubscription_id,
      userId: this.user._id,
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

    this.individualCustomSubscription = {
      planCode: this.planCode,
      plan: this.plan,
      recurlySubscription_id: this.recurlySubscription_id,
    }

    this.groupPlanCode = 'group_collaborator_monthly'
    this.groupPlanFeatures = {
      compileGroup: 'priority',
      collaborators: 10,
      compileTimeout: 240,
    }
    this.groupPlan = {
      planCode: this.groupPlanCode,
      features: this.groupPlanFeatures,
      membersLimit: 4,
      membersLimitAddOn: 'additional-license',
      groupPlan: true,
    }
    this.groupSubscription = {
      planCode: this.groupPlanCode,
      plan: this.plan,
      recurlyStatus: {
        state: 'active',
      },
    }

    this.commonsPlanCode = 'commons_license'
    this.commonsPlanFeatures = {
      compileGroup: 'priority',
      collaborators: '-1',
      compileTimeout: 240,
    }
    this.commonsPlan = {
      planCode: this.commonsPlanCode,
      features: this.commonsPlanFeatures,
    }
    this.commonsSubscription = {
      planCode: this.commonsPlanCode,
      plan: this.commonsPlan,
      name: 'Digital Science',
    }

    this.Settings = {
      institutionPlanCode: this.commonsPlanCode,
    }
    this.SubscriptionLocator = {
      promises: {
        getUsersSubscription: sinon.stub().resolves(),
        getMemberSubscriptions: sinon.stub().resolves(),
      },
      getUsersSubscription: sinon.stub().yields(),
      getMemberSubscriptions: sinon.stub().yields(null, []),
      getManagedGroupSubscriptions: sinon.stub().yields(null, []),
      findLocalPlanInSettings: sinon.stub(),
    }
    this.InstitutionsGetter = {
      promises: {
        getCurrentInstitutionsWithLicence: sinon.stub().resolves(),
      },
      getCurrentInstitutionsWithLicence: sinon.stub().yields(null, []),
      getManagedInstitutions: sinon.stub().yields(null, []),
    }
    this.InstitutionsManager = {
      promises: {
        fetchV1Data: sinon.stub().resolves(),
      },
    }
    this.PublishersGetter = {
      promises: {
        fetchV1Data: sinon.stub().resolves(),
      },
      getManagedPublishers: sinon.stub().yields(null, []),
    }
    this.RecurlyWrapper = {
      promises: {
        getSubscription: sinon.stub().resolves(),
      },
    }
    this.SubscriptionUpdater = {
      promises: {
        updateSubscriptionFromRecurly: sinon.stub().resolves(),
      },
    }
    this.PlansLocator = {
      findLocalPlanInSettings: sinon.stub(),
    }
    this.SplitTestHandler = {
      promises: {
        getAssignmentForUser: sinon.stub().resolves({ variant: 'default' }),
      },
    }
    this.SubscriptionViewModelBuilder = SandboxedModule.require(modulePath, {
      requires: {
        '@overleaf/settings': this.Settings,
        './SubscriptionLocator': this.SubscriptionLocator,
        '../Institutions/InstitutionsGetter': this.InstitutionsGetter,
        '../Institutions/InstitutionsManager': this.InstitutionsManager,
        './RecurlyWrapper': this.RecurlyWrapper,
        './SubscriptionUpdater': this.SubscriptionUpdater,
        './PlansLocator': this.PlansLocator,
        '../../infrastructure/Modules': (this.Modules = {
          promises: { hooks: { fire: sinon.stub().resolves([]) } },
          hooks: {
            fire: sinon.stub().yields(null, []),
          },
        }),
        './V1SubscriptionManager': {},
        '../Publishers/PublishersGetter': this.PublishersGetter,
        './SubscriptionHelper': SubscriptionHelper,
        '../SplitTests/SplitTestHandler': this.SplitTestHandler,
      },
    })

    this.PlansLocator.findLocalPlanInSettings
      .withArgs(this.planCode)
      .returns(this.plan)
      .withArgs(this.annualPlanCode)
      .returns(this.annualPlan)
      .withArgs(this.groupPlanCode)
      .returns(this.groupPlan)
      .withArgs(this.commonsPlanCode)
      .returns(this.commonsPlan)
  })

  describe('getUsersSubscriptionDetails', function () {
    it('should return a free plan when user has no subscription or affiliation', async function () {
      const { bestSubscription: usersBestSubscription } =
        await this.SubscriptionViewModelBuilder.promises.getUsersSubscriptionDetails(
          this.user
        )
      assert.deepEqual(usersBestSubscription, { type: 'free' })
    })

    describe('with a individual subscription only', function () {
      it('should return a individual subscription when user has non-Recurly one', async function () {
        this.SubscriptionLocator.promises.getUsersSubscription
          .withArgs(this.user)
          .resolves(this.individualCustomSubscription)

        const { bestSubscription: usersBestSubscription } =
          await this.SubscriptionViewModelBuilder.promises.getUsersSubscriptionDetails(
            this.user
          )

        assert.deepEqual(usersBestSubscription, {
          type: 'individual',
          subscription: this.individualCustomSubscription,
          plan: this.plan,
          remainingTrialDays: -1,
        })
      })

      it('should return a individual subscription when user has an active one', async function () {
        this.SubscriptionLocator.promises.getUsersSubscription
          .withArgs(this.user)
          .resolves(this.individualSubscription)

        const { bestSubscription: usersBestSubscription } =
          await this.SubscriptionViewModelBuilder.promises.getUsersSubscriptionDetails(
            this.user
          )

        assert.deepEqual(usersBestSubscription, {
          type: 'individual',
          subscription: this.individualSubscription,
          plan: this.plan,
          remainingTrialDays: -1,
        })
      })

      it('should return a individual subscription with remaining free trial days', async function () {
        const threeDaysLater = new Date()
        threeDaysLater.setDate(threeDaysLater.getDate() + 3)
        this.individualSubscription.recurlyStatus.trialEndsAt = threeDaysLater
        this.SubscriptionLocator.promises.getUsersSubscription
          .withArgs(this.user)
          .resolves(this.individualSubscription)

        const { bestSubscription: usersBestSubscription } =
          await this.SubscriptionViewModelBuilder.promises.getUsersSubscriptionDetails(
            this.user
          )

        assert.deepEqual(usersBestSubscription, {
          type: 'individual',
          subscription: this.individualSubscription,
          plan: this.plan,
          remainingTrialDays: 3,
        })
      })

      it('should return a individual subscription with free trial on last day', async function () {
        const threeHoursLater = new Date()
        threeHoursLater.setTime(threeHoursLater.getTime() + 3 * 60 * 60 * 1000)
        this.individualSubscription.recurlyStatus.trialEndsAt = threeHoursLater
        this.SubscriptionLocator.promises.getUsersSubscription
          .withArgs(this.user)
          .resolves(this.individualSubscription)

        const { bestSubscription: usersBestSubscription } =
          await this.SubscriptionViewModelBuilder.promises.getUsersSubscriptionDetails(
            this.user
          )

        assert.deepEqual(usersBestSubscription, {
          type: 'individual',
          subscription: this.individualSubscription,
          plan: this.plan,
          remainingTrialDays: 1,
        })
      })

      it('should update subscription if recurly payment state is missing', async function () {
        this.individualSubscriptionWithoutPaymentState = {
          planCode: this.planCode,
          plan: this.plan,
          recurlySubscription_id: this.recurlySubscription_id,
        }
        this.paymentRecord = {
          state: 'active',
        }
        this.SubscriptionLocator.promises.getUsersSubscription
          .withArgs(this.user)
          .onCall(0)
          .resolves(this.individualSubscriptionWithoutPaymentState)
          .withArgs(this.user)
          .onCall(1)
          .resolves(this.individualSubscription)
        const payment = {
          subscription: this.paymentRecord,
          account: new PaymentProviderAccount({}),
          coupons: [],
        }

        this.Modules.promises.hooks.fire
          .withArgs(
            'getPaymentFromRecordPromise',
            this.individualSubscriptionWithoutPaymentState
          )
          .resolves([payment])
        this.Modules.promises.hooks.fire
          .withArgs(
            'syncSubscription',
            payment,
            this.individualSubscriptionWithoutPaymentState
          )
          .resolves([])

        const { bestSubscription: usersBestSubscription } =
          await this.SubscriptionViewModelBuilder.promises.getUsersSubscriptionDetails(
            this.user
          )

        assert.deepEqual(usersBestSubscription, {
          type: 'individual',
          subscription: this.individualSubscription,
          plan: this.plan,
          remainingTrialDays: -1,
        })
        assert.isTrue(
          this.Modules.promises.hooks.fire.withArgs(
            'getPaymentFromRecordPromise',
            this.individualSubscriptionWithoutPaymentState
          ).calledOnce
        )
      })

      it('should update subscription if stripe payment state is missing', async function () {
        this.individualSubscriptionWithoutPaymentState = {
          planCode: this.planCode,
          plan: this.plan,
          paymentProvider: {
            subscriptionId: this.recurlySubscription_id,
          },
        }
        this.paymentRecord = {
          state: 'active',
        }
        this.SubscriptionLocator.promises.getUsersSubscription
          .withArgs(this.user)
          .onCall(0)
          .resolves(this.individualSubscriptionWithoutPaymentState)
          .withArgs(this.user)
          .onCall(1)
          .resolves(this.individualSubscription)
        const payment = {
          subscription: this.paymentRecord,
          account: new PaymentProviderAccount({}),
          coupons: [],
        }

        this.Modules.promises.hooks.fire
          .withArgs(
            'getPaymentFromRecordPromise',
            this.individualSubscriptionWithoutPaymentState
          )
          .resolves([payment])
        this.Modules.promises.hooks.fire
          .withArgs(
            'syncSubscription',
            payment,
            this.individualSubscriptionWithoutPaymentState
          )
          .resolves([])

        const { bestSubscription: usersBestSubscription } =
          await this.SubscriptionViewModelBuilder.promises.getUsersSubscriptionDetails(
            this.user
          )

        assert.deepEqual(usersBestSubscription, {
          type: 'individual',
          subscription: this.individualSubscription,
          plan: this.plan,
          remainingTrialDays: -1,
        })
        assert.isTrue(
          this.Modules.promises.hooks.fire.withArgs(
            'getPaymentFromRecordPromise',
            this.individualSubscriptionWithoutPaymentState
          ).calledOnce
        )
      })
    })

    it('should return a group subscription when user has one', async function () {
      this.SubscriptionLocator.promises.getMemberSubscriptions
        .withArgs(this.user)
        .resolves([this.groupSubscription])
      const { bestSubscription: usersBestSubscription } =
        await this.SubscriptionViewModelBuilder.promises.getUsersSubscriptionDetails(
          this.user
        )
      assert.deepEqual(usersBestSubscription, {
        type: 'group',
        subscription: {},
        plan: this.groupPlan,
        remainingTrialDays: -1,
      })
    })

    it('should return a group subscription with team name when user has one', async function () {
      this.SubscriptionLocator.promises.getMemberSubscriptions
        .withArgs(this.user)
        .resolves([
          Object.assign({}, this.groupSubscription, { teamName: 'test team' }),
        ])
      const { bestSubscription: usersBestSubscription } =
        await this.SubscriptionViewModelBuilder.promises.getUsersSubscriptionDetails(
          this.user
        )
      assert.deepEqual(usersBestSubscription, {
        type: 'group',
        subscription: { teamName: 'test team' },
        plan: this.groupPlan,
        remainingTrialDays: -1,
      })
    })

    it('should return a commons subscription when user has an institution affiliation', async function () {
      this.InstitutionsGetter.promises.getCurrentInstitutionsWithLicence
        .withArgs(this.user._id)
        .resolves([this.commonsSubscription])

      const { bestSubscription: usersBestSubscription } =
        await this.SubscriptionViewModelBuilder.promises.getUsersSubscriptionDetails(
          this.user
        )

      assert.deepEqual(usersBestSubscription, {
        type: 'commons',
        subscription: this.commonsSubscription,
        plan: this.commonsPlan,
      })
    })

    describe('with multiple subscriptions', function () {
      beforeEach(function () {
        this.SubscriptionLocator.promises.getUsersSubscription
          .withArgs(this.user)
          .resolves(this.individualSubscription)
        this.SubscriptionLocator.promises.getMemberSubscriptions
          .withArgs(this.user)
          .resolves([this.groupSubscription])
        this.InstitutionsGetter.promises.getCurrentInstitutionsWithLicence
          .withArgs(this.user._id)
          .resolves([this.commonsSubscription])
      })

      it('should return individual when the individual subscription has the best feature set', async function () {
        this.commonsPlan.features = {
          compileGroup: 'standard',
          collaborators: 1,
          compileTimeout: 60,
        }

        const { bestSubscription: usersBestSubscription } =
          await this.SubscriptionViewModelBuilder.promises.getUsersSubscriptionDetails(
            this.user
          )

        assert.deepEqual(usersBestSubscription, {
          type: 'individual',
          subscription: this.individualSubscription,
          plan: this.plan,
          remainingTrialDays: -1,
        })
      })

      it('should return group when the group subscription has the best feature set', async function () {
        this.plan.features = {
          compileGroup: 'standard',
          collaborators: 1,
          compileTimeout: 60,
        }
        this.commonsPlan.features = {
          compileGroup: 'standard',
          collaborators: 1,
          compileTimeout: 60,
        }

        const { bestSubscription: usersBestSubscription } =
          await this.SubscriptionViewModelBuilder.promises.getUsersSubscriptionDetails(
            this.user
          )

        assert.deepEqual(usersBestSubscription, {
          type: 'group',
          subscription: {},
          plan: this.groupPlan,
          remainingTrialDays: -1,
        })
      })

      it('should return commons when the commons affiliation has the best feature set', async function () {
        this.plan.features = {
          compileGroup: 'priority',
          collaborators: 5,
          compileTimeout: 240,
        }
        this.groupPlan.features = {
          compileGroup: 'standard',
          collaborators: 1,
          compileTimeout: 60,
        }
        this.commonsPlan.features = {
          compileGroup: 'priority',
          collaborators: -1,
          compileTimeout: 240,
        }

        const { bestSubscription: usersBestSubscription } =
          await this.SubscriptionViewModelBuilder.promises.getUsersSubscriptionDetails(
            this.user
          )

        assert.deepEqual(usersBestSubscription, {
          type: 'commons',
          subscription: this.commonsSubscription,
          plan: this.commonsPlan,
        })
      })

      it('should return individual with equal feature sets', async function () {
        this.plan.features = {
          compileGroup: 'priority',
          collaborators: -1,
          compileTimeout: 240,
        }
        this.groupPlan.features = {
          compileGroup: 'priority',
          collaborators: -1,
          compileTimeout: 240,
        }
        this.commonsPlan.features = {
          compileGroup: 'priority',
          collaborators: -1,
          compileTimeout: 240,
        }

        const { bestSubscription: usersBestSubscription } =
          await this.SubscriptionViewModelBuilder.promises.getUsersSubscriptionDetails(
            this.user
          )

        assert.deepEqual(usersBestSubscription, {
          type: 'individual',
          subscription: this.individualSubscription,
          plan: this.plan,
          remainingTrialDays: -1,
        })
      })

      it('should return group over commons with equal feature sets', async function () {
        this.plan.features = {
          compileGroup: 'standard',
          collaborators: 1,
          compileTimeout: 60,
        }
        this.groupPlan.features = {
          compileGroup: 'priority',
          collaborators: -1,
          compileTimeout: 240,
        }
        this.commonsPlan.features = {
          compileGroup: 'priority',
          collaborators: -1,
          compileTimeout: 240,
        }

        const { bestSubscription: usersBestSubscription } =
          await this.SubscriptionViewModelBuilder.promises.getUsersSubscriptionDetails(
            this.user
          )

        assert.deepEqual(usersBestSubscription, {
          type: 'group',
          subscription: {},
          plan: this.groupPlan,
          remainingTrialDays: -1,
        })
      })
    })
  })

  describe('buildUsersSubscriptionViewModel', function () {
    beforeEach(function () {
      this.SubscriptionLocator.getUsersSubscription.yields(
        null,
        this.individualSubscription
      )
      this.Modules.hooks.fire
        .withArgs('getPaymentFromRecord', this.individualSubscription)
        .yields(null, [
          {
            subscription: this.paymentRecord,
            account: new PaymentProviderAccount({}),
            coupons: [],
          },
        ])
    })

    describe('with a paid subscription', function () {
      it('adds payment data to the personal subscription', async function () {
        this.Modules.hooks.fire
          .withArgs('getPaymentFromRecord', this.individualSubscription)
          .yields(null, [
            {
              subscription: this.paymentRecord,
              account: new PaymentProviderAccount({
                email: 'example@example.com',
                hasPastDueInvoice: false,
              }),
              coupons: [],
            },
          ])
        const result =
          await this.SubscriptionViewModelBuilder.promises.buildUsersSubscriptionViewModel(
            this.user
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

      describe('isEligibleForGroupPlan', function () {
        it('is false for Stripe subscriptions', async function () {
          this.paymentRecord.service = 'stripe-us'
          this.Modules.promises.hooks.fire
            .withArgs('canUpgradeFromIndividualToGroup')
            .resolves([false])
          const result =
            await this.SubscriptionViewModelBuilder.promises.buildUsersSubscriptionViewModel(
              this.user
            )
          assert.isFalse(
            result.personalSubscription.payment.isEligibleForGroupPlan
          )
        })

        it('is false when in trial', async function () {
          const msIn24Hours = 24 * 60 * 60 * 1000
          const tomorrow = new Date(Date.now() + msIn24Hours)
          this.paymentRecord.trialPeriodEnd = tomorrow
          this.paymentRecord.service = 'recurly'
          const result =
            await this.SubscriptionViewModelBuilder.promises.buildUsersSubscriptionViewModel(
              this.user
            )
          assert.isFalse(
            result.personalSubscription.payment.isEligibleForGroupPlan
          )
        })

        it('is true when not in trial and for a Recurly subscription', async function () {
          this.paymentRecord.service = 'recurly'
          const result =
            await this.SubscriptionViewModelBuilder.promises.buildUsersSubscriptionViewModel(
              this.user
            )
          assert.isTrue(
            result.personalSubscription.payment.isEligibleForGroupPlan
          )
        })
      })

      describe('isEligibleForPause', function () {
        beforeEach(function () {
          this.paymentRecord.service = 'recurly'
          this.paymentRecord.addOns = []
          this.paymentRecord.planCode = 'plan-code'
          this.paymentRecord.trialPeriodEnd = null
          this.individualSubscription.pendingPlan = undefined
          this.individualSubscription.groupPlan = undefined
        })

        it('is false for Stripe subscriptions when feature flag is disabled', async function () {
          this.paymentRecord.service = 'stripe-us'
          this.SplitTestHandler.promises.getAssignmentForUser
            .withArgs(this.user._id, 'stripe-pause')
            .resolves({ variant: 'default' })
          const result =
            await this.SubscriptionViewModelBuilder.promises.buildUsersSubscriptionViewModel(
              this.user
            )
          assert.isFalse(result.personalSubscription.payment.isEligibleForPause)
        })

        it('is true for Stripe subscriptions when feature flag is enabled', async function () {
          this.paymentRecord.service = 'stripe-us'
          this.SplitTestHandler.promises.getAssignmentForUser
            .withArgs(this.user._id, 'stripe-pause')
            .resolves({ variant: 'enabled' })
          const result =
            await this.SubscriptionViewModelBuilder.promises.buildUsersSubscriptionViewModel(
              this.user
            )
          assert.isTrue(result.personalSubscription.payment.isEligibleForPause)
        })

        it('is false for Stripe subscriptions with pending plan even when feature flag is enabled', async function () {
          this.paymentRecord.service = 'stripe-us'
          this.individualSubscription.pendingPlan = {} // anything
          this.SplitTestHandler.promises.getAssignmentForUser
            .withArgs(this.user._id, 'stripe-pause')
            .resolves({ variant: 'enabled' })
          const result =
            await this.SubscriptionViewModelBuilder.promises.buildUsersSubscriptionViewModel(
              this.user
            )
          assert.isFalse(result.personalSubscription.payment.isEligibleForPause)
        })

        it('is false for Stripe subscriptions with annual plan even when feature flag is enabled', async function () {
          this.paymentRecord.service = 'stripe-us'
          this.paymentRecord.planCode = 'collaborator-annual'
          this.SplitTestHandler.promises.getAssignmentForUser
            .withArgs(this.user._id, 'stripe-pause')
            .resolves({ variant: 'enabled' })
          const result =
            await this.SubscriptionViewModelBuilder.promises.buildUsersSubscriptionViewModel(
              this.user
            )
          assert.isFalse(result.personalSubscription.payment.isEligibleForPause)
        })

        it('is false for subscriptions with pending plan', async function () {
          this.paymentRecord.service = 'recurly'
          this.individualSubscription.pendingPlan = {} // anything
          const result =
            await this.SubscriptionViewModelBuilder.promises.buildUsersSubscriptionViewModel(
              this.user
            )
          assert.isFalse(result.personalSubscription.payment.isEligibleForPause)
        })

        it('is false for a group subscription', async function () {
          this.paymentRecord.service = 'recurly'
          this.individualSubscription.groupPlan = true
          const result =
            await this.SubscriptionViewModelBuilder.promises.buildUsersSubscriptionViewModel(
              this.user
            )
          assert.isFalse(result.personalSubscription.payment.isEligibleForPause)
        })

        it('is false when in trial', async function () {
          this.paymentRecord.service = 'recurly'
          const msIn24Hours = 24 * 60 * 60 * 1000
          const tomorrow = new Date(Date.now() + msIn24Hours)
          this.paymentRecord.trialPeriodEnd = tomorrow
          const result =
            await this.SubscriptionViewModelBuilder.promises.buildUsersSubscriptionViewModel(
              this.user
            )
          assert.isFalse(result.personalSubscription.payment.isEligibleForPause)
        })

        it('is false for annual subscriptions', async function () {
          this.paymentRecord.service = 'recurly'
          this.paymentRecord.planCode = 'collaborator-annual'
          const result =
            await this.SubscriptionViewModelBuilder.promises.buildUsersSubscriptionViewModel(
              this.user
            )
          assert.isFalse(result.personalSubscription.payment.isEligibleForPause)
        })

        it('is false for subscriptions with add-ons', async function () {
          this.paymentRecord.service = 'recurly'
          this.paymentRecord.addOns = [{}] // anything
          const result =
            await this.SubscriptionViewModelBuilder.promises.buildUsersSubscriptionViewModel(
              this.user
            )
          assert.isFalse(result.personalSubscription.payment.isEligibleForPause)
        })

        it('is true when conditions are met', async function () {
          this.paymentRecord.service = 'recurly'
          this.paymentRecord.addOns = []
          const result =
            await this.SubscriptionViewModelBuilder.promises.buildUsersSubscriptionViewModel(
              this.user
            )
          assert.isTrue(result.personalSubscription.payment.isEligibleForPause)
        })
      })

      describe('isEligibleForDowngradeUpsell', function () {
        it('is true for eligible individual subscriptions', async function () {
          this.paymentRecord.pausePeriodStart = null
          this.paymentRecord.remainingPauseCycles = null
          this.paymentRecord.trialPeriodEnd = null
          this.paymentRecord.service = 'recurly'
          const result =
            await this.SubscriptionViewModelBuilder.promises.buildUsersSubscriptionViewModel(
              this.user
            )
          assert.isTrue(
            result.personalSubscription.payment.isEligibleForDowngradeUpsell
          )
        })

        it('is false for group plans', async function () {
          this.individualSubscription.planCode = this.groupPlanCode
          this.paymentRecord.pausePeriodStart = null
          this.paymentRecord.remainingPauseCycles = null
          this.paymentRecord.trialPeriodEnd = null
          this.paymentRecord.service = 'recurly'
          const result =
            await this.SubscriptionViewModelBuilder.promises.buildUsersSubscriptionViewModel(
              this.user
            )
          assert.isFalse(
            result.personalSubscription.payment.isEligibleForDowngradeUpsell
          )
        })

        it('is false for annual individual plans', async function () {
          this.individualSubscription.planCode = this.annualPlanCode
          this.paymentRecord.pausePeriodStart = null
          this.paymentRecord.remainingPauseCycles = null
          this.paymentRecord.trialPeriodEnd = null
          this.paymentRecord.service = 'recurly'
          const result =
            await this.SubscriptionViewModelBuilder.promises.buildUsersSubscriptionViewModel(
              this.user
            )
          assert.isFalse(
            result.personalSubscription.payment.isEligibleForDowngradeUpsell
          )
        })

        it('is false for paused plans', async function () {
          this.paymentRecord.pausePeriodStart = new Date()
          this.paymentRecord.remainingPauseCycles = 1
          this.paymentRecord.trialPeriodEnd = null
          this.paymentRecord.service = 'recurly'
          const result =
            await this.SubscriptionViewModelBuilder.promises.buildUsersSubscriptionViewModel(
              this.user
            )
          assert.isFalse(
            result.personalSubscription.payment.isEligibleForDowngradeUpsell
          )
        })

        it('is false for plans in free trial period', async function () {
          this.paymentRecord.pausePeriodStart = null
          this.paymentRecord.remainingPauseCycles = null
          this.paymentRecord.trialPeriodEnd = new Date(
            Date.now() + 24 * 60 * 60 * 1000 // tomorrow
          )
          this.paymentRecord.service = 'recurly'
          const result =
            await this.SubscriptionViewModelBuilder.promises.buildUsersSubscriptionViewModel(
              this.user
            )
          assert.isFalse(
            result.personalSubscription.payment.isEligibleForDowngradeUpsell
          )
        })

        it('is false for Stripe subscriptions', async function () {
          this.paymentRecord.pausePeriodStart = null
          this.paymentRecord.remainingPauseCycles = null
          this.paymentRecord.trialPeriodEnd = null
          this.paymentRecord.service = 'stripe-us'
          const result =
            await this.SubscriptionViewModelBuilder.promises.buildUsersSubscriptionViewModel(
              this.user
            )
          assert.isFalse(
            result.personalSubscription.payment.isEligibleForDowngradeUpsell
          )
        })
      })

      it('includes pending changes', async function () {
        this.paymentRecord.pendingChange =
          new PaymentProviderSubscriptionChange({
            subscription: this.paymentRecord,
            nextPlanCode: this.groupPlanCode,
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
          })
        this.Modules.hooks.fire
          .withArgs('getPaymentFromRecord', this.individualSubscription)
          .yields(null, [
            {
              subscription: this.paymentRecord,
              account: {},
              coupons: [],
            },
          ])
        const result =
          await this.SubscriptionViewModelBuilder.promises.buildUsersSubscriptionViewModel(
            this.user
          )
        assert.equal(
          result.personalSubscription.payment.displayPrice,
          '€1,756.92'
        )
        assert.equal(
          result.personalSubscription.payment.planOnlyDisplayPrice,
          '€1,754.72'
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

      it('does not add a billing details link for a Stripe subscription', async function () {
        this.paymentRecord.service = 'stripe-us'
        this.Modules.hooks.fire
          .withArgs('getPaymentFromRecord', this.individualSubscription)
          .yields(null, [
            {
              subscription: this.paymentRecord,
              account: new PaymentProviderAccount({}),
              coupons: [],
            },
          ])
        const result =
          await this.SubscriptionViewModelBuilder.promises.buildUsersSubscriptionViewModel(
            this.user
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
