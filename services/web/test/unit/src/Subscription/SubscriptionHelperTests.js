const SandboxedModule = require('sandboxed-module')
const { expect } = require('chai')
const sinon = require('sinon')
const modulePath =
  '../../../../app/src/Features/Subscription/SubscriptionHelper'

const plans = {
  expensive: {
    planCode: 'expensive',
    price_in_cents: 1500,
  },
  cheaper: {
    planCode: 'cheaper',
    price_in_cents: 500,
  },
  alsoCheap: {
    plancode: 'also-cheap',
    price_in_cents: 500,
  },
  expensiveGroup: {
    plancode: 'group_expensive',
    price_in_cents: 49500,
    groupPlan: true,
  },
  cheapGroup: {
    plancode: 'group_cheap',
    price_in_cents: 1000,
    groupPlan: true,
  },
  bad: {},
}

describe('SubscriptionHelper', function () {
  beforeEach(function () {
    this.clock = sinon.useFakeTimers(new Date('2023-06-15T10:00:00Z'))
    this.Subscription = {
      findOne: sinon.stub().returns({
        exec: sinon.stub().resolves(),
      }),
      updateOne: sinon.stub().returns({
        exec: sinon.stub().resolves(),
      }),
      find: sinon.stub().returns({
        populate: sinon.stub().returns({
          populate: sinon.stub().returns({
            exec: sinon.stub().resolves([]),
          }),
        }),
        exec: sinon.stub().resolves(),
      }),
    }
    this.INITIAL_LICENSE_SIZE = 2
    this.settings = {
      groupPlanModalOptions: {},
    }
    this.GroupPlansData = {
      enterprise: {
        collaborator: {
          CHF: {
            [this.INITIAL_LICENSE_SIZE]: {
              price_in_cents: 1000,
            },
          },
          DKK: {
            [this.INITIAL_LICENSE_SIZE]: {
              price_in_cents: 2000,
            },
          },
          SEK: {
            [this.INITIAL_LICENSE_SIZE]: {
              price_in_cents: 3000,
            },
          },
          NOK: {
            [this.INITIAL_LICENSE_SIZE]: {
              price_in_cents: 4000,
            },
          },
          USD: {
            [this.INITIAL_LICENSE_SIZE]: {
              price_in_cents: 5000,
            },
          },
        },
        professional: {
          CHF: {
            [this.INITIAL_LICENSE_SIZE]: {
              price_in_cents: 10000,
            },
          },
          DKK: {
            [this.INITIAL_LICENSE_SIZE]: {
              price_in_cents: 20000,
            },
          },
          SEK: {
            [this.INITIAL_LICENSE_SIZE]: {
              price_in_cents: 30000,
            },
          },
          NOK: {
            [this.INITIAL_LICENSE_SIZE]: {
              price_in_cents: 40000,
            },
          },
          USD: {
            [this.INITIAL_LICENSE_SIZE]: {
              price_in_cents: 50000,
            },
          },
        },
      },
    }
    this.SubscriptionHelper = SandboxedModule.require(modulePath, {
      globals: {
        Date: this.clock.Date,
      },
      requires: {
        '../../models/Subscription': {
          Subscription: this.Subscription,
        },
        '@overleaf/settings': this.settings,
        './GroupPlansData': this.GroupPlansData,
      },
    })
  })

  describe('shouldPlanChangeAtTermEnd', function () {
    it('should return false if isInTrial is true', function () {
      const isInTrial = true
      const changeAtTermEnd = this.SubscriptionHelper.shouldPlanChangeAtTermEnd(
        plans.expensive,
        plans.cheaper,
        isInTrial
      )
      expect(changeAtTermEnd).to.be.false
    })

    it('should return true if the new plan is less expensive', function () {
      const isInTrial = false
      const changeAtTermEnd = this.SubscriptionHelper.shouldPlanChangeAtTermEnd(
        plans.expensive,
        plans.cheaper,
        isInTrial
      )
      expect(changeAtTermEnd).to.be.true
    })

    it('should return false if the new plan is more exepensive', function () {
      const isInTrial = false
      const changeAtTermEnd = this.SubscriptionHelper.shouldPlanChangeAtTermEnd(
        plans.cheaper,
        plans.expensive,
        isInTrial
      )
      expect(changeAtTermEnd).to.be.false
    })

    it('should return false if the new plan is the same price', function () {
      const isInTrial = false

      const changeAtTermEnd = this.SubscriptionHelper.shouldPlanChangeAtTermEnd(
        plans.cheaper,
        plans.alsoCheap,
        isInTrial
      )
      expect(changeAtTermEnd).to.be.false
    })

    it('should return false if the change is from an individual plan to a more expensive group plan', function () {
      const isInTrial = false

      const changeAtTermEnd = this.SubscriptionHelper.shouldPlanChangeAtTermEnd(
        plans.expensive,
        plans.expensiveGroup,
        isInTrial
      )
      expect(changeAtTermEnd).to.be.false
    })

    it('should return true if the change is from an individual plan to a cheaper group plan', function () {
      const isInTrial = false

      const changeAtTermEnd = this.SubscriptionHelper.shouldPlanChangeAtTermEnd(
        plans.expensive,
        plans.cheapGroup,
        isInTrial
      )
      expect(changeAtTermEnd).to.be.true
    })
  })

  describe('generateInitialLocalizedGroupPrice', function () {
    describe('CHF currency', function () {
      it('should return the correct localized price for every plan', function () {
        const localizedPrice =
          this.SubscriptionHelper.generateInitialLocalizedGroupPrice(
            'CHF',
            'fr'
          )

        expect(localizedPrice).to.deep.equal({
          price: {
            collaborator: '10 CHF',
            professional: '100 CHF',
          },
          pricePerUser: {
            collaborator: '5 CHF',
            professional: '50 CHF',
          },
        })
      })
    })

    describe('DKK currency', function () {
      it('should return the correct localized price for every plan', function () {
        const localizedPrice =
          this.SubscriptionHelper.generateInitialLocalizedGroupPrice(
            'DKK',
            'da'
          )

        expect(localizedPrice).to.deep.equal({
          price: {
            collaborator: '20 kr.',
            professional: '200 kr.',
          },
          pricePerUser: {
            collaborator: '10 kr.',
            professional: '100 kr.',
          },
        })
      })
    })

    describe('SEK currency', function () {
      it('should return the correct localized price for every plan', function () {
        const localizedPrice =
          this.SubscriptionHelper.generateInitialLocalizedGroupPrice(
            'SEK',
            'sv'
          )

        expect(localizedPrice).to.deep.equal({
          price: {
            collaborator: '30 kr',
            professional: '300 kr',
          },
          pricePerUser: {
            collaborator: '15 kr',
            professional: '150 kr',
          },
        })
      })
    })

    describe('NOK currency', function () {
      it('should return the correct localized price for every plan', function () {
        const localizedPrice =
          this.SubscriptionHelper.generateInitialLocalizedGroupPrice(
            'NOK',
            // there seem to be possible inconsistencies with the CI
            // maybe it depends on what languages are installed on the server?
            'en'
          )

        expect(localizedPrice).to.deep.equal({
          price: {
            collaborator: 'kr 40',
            professional: 'kr 400',
          },
          pricePerUser: {
            collaborator: 'kr 20',
            professional: 'kr 200',
          },
        })
      })
    })

    describe('other supported currencies', function () {
      it('should return the correct localized price for every plan', function () {
        const localizedPrice =
          this.SubscriptionHelper.generateInitialLocalizedGroupPrice(
            'USD',
            'en'
          )

        expect(localizedPrice).to.deep.equal({
          price: {
            collaborator: '$50',
            professional: '$500',
          },
          pricePerUser: {
            collaborator: '$25',
            professional: '$250',
          },
        })
      })
    })
  })

  describe('isPaidSubscription', function () {
    it('should return true for a subscription with a recurly subscription id', function () {
      const result = this.SubscriptionHelper.isPaidSubscription({
        recurlySubscription_id: 'some-id',
      })
      expect(result).to.be.true
    })

    it('should return true for a subscription with a stripe subscription id', function () {
      const result = this.SubscriptionHelper.isPaidSubscription({
        paymentProvider: { subscriptionId: 'some-id' },
      })
      expect(result).to.be.true
    })

    it('should return false for a free subscription', function () {
      const result = this.SubscriptionHelper.isPaidSubscription({})
      expect(result).to.be.false
    })

    it('should return false for a missing subscription', function () {
      const result = this.SubscriptionHelper.isPaidSubscription()
      expect(result).to.be.false
    })
  })

  describe('isIndividualActivePaidSubscription', function () {
    it('should return true for an active recurly subscription', function () {
      const result = this.SubscriptionHelper.isIndividualActivePaidSubscription(
        {
          groupPlan: false,
          recurlyStatus: { state: 'active' },
          recurlySubscription_id: 'some-id',
        }
      )
      expect(result).to.be.true
    })

    it('should return true for an active stripe subscription', function () {
      const result = this.SubscriptionHelper.isIndividualActivePaidSubscription(
        {
          groupPlan: false,
          paymentProvider: { subscriptionId: 'sub_123', state: 'active' },
        }
      )
      expect(result).to.be.true
    })

    it('should return false for a canceled recurly subscription', function () {
      const result = this.SubscriptionHelper.isIndividualActivePaidSubscription(
        {
          groupPlan: false,
          recurlyStatus: { state: 'canceled' },
          recurlySubscription_id: 'some-id',
        }
      )
      expect(result).to.be.false
    })

    it('should return false for a canceled stripe subscription', function () {
      const result = this.SubscriptionHelper.isIndividualActivePaidSubscription(
        {
          groupPlan: false,
          paymentProvider: { state: 'canceled', subscriptionId: 'sub_123' },
        }
      )
      expect(result).to.be.false
    })

    it('should return false for a group plan subscription', function () {
      const result = this.SubscriptionHelper.isIndividualActivePaidSubscription(
        {
          groupPlan: true,
          recurlyStatus: { state: 'active' },
          recurlySubscription_id: 'some-id',
        }
      )
      expect(result).to.be.false
    })

    it('should return false for a free subscription', function () {
      const result = this.SubscriptionHelper.isIndividualActivePaidSubscription(
        {}
      )
      expect(result).to.be.false
    })

    it('should return false for a subscription with an empty string for recurlySubscription_id', function () {
      const result = this.SubscriptionHelper.isIndividualActivePaidSubscription(
        {
          groupPlan: false,
          recurlySubscription_id: '',
          recurlyStatus: { state: 'active' },
        }
      )
      expect(result).to.be.false
    })

    it('should return false for a subscription with an empty string for paymentProvider.subscriptionId', function () {
      const result = this.SubscriptionHelper.isIndividualActivePaidSubscription(
        {
          groupPlan: false,
          paymentProvider: { state: 'active', subscriptionId: '' },
        }
      )
      expect(result).to.be.false
    })

    it('should return false for a missing subscription', function () {
      const result = this.SubscriptionHelper.isPaidSubscription()
      expect(result).to.be.false
    })
  })

  describe('getPaymentProviderSubscriptionId', function () {
    it('should return the recurly subscription id if it exists', function () {
      const result = this.SubscriptionHelper.getPaymentProviderSubscriptionId({
        recurlySubscription_id: 'some-id',
      })
      expect(result).to.equal('some-id')
    })

    it('should return the payment provider subscription id if it exists', function () {
      const result = this.SubscriptionHelper.getPaymentProviderSubscriptionId({
        paymentProvider: { subscriptionId: 'sub_123' },
      })
      expect(result).to.equal('sub_123')
    })

    it('should return null if no subscription id exists', function () {
      const result = this.SubscriptionHelper.getPaymentProviderSubscriptionId(
        {}
      )
      expect(result).to.be.null
    })
  })

  describe('getPaidSubscriptionState', function () {
    it('should return the recurly state if it exists', function () {
      const result = this.SubscriptionHelper.getPaidSubscriptionState({
        recurlyStatus: { state: 'active' },
      })
      expect(result).to.equal('active')
    })

    it('should return the payment provider state if it exists', function () {
      const result = this.SubscriptionHelper.getPaidSubscriptionState({
        paymentProvider: { state: 'active' },
      })
      expect(result).to.equal('active')
    })

    it('should return null if no state exists', function () {
      const result = this.SubscriptionHelper.getPaidSubscriptionState({})
      expect(result).to.be.null
    })
  })

  describe('getSubscriptionTrialStartedAt', function () {
    it('should return the recurly trial start date if it exists', function () {
      const result = this.SubscriptionHelper.getSubscriptionTrialStartedAt({
        recurlySubscription_id: 'some-id',
        recurlyStatus: { trialStartedAt: new Date('2023-01-01') },
      })
      expect(result).to.deep.equal(new Date('2023-01-01'))
    })

    it('should return the payment provider trial start date if it exists', function () {
      const result = this.SubscriptionHelper.getSubscriptionTrialStartedAt({
        recurlyStatus: {},
        paymentProvider: { trialStartedAt: new Date('2023-01-01') },
      })
      expect(result).to.deep.equal(new Date('2023-01-01'))
    })

    it('should return undefined if no trial start date exists', function () {
      const result = this.SubscriptionHelper.getSubscriptionTrialStartedAt({})
      expect(result).to.be.undefined
    })
  })

  describe('getSubscriptionTrialEndsAt', function () {
    it('should return the recurly trial end date if it exists', function () {
      const result = this.SubscriptionHelper.getSubscriptionTrialEndsAt({
        recurlySubscription_id: 'some-id',
        recurlyStatus: { trialEndsAt: new Date('2023-01-01') },
      })
      expect(result).to.deep.equal(new Date('2023-01-01'))
    })

    it('should return the payment provider trial end date if it exists', function () {
      const result = this.SubscriptionHelper.getSubscriptionTrialEndsAt({
        recurlyStatus: {},
        paymentProvider: { trialEndsAt: new Date('2023-01-01') },
      })
      expect(result).to.deep.equal(new Date('2023-01-01'))
    })

    it('should return undefined if no trial end date exists', function () {
      const result = this.SubscriptionHelper.getSubscriptionTrialEndsAt({})
      expect(result).to.be.undefined
    })
  })

  describe('isInTrial', function () {
    it('should return false if trialEndsAt is null', function () {
      const result = this.SubscriptionHelper.isInTrial(null)
      expect(result).to.be.false
    })

    it('should return false if trialEndsAt is before now', function () {
      const tenDaysAgo = new Date()
      tenDaysAgo.setDate(tenDaysAgo.getDate() - 10)
      const result = this.SubscriptionHelper.isInTrial(tenDaysAgo)
      expect(result).to.be.false
    })

    it('should return true if trialEndsAt is after now', function () {
      const tenDaysFromNow = new Date()
      tenDaysFromNow.setDate(tenDaysFromNow.getDate() + 10)
      const result = this.SubscriptionHelper.isInTrial(tenDaysFromNow)
      expect(result).to.be.true
    })
  })

  describe('recomputeSubscriptionState', function () {
    beforeEach(function () {
      this.clock.now = new Date('2023-06-15T10:00:00Z')

      this.baseSubscription = {
        _id: 'subscription_id',
        paymentProvider: {
          service: 'stripe-test',
          subscriptionId: 'stripe_sub_123',
          state: 'active',
          pausePeriodStart: '2023-06-15T09:00:00Z',
          pausePeriodEnd: '2023-06-15T11:00:00Z',
        },
      }
    })

    describe('when subscription has no paymentProvider subscriptionId', function () {
      it('should return subscription unchanged', async function () {
        const subscription = { _id: 'subscription_id' }
        const result =
          await this.SubscriptionHelper.recomputeSubscriptionState(subscription)
        expect(result).to.equal(subscription)
      })
    })

    describe('when subscription has no pausePeriodStart', function () {
      it('should return subscription unchanged', async function () {
        const subscription = {
          _id: 'subscription_id',
          paymentProvider: {
            subscriptionId: 'stripe_sub_123',
            state: 'active',
          },
        }
        const result =
          await this.SubscriptionHelper.recomputeSubscriptionState(subscription)
        expect(result).to.equal(subscription)
      })
    })

    describe('when subscription should be paused', function () {
      describe('and current state is active', function () {
        it('should change state to paused', async function () {
          const subscription = { ...this.baseSubscription }
          const result =
            await this.SubscriptionHelper.recomputeSubscriptionState(
              subscription
            )

          expect(result.paymentProvider.state).to.equal('paused')
          expect(this.Subscription.updateOne).to.have.been.calledWith(
            { _id: 'subscription_id' },
            { 'paymentProvider.state': 'paused' }
          )
        })
      })

      describe('and current state is already paused', function () {
        it('should not change state', async function () {
          const subscription = {
            ...this.baseSubscription,
            paymentProvider: {
              ...this.baseSubscription.paymentProvider,
              state: 'paused',
            },
          }
          const result =
            await this.SubscriptionHelper.recomputeSubscriptionState(
              subscription
            )

          expect(result.paymentProvider.state).to.equal('paused')
          expect(this.Subscription.updateOne.called).to.be.false
        })
      })
    })

    describe('when subscription should not be paused', function () {
      describe('before pause period starts', function () {
        beforeEach(function () {
          this.clock.now = new Date('2023-06-15T08:00:00Z')
        })

        it('should keep active state unchanged', async function () {
          const subscription = { ...this.baseSubscription }
          const result =
            await this.SubscriptionHelper.recomputeSubscriptionState(
              subscription
            )

          expect(result.paymentProvider.state).to.equal('active')
          expect(this.Subscription.updateOne.called).to.be.false
        })
      })

      describe('after pause period ends', function () {
        beforeEach(function () {
          this.clock.now = new Date('2023-06-15T12:00:00Z')
        })

        describe('and current state is paused', function () {
          it('should change state to active', async function () {
            const subscription = {
              ...this.baseSubscription,
              paymentProvider: {
                ...this.baseSubscription.paymentProvider,
                state: 'paused',
              },
            }
            const result =
              await this.SubscriptionHelper.recomputeSubscriptionState(
                subscription
              )

            expect(result.paymentProvider.state).to.equal('active')
            expect(this.Subscription.updateOne).to.have.been.calledWith(
              { _id: 'subscription_id' },
              { 'paymentProvider.state': 'active' }
            )
          })
        })

        describe('and current state is already active', function () {
          it('should keep state unchanged', async function () {
            const subscription = { ...this.baseSubscription }
            const result =
              await this.SubscriptionHelper.recomputeSubscriptionState(
                subscription
              )

            expect(result.paymentProvider.state).to.equal('active')
            expect(this.Subscription.updateOne.called).to.be.false
          })
        })
      })
    })

    describe('when subscription has no pausePeriodEnd (indefinite pause)', function () {
      beforeEach(function () {
        this.baseSubscription.paymentProvider.pausePeriodEnd = undefined
      })

      it('should not transition to paused state when pausePeriodEnd is missing', async function () {
        const subscription = { ...this.baseSubscription }
        const result =
          await this.SubscriptionHelper.recomputeSubscriptionState(subscription)

        expect(result.paymentProvider.state).to.equal('active')
        expect(this.Subscription.updateOne.called).to.be.false
      })

      it('should keep paused state when already paused and no end date', async function () {
        const subscription = {
          ...this.baseSubscription,
          paymentProvider: {
            ...this.baseSubscription.paymentProvider,
            state: 'paused',
            pausePeriodEnd: undefined,
          },
        }
        const result =
          await this.SubscriptionHelper.recomputeSubscriptionState(subscription)

        expect(result.paymentProvider.state).to.equal('paused')
        expect(this.Subscription.updateOne.called).to.be.false
      })
    })
  })

  describe('getRecurlyCustomerAdminUrl', function () {
    beforeEach(function () {
      this.settings.siteUrl = 'https://www.overleaf.com'
    })

    it('should return production Recurly account URL', function () {
      const result =
        this.SubscriptionHelper.getRecurlyCustomerAdminUrl('user_789')
      expect(result).to.equal(
        'https://sharelatex.recurly.com/accounts/user_789'
      )
    })

    it('should return sandbox Recurly account URL for dev environment', function () {
      this.settings.siteUrl = 'https://dev-overleaf.com'
      const result =
        this.SubscriptionHelper.getRecurlyCustomerAdminUrl('user_789')
      expect(result).to.equal(
        'https://sharelatex-sandbox.recurly.com/accounts/user_789'
      )
    })

    it('should return sandbox Recurly account URL for staging environment', function () {
      this.settings.siteUrl = 'https://stag-overleaf.com'
      const result =
        this.SubscriptionHelper.getRecurlyCustomerAdminUrl('user_789')
      expect(result).to.equal(
        'https://sharelatex-sandbox.recurly.com/accounts/user_789'
      )
    })

    it('should return null if customerId is null', function () {
      const result = this.SubscriptionHelper.getRecurlyCustomerAdminUrl(null)
      expect(result).to.be.null
    })

    it('should return null if customerId is undefined', function () {
      const result =
        this.SubscriptionHelper.getRecurlyCustomerAdminUrl(undefined)
      expect(result).to.be.null
    })

    it('should handle empty string customerId', function () {
      const result = this.SubscriptionHelper.getRecurlyCustomerAdminUrl('')
      expect(result).to.equal('https://sharelatex.recurly.com/accounts/')
    })
  })

  describe('getStripeCustomerAdminUrl', function () {
    beforeEach(function () {
      this.settings.siteUrl = 'https://www.overleaf.com'
      this.settings.apis = {
        stripeUS: { accountId: 'acct_us_123' },
        stripeUK: { accountId: 'acct_uk_456' },
      }
    })

    describe('stripe-us', function () {
      it('should return production Stripe US customer URL', function () {
        const result = this.SubscriptionHelper.getStripeCustomerAdminUrl(
          'cus_us_789',
          'stripe-us'
        )
        expect(result).to.equal(
          'https://dashboard.stripe.com/acct_us_123/customers/cus_us_789'
        )
      })

      it('should return test Stripe US customer URL for dev environment', function () {
        this.settings.siteUrl = 'https://dev-overleaf.com'
        const result = this.SubscriptionHelper.getStripeCustomerAdminUrl(
          'cus_us_789',
          'stripe-us'
        )
        expect(result).to.equal(
          'https://dashboard.stripe.com/acct_us_123/test/customers/cus_us_789'
        )
      })

      it('should return test Stripe US customer URL for staging environment', function () {
        this.settings.siteUrl = 'https://stag-overleaf.com'
        const result = this.SubscriptionHelper.getStripeCustomerAdminUrl(
          'cus_us_789',
          'stripe-us'
        )
        expect(result).to.equal(
          'https://dashboard.stripe.com/acct_us_123/test/customers/cus_us_789'
        )
      })
    })

    describe('stripe-uk', function () {
      it('should return production Stripe UK customer URL', function () {
        const result = this.SubscriptionHelper.getStripeCustomerAdminUrl(
          'cus_uk_123',
          'stripe-uk'
        )
        expect(result).to.equal(
          'https://dashboard.stripe.com/acct_uk_456/customers/cus_uk_123'
        )
      })

      it('should return test Stripe UK customer URL for dev environment', function () {
        this.settings.siteUrl = 'https://dev-overleaf.com'
        const result = this.SubscriptionHelper.getStripeCustomerAdminUrl(
          'cus_uk_123',
          'stripe-uk'
        )
        expect(result).to.equal(
          'https://dashboard.stripe.com/acct_uk_456/test/customers/cus_uk_123'
        )
      })
    })

    it('should return null if accountId is missing', function () {
      this.settings.apis.stripeUS = {}
      const result = this.SubscriptionHelper.getStripeCustomerAdminUrl(
        'cus_us_789',
        'stripe-us'
      )
      expect(result).to.be.null
    })

    it('should return null if customerId is null', function () {
      const result = this.SubscriptionHelper.getStripeCustomerAdminUrl(
        null,
        'stripe-us'
      )
      expect(result).to.be.null
    })

    it('should return null if service is null', function () {
      const result = this.SubscriptionHelper.getStripeCustomerAdminUrl(
        'cus_us_789',
        null
      )
      expect(result).to.be.null
    })

    it('should return null if customerId is undefined', function () {
      const result = this.SubscriptionHelper.getStripeCustomerAdminUrl(
        undefined,
        'stripe-us'
      )
      expect(result).to.be.null
    })

    it('should return null if service is undefined', function () {
      const result = this.SubscriptionHelper.getStripeCustomerAdminUrl(
        'cus_us_789',
        undefined
      )
      expect(result).to.be.null
    })

    it('should return null if both customerId and service are null', function () {
      const result = this.SubscriptionHelper.getStripeCustomerAdminUrl(
        null,
        null
      )
      expect(result).to.be.null
    })

    it('should return null if accountId is missing for UK', function () {
      this.settings.apis.stripeUK = {}
      const result = this.SubscriptionHelper.getStripeCustomerAdminUrl(
        'cus_uk_789',
        'stripe-uk'
      )
      expect(result).to.be.null
    })

    it('should return null if apis object is missing', function () {
      this.settings.apis = {}
      const result = this.SubscriptionHelper.getStripeCustomerAdminUrl(
        'cus_us_789',
        'stripe-us'
      )
      expect(result).to.be.null
    })

    it('should handle empty string customerId', function () {
      const result = this.SubscriptionHelper.getStripeCustomerAdminUrl(
        '',
        'stripe-us'
      )
      expect(result).to.equal(
        'https://dashboard.stripe.com/acct_us_123/customers/'
      )
    })

    it('should return null if service is not stripe-us or stripe-uk', function () {
      const result = this.SubscriptionHelper.getStripeCustomerAdminUrl(
        'cus_us_789',
        'some-other-service'
      )
      expect(result).to.be.null
    })
  })
})
