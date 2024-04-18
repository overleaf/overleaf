const GroupPlansData = require('./GroupPlansData')
const Settings = require('@overleaf/settings')

/**
 * If the user changes to a less expensive plan, we shouldn't apply the change immediately.
 * This is to avoid unintended/artifical credits on users Recurly accounts.
 */
function shouldPlanChangeAtTermEnd(oldPlan, newPlan) {
  return oldPlan.price_in_cents > newPlan.price_in_cents
}

/**
 * @typedef {import('../../../../frontend/js/shared/utils/currency').CurrencyCode} CurrencyCode
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

function formatCurrencyDefault(amount, recommendedCurrency) {
  const currencySymbols = Settings.groupPlanModalOptions.currencySymbols
  const recommendedCurrencySymbol = currencySymbols[recommendedCurrency]

  switch (recommendedCurrency) {
    case 'CHF': {
      return `${recommendedCurrencySymbol} ${amount}`
    }
    case 'DKK':
    case 'NOK':
    case 'SEK':
      return `${amount} ${recommendedCurrencySymbol}`
    default:
      return `${recommendedCurrencySymbol}${amount}`
  }
}

module.exports = {
  formatCurrencyDefault,
  shouldPlanChangeAtTermEnd,
  generateInitialLocalizedGroupPrice,
}
