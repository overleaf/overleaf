const request = require('request')
const settings = require('settings-sharelatex')
const _ = require('underscore')
const logger = require('logger-sharelatex')
const URL = require('url')
const { promisify } = require('../util/promises')

const currencyMappings = {
  GB: 'GBP',
  US: 'USD',
  CH: 'CHF',
  NZ: 'NZD',
  AU: 'AUD',
  DK: 'DKK',
  NO: 'NOK',
  CA: 'CAD',
  SE: 'SEK',
}

// Countries which would likely prefer Euro's
const EuroCountries = [
  'AT',
  'BE',
  'BG',
  'HR',
  'CY',
  'CZ',
  'EE',
  'FI',
  'FR',
  'DE',
  'EL',
  'HU',
  'IE',
  'IT',
  'LV',
  'LT',
  'LU',
  'MT',
  'NL',
  'PL',
  'PT',
  'RO',
  'SK',
  'SI',
  'ES',
]

_.each(EuroCountries, country => (currencyMappings[country] = 'EUR'))

function getDetails(ip, callback) {
  if (!ip) {
    return callback(new Error('no ip passed'))
  }
  ip = ip.trim().split(' ')[0]
  const opts = {
    url: URL.resolve(settings.apis.geoIpLookup.url, ip),
    timeout: 1000,
    json: true,
  }
  logger.log({ ip, opts }, 'getting geo ip details')
  request.get(opts, function (err, res, ipDetails) {
    if (err) {
      logger.warn({ err, ip }, 'error getting ip details')
    }
    callback(err, ipDetails)
  })
}

function getCurrencyCode(ip, callback) {
  getDetails(ip, function (err, ipDetails) {
    if (err || !ipDetails) {
      logger.err(
        { err, ip },
        'problem getting currencyCode for ip, defaulting to USD'
      )
      return callback(null, 'USD')
    }
    const countryCode =
      ipDetails && ipDetails.country_code
        ? ipDetails.country_code.toUpperCase()
        : undefined
    const currencyCode = currencyMappings[countryCode] || 'USD'
    logger.log({ ip, currencyCode, ipDetails }, 'got currencyCode for ip')
    callback(err, currencyCode, countryCode)
  })
}

module.exports = {
  getDetails,
  getCurrencyCode,
  promises: {
    getDetails: promisify(getDetails),
    getCurrencyCode: promisify(getCurrencyCode),
  },
}
