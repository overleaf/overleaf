import { expect } from 'chai'
import { createLocalizedGroupPlanPrice } from '../../../../frontend/js/features/plans/utils/group-plan-pricing'
import { formatCurrencyLocalized } from '@/shared/utils/currency'

describe('group-plan-pricing', function () {
  beforeEach(function () {
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
    window.metaAttributesCache.set('ol-i18n', { currentLangCode: 'en' })
  })

  describe('createLocalizedGroupPlanPrice', function () {
    describe('CHF currency', function () {
      it('should return the correct localized price', function () {
        const localizedGroupPlanPrice = createLocalizedGroupPlanPrice({
          plan: 'professional',
          currency: 'CHF',
          licenseSize: '2',
          usage: 'enterprise',
          formatCurrency: formatCurrencyLocalized,
        })

        expect(localizedGroupPlanPrice).to.deep.equal({
          localizedPrice: 'CHF 100',
          localizedPerUserPrice: 'CHF 50',
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
          formatCurrency: formatCurrencyLocalized,
        })

        expect(localizedGroupPlanPrice).to.deep.equal({
          localizedPrice: 'kr 200',
          localizedPerUserPrice: 'kr 100',
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
          formatCurrency: formatCurrencyLocalized,
        })

        expect(localizedGroupPlanPrice).to.deep.equal({
          localizedPrice: '$300',
          localizedPerUserPrice: '$150',
        })
      })
    })
  })
})
