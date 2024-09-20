const GroupPlansData = require('./GroupPlansData')

/**
 * If the user changes to a less expensive plan, we shouldn't apply the change immediately.
 * This is to avoid unintended/artifical credits on users Recurly accounts.
 */
function shouldPlanChangeAtTermEnd(oldPlan, newPlan) {
  return oldPlan.price_in_cents > newPlan.price_in_cents
}

/**
 * @import { CurrencyCode } from '../../../../frontend/js/shared/utils/currency'
 */

/**
 * @param {CurrencyCode} recommendedCurrency
 * @param {string} locale
 * @param {(amount: number, currency: CurrencyCode, locale: string, stripIfInteger: boolean) => string} formatCurrency
 * @returns {{ price: { collaborator: string, professional: string }, pricePerUser: { collaborator: string, professional: string } }} - localized group price
 */
function generateInitialLocalizedGroupPrice(
  recommendedCurrency,
  locale,
  formatCurrency
) {
  const INITIAL_LICENSE_SIZE = 2

  // the price is in cents, so divide by 100 to get the value
  const collaboratorPrice =
    GroupPlansData.enterprise.collaborator[recommendedCurrency][
      INITIAL_LICENSE_SIZE
    ].price_in_cents / 100
  const collaboratorPricePerUser = collaboratorPrice / INITIAL_LICENSE_SIZE
  const professionalPrice =
    GroupPlansData.enterprise.professional[recommendedCurrency][
      INITIAL_LICENSE_SIZE
    ].price_in_cents / 100
  const professionalPricePerUser = professionalPrice / INITIAL_LICENSE_SIZE

  /**
   * @param {number} price
   * @returns {string}
   */
  const formatPrice = price =>
    formatCurrency(price, recommendedCurrency, locale, true)

  return {
    price: {
      collaborator: formatPrice(collaboratorPrice),
      professional: formatPrice(professionalPrice),
    },
    pricePerUser: {
      collaborator: formatPrice(collaboratorPricePerUser),
      professional: formatPrice(professionalPricePerUser),
    },
  }
}

const currencies = {
  USD: {
    symbol: '$',
    placement: 'before',
  },
  EUR: {
    symbol: '€',
    placement: 'before',
  },
  GBP: {
    symbol: '£',
    placement: 'before',
  },
  SEK: {
    symbol: ' kr',
    placement: 'after',
  },
  CAD: {
    symbol: '$',
    placement: 'before',
  },
  NOK: {
    symbol: ' kr',
    placement: 'after',
  },
  DKK: {
    symbol: ' kr',
    placement: 'after',
  },
  AUD: {
    symbol: '$',
    placement: 'before',
  },
  NZD: {
    symbol: '$',
    placement: 'before',
  },
  CHF: {
    symbol: 'Fr ',
    placement: 'before',
  },
  SGD: {
    symbol: '$',
    placement: 'before',
  },
  INR: {
    symbol: '₹',
    placement: 'before',
  },
  BRL: {
    code: 'BRL',
    locale: 'pt-BR',
    symbol: 'R$ ',
    placement: 'before',
  },
  MXN: {
    code: 'MXN',
    locale: 'es-MX',
    symbol: '$ ',
    placement: 'before',
  },
  COP: {
    code: 'COP',
    locale: 'es-CO',
    symbol: '$ ',
    placement: 'before',
  },
  CLP: {
    code: 'CLP',
    locale: 'es-CL',
    symbol: '$ ',
    placement: 'before',
  },
  PEN: {
    code: 'PEN',
    locale: 'es-PE',
    symbol: 'S/ ',
    placement: 'before',
  },
}

function formatCurrencyDefault(amount, recommendedCurrency) {
  const currency = currencies[recommendedCurrency]

  // Test using toLocaleString to format currencies for new LATAM regions
  if (currency.locale && currency.code) {
    return amount.toLocaleString(currency.locale, {
      style: 'currency',
      currency: currency.code,
      minimumFractionDigits: 0,
    })
  }

  return currency.placement === 'before'
    ? `${currency.symbol}${amount}`
    : `${amount}${currency.symbol}`
}

module.exports = {
  formatCurrencyDefault,
  shouldPlanChangeAtTermEnd,
  generateInitialLocalizedGroupPrice,
}
