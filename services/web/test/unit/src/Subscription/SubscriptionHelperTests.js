const SandboxedModule = require('sandboxed-module')
const { expect } = require('chai')
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
      requires: {
        '@overleaf/settings': this.settings,
        './GroupPlansData': this.GroupPlansData,
      },
    })
  })

  describe('shouldPlanChangeAtTermEnd', function () {
    it('should return true if the new plan is less expensive', function () {
      const changeAtTermEnd = this.SubscriptionHelper.shouldPlanChangeAtTermEnd(
        plans.expensive,
        plans.cheaper
      )
      expect(changeAtTermEnd).to.be.true
    })
    it('should return false if the new plan is more exepensive', function () {
      const changeAtTermEnd = this.SubscriptionHelper.shouldPlanChangeAtTermEnd(
        plans.cheaper,
        plans.expensive
      )
      expect(changeAtTermEnd).to.be.false
    })
    it('should return false if the new plan is the same price', function () {
      const changeAtTermEnd = this.SubscriptionHelper.shouldPlanChangeAtTermEnd(
        plans.cheaper,
        plans.alsoCheap
      )
      expect(changeAtTermEnd).to.be.false
    })
    it('should return false if the change is from an individual plan to a more expensive group plan', function () {
      const changeAtTermEnd = this.SubscriptionHelper.shouldPlanChangeAtTermEnd(
        plans.expensive,
        plans.expensiveGroup
      )
      expect(changeAtTermEnd).to.be.false
    })
    it('should return true if the change is from an individual plan to a cheaper group plan', function () {
      const changeAtTermEnd = this.SubscriptionHelper.shouldPlanChangeAtTermEnd(
        plans.expensive,
        plans.cheapGroup
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
          pricePerUserPerMonth: {
            collaborator: '0,45 CHF',
            professional: '4,20 CHF',
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
          pricePerUserPerMonth: {
            collaborator: '0,85 kr.',
            professional: '8,35 kr.',
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
          pricePerUserPerMonth: {
            collaborator: '1,25 kr',
            professional: '12,50 kr',
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
          pricePerUserPerMonth: {
            collaborator: 'kr 1.70',
            professional: 'kr 16.70',
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
          pricePerUserPerMonth: {
            collaborator: '$2.10',
            professional: '$20.85',
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
})
