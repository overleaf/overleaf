const dateformat = require('dateformat')
const { formatCurrency } = require('../../util/currency')

/**
 * @param {number} priceInCents - price in the smallest currency unit (e.g. dollar cents, CLP units, ...)
 * @param {CurrencyCode?} currency - currency code (default to USD)
 * @param {string} [locale] - locale string
 * @returns {string} - formatted price
 */
function formatPriceLocalized(priceInCents, currency = 'USD', locale) {
  const isNoCentsCurrency = ['CLP', 'JPY', 'KRW', 'VND'].includes(currency)

  const priceInCurrencyUnit = isNoCentsCurrency
    ? priceInCents
    : priceInCents / 100

  return formatCurrency(priceInCurrencyUnit, currency, locale)
}

function formatDateTime(date) {
  if (!date) {
    return null
  }
  return dateformat(date, 'mmmm dS, yyyy h:MM TT Z', true)
}

function formatDate(date) {
  if (!date) {
    return null
  }
  return dateformat(date, 'mmmm dS, yyyy', true)
}

module.exports = {
  formatPriceLocalized,
  formatDateTime,
  formatDate,
}
