import { expect } from 'chai'
import { createLocalizedGroupPlanPrice } from '../../../../frontend/js/features/plans/utils/group-plan-pricing'

describe('group-plan-pricing', function () {
  beforeEach(function () {
    window.metaAttributesCache = window.metaAttributesCache || new Map()
    window.metaAttributesCache.set('ol-groupPlans', {
      enterprise: {
        professional: {
          CHF: {
            2: {
              price_in_cents: 10000,
            },
          },
          DKK: {
            2: {
              price_in_cents: 20000,
            },
          },
          USD: {
            2: {
              price_in_cents: 30000,
            },
          },
        },
      },
    })
    window.metaAttributesCache.set('ol-currencySymbols', {
      CHF: 'Fr',
      DKK: 'kr',
      USD: '$',
    })
  })

  afterEach(function () {
    window.metaAttributesCache = new Map()
  })

  describe('createLocalizedGroupPlanPrice', function () {
    describe('CHF currency', function () {
      it('should return the correct localized price', function () {
        const localizedGroupPlanPrice = createLocalizedGroupPlanPrice({
          plan: 'professional',
          currency: 'CHF',
          licenseSize: '2',
          usage: 'enterprise',
        })

        expect(localizedGroupPlanPrice).to.deep.equal({
          localizedPrice: 'Fr 100',
          localizedPerUserPrice: 'Fr 50',
        })
      })
    })
    describe('DKK currency', function () {
      it('should return the correct localized price', function () {
        const localizedGroupPlanPrice = createLocalizedGroupPlanPrice({
          plan: 'professional',
          currency: 'DKK',
          licenseSize: '2',
          usage: 'enterprise',
        })

        expect(localizedGroupPlanPrice).to.deep.equal({
          localizedPrice: '200 kr',
          localizedPerUserPrice: '100 kr',
        })
      })
    })
    describe('other supported currencies', function () {
      it('should return the correct localized price', function () {
        const localizedGroupPlanPrice = createLocalizedGroupPlanPrice({
          plan: 'professional',
          currency: 'USD',
          licenseSize: '2',
          usage: 'enterprise',
        })

        expect(localizedGroupPlanPrice).to.deep.equal({
          localizedPrice: '$300',
          localizedPerUserPrice: '$150',
        })
      })
    })
  })
})
