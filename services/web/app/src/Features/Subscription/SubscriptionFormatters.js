/* eslint-disable
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const dateformat = require('dateformat')
const settings = require('settings-sharelatex')

const currenySymbols = {
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
  SGD: '$'
}

module.exports = {
  formatPrice(priceInCents, currency) {
    if (currency == null) {
      currency = 'USD'
    }
    let string = priceInCents + ''
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
    const symbol = currenySymbols[currency]
    return `${symbol}${dollars}.${cents}`
  },

  formatDate(date) {
    if (date == null) {
      return null
    }
    return dateformat(date, 'dS mmmm yyyy')
  }
}
