import { formatCurrency } from '@/shared/utils/currency'
import getMeta from '../../../utils/meta'

/**
 * @import { CurrencyCode } from '../../../../../types/subscription/currency'
 */

// plan: 'collaborator' or 'professional'
// the rest of available arguments can be seen in the groupPlans value
/**
 * @param {Object} opts
 * @param {'collaborator' | 'professional'} opts.plan
 * @param {string} opts.licenseSize
 * @param {CurrencyCode} opts.currency
 * @param {'enterprise' | 'educational'} opts.usage
 * @param {string} [opts.locale]
 * @returns {{localizedPrice: string, localizedPerUserPrice: string}}
 */
export function createLocalizedGroupPlanPrice({
  plan,
  licenseSize,
  currency,
  usage,
  locale = getMeta('ol-i18n').currentLangCode || 'en',
}) {
  const groupPlans = getMeta('ol-groupPlans')
  const priceInCents =
    groupPlans[usage][plan][currency][licenseSize].price_in_cents

  const price = priceInCents / 100
  const perUserPrice = price / parseInt(licenseSize)

  /**
   * @param {number} price
   * @returns {string}
   */
  const formatPrice = price => formatCurrency(price, currency, locale, true)

  return {
    localizedPrice: formatPrice(price),
    localizedPerUserPrice: formatPrice(perUserPrice),
  }
}
