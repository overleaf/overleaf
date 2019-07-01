/* eslint-disable
    max-len,
    no-return-assign,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let GeoIpLookup
const request = require('request')
const settings = require('settings-sharelatex')
const _ = require('underscore')
const logger = require('logger-sharelatex')
const URL = require('url')

const currencyMappings = {
  GB: 'GBP',
  US: 'USD',
  CH: 'CHF',
  NZ: 'NZD',
  AU: 'AUD',
  DK: 'DKK',
  NO: 'NOK',
  CA: 'CAD',
  SE: 'SEK'
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
  'ES'
]

_.each(EuroCountries, country => (currencyMappings[country] = 'EUR'))

module.exports = GeoIpLookup = {
  getDetails(ip, callback) {
    if (ip == null) {
      const e = new Error('no ip passed')
      return callback(e)
    }
    ip = ip.trim().split(' ')[0]
    const opts = {
      url: URL.resolve(settings.apis.geoIpLookup.url, ip),
      timeout: 1000,
      json: true
    }
    logger.log({ ip, opts }, 'getting geo ip details')
    return request.get(opts, function(err, res, ipDetails) {
      if (err != null) {
        logger.warn({ err, ip }, 'error getting ip details')
      }
      return callback(err, ipDetails)
    })
  },

  getCurrencyCode(ip, callback) {
    return GeoIpLookup.getDetails(ip, function(err, ipDetails) {
      if (err != null || ipDetails == null) {
        logger.err(
          { err, ip },
          'problem getting currencyCode for ip, defaulting to USD'
        )
        return callback(null, 'USD')
      }
      const countryCode = __guard__(
        ipDetails != null ? ipDetails.country_code : undefined,
        x => x.toUpperCase()
      )
      const currencyCode = currencyMappings[countryCode] || 'USD'
      logger.log({ ip, currencyCode, ipDetails }, 'got currencyCode for ip')
      return callback(err, currencyCode, countryCode)
    })
  }
}

function __guard__(value, transform) {
  return typeof value !== 'undefined' && value !== null
    ? transform(value)
    : undefined
}
