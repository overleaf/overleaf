/**
 * This file is duplicated from services/web/frontend/js/shared/utils/currency.ts
 */

/**
 * @typedef {import('@/shared/utils/currency').CurrencyCode} CurrencyCode
 */

/**
 * @param {number} amount
 * @param {CurrencyCode} currency
 * @param {string} locale
 * @param {boolean} stripIfInteger
 * @returns {string}
 */
function formatCurrencyLocalized(amount, currency, locale, stripIfInteger) {
  if (stripIfInteger && Number.isInteger(amount)) {
    return amount.toLocaleString(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      currencyDisplay: 'narrowSymbol',
    })
  }
  return amount.toLocaleString(locale, {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
  })
}

module.exports = {
  formatCurrencyLocalized,
}
