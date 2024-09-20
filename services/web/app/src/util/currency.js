/**
 * This file is duplicated from services/web/frontend/js/shared/utils/currency.ts
 */

/**
 * @import { CurrencyCode } from '@/shared/utils/currency'
 */

/**
 * @param {number} amount
 * @param {CurrencyCode} currency
 * @param {string} locale
 * @param {boolean} stripIfInteger
 * @returns {string}
 */
function formatCurrencyLocalized(amount, currency, locale, stripIfInteger) {
  const options = { style: 'currency', currency }
  if (stripIfInteger && Number.isInteger(amount)) {
    options.minimumFractionDigits = 0
  }

  try {
    return amount.toLocaleString(locale, {
      ...options,
      currencyDisplay: 'narrowSymbol',
    })
  } catch {}

  try {
    return amount.toLocaleString(locale, options)
  } catch {}

  return `${currency} ${amount}`
}

module.exports = {
  formatCurrencyLocalized,
}
