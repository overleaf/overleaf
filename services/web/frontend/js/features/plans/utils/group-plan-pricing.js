import getMeta from '../../../utils/meta'

/**
 * @import { CurrencyCode } from '../../../../../types/currency-code'
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
 * @param {(amount: number, currency: CurrencyCode, locale: string, includeSymbol: boolean) => string} opts.formatCurrency
 * @returns {{localizedPrice: string, localizedPerUserPrice: string}}
 */
export function createLocalizedGroupPlanPrice({
  plan,
  licenseSize,
  currency,
  usage,
  locale = getMeta('ol-i18n').currentLangCode || 'en',
  formatCurrency,
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

const LOCALES = {
  BRL: 'pt-BR',
  MXN: 'es-MX',
  COP: 'es-CO',
  CLP: 'es-CL',
  PEN: 'es-PE',
}

/**
 * @param {number} amount
 * @param {string} currency
 */
export function formatCurrencyDefault(amount, currency) {
  const currencySymbols = getMeta('ol-currencySymbols')

  const currencySymbol = currencySymbols[currency]

  switch (currency) {
    case 'BRL':
    case 'MXN':
    case 'COP':
    case 'CLP':
    case 'PEN':
      // Test using toLocaleString to format currencies for new LATAM regions
      return amount.toLocaleString(LOCALES[currency], {
        style: 'currency',
        currency,
        minimumFractionDigits: Number.isInteger(amount) ? 0 : null,
      })
    case 'CHF':
      return `${currencySymbol} ${amount}`
    case 'DKK':
    case 'SEK':
    case 'NOK':
      return `${amount} ${currencySymbol}`
    default: {
      return `${currencySymbol}${amount}`
    }
  }
}
