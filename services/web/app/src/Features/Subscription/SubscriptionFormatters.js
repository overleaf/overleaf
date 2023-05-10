const dateformat = require('dateformat')

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
}

module.exports = {
  formatPrice(priceInCents, currency) {
    if (!currency) {
      currency = 'USD'
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
  },

  formatDate(date) {
    if (!date) {
      return null
    }
    return dateformat(date, 'dS mmmm yyyy')
  },
}
