const dateformat = require('dateformat')
const { formatCurrencyLocalized } = require('../../util/currency')

/**
 * @import { CurrencyCode } from '@/shared/utils/currency'
 */

const currencySymbols = {
  EUR: '€',
  USD: '$',
  GBP: '£',
  SEK: 'kr',
  CAD: '$',
  NOK: 'kr',
  DKK: 'kr',
  AUD: '$',
  NZD: '$',
  CHF: 'Fr',
  SGD: '$',
  INR: '₹',
  BRL: 'R$',
  MXN: '$',
  COP: '$',
  CLP: '$',
  PEN: 'S/',
}

function formatPriceDefault(priceInCents, currency) {
  if (!currency) {
    currency = 'USD'
  } else if (currency === 'CLP') {
    // CLP doesn't have minor units, recurly stores the whole major unit without cents
    return priceInCents.toLocaleString('es-CL', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
    })
  }
  let string = String(Math.round(priceInCents))
  if (string.length === 2) {
    string = `0${string}`
  }
  if (string.length === 1) {
    string = `00${string}`
  }
  if (string.length === 0) {
    string = '000'
  }
  const cents = string.slice(-2)
  const dollars = string.slice(0, -2)
  const symbol = currencySymbols[currency]
  return `${symbol}${dollars}.${cents}`
}

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

  return formatCurrencyLocalized(priceInCurrencyUnit, currency, locale)
}

function formatDate(date) {
  if (!date) {
    return null
  }
  return dateformat(date, 'mmmm dS, yyyy h:MM TT Z', true)
}

module.exports = {
  formatPriceDefault,
  formatPriceLocalized,
  formatDate,
}
