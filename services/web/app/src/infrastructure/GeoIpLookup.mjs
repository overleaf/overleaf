// @ts-check

import settings from '@overleaf/settings'
import logger from '@overleaf/logger'
import { fetchJson } from '@overleaf/fetch-utils'
import LRU from 'lru-cache'

/**
 * @typedef {import('../../../types/subscription/currency').CurrencyCode} CurrencyCode
 */

const DEFAULT_CURRENCY_CODE = /** @type {const} */ 'USD'
const cache = new LRU({
  max: settings.apis.geoIpLookup.cacheSize,
})

/**
 * Cache details per /24 subnet, which is the smallest subnet routed on the public internet.
 * IPv6 is not supported by GCP. We could cache by /48.
 * @param {string} ip
 */
function networkCacheKey(ip) {
  const octets = ip.split('.')
  return octets.length === 4 ? octets.slice(0, 3).join('.') : ip
}

/** @type {Record<string, CurrencyCode>} */
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
  SG: 'SGD',
  IN: 'INR',
  BR: 'BRL',
  MX: 'MXN',
  CO: 'COP',
  CL: 'CLP',
  PE: 'PEN',
}

const validCurrencyParams = Object.values(currencyMappings).concat([
  'EUR',
  'INR',
  'BRL',
  'MXN',
  'COP',
  'CLP',
  'PEN',
])

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

for (const country of EuroCountries) {
  currencyMappings[country] = 'EUR'
}

/**
 * @param {any} currency
 */
function isValidCurrencyParam(currency) {
  if (!currency) {
    return false
  }
  return validCurrencyParams.includes(currency)
}

/**
 * @param {any} ip
 * @param {any} [callback]
 */
async function getDetails(ip, callback) {
  if (!ip) {
    return callback(new Error('no ip passed'))
  }
  if (!settings.apis.geoIpLookup?.url) {
    logger.warn(
      {},
      'settings.apis.geoIpLookup.url is not configured, skipping lookup'
    )
    return
  }
  ip = ip.trim().split(' ')[0]
  const cacheKey = networkCacheKey(ip)
  const cached = cache.get(cacheKey)
  if (cached) {
    return cached
  }
  const url = new URL(settings.apis.geoIpLookup.url)
  url.pathname += ip
  logger.debug({ ip, url }, 'getting geo ip details')
  const details = await fetchJson(url, { signal: AbortSignal.timeout(1_000) })
  cache.set(cacheKey, details)
  return details
}

/**
 * @param {any} ip
 * @returns {Promise<{currencyCode: CurrencyCode, countryCode: string|undefined}>}
 */
async function getCurrencyCode(ip) {
  let ipDetails
  try {
    ipDetails = await getDetails(ip)
  } catch (err) {
    logger.err(
      { err, ip },
      `problem getting currencyCode for ip, defaulting to ${DEFAULT_CURRENCY_CODE}`
    )
    return { currencyCode: DEFAULT_CURRENCY_CODE, countryCode: undefined }
  }
  const countryCode =
    ipDetails && ipDetails.country_code
      ? ipDetails.country_code.toUpperCase()
      : undefined
  const currencyCode = currencyMappings[countryCode] || DEFAULT_CURRENCY_CODE
  logger.debug({ ip, currencyCode, ipDetails }, 'got currencyCode for ip')
  return { currencyCode, countryCode }
}

export default {
  isValidCurrencyParam,
  promises: {
    getDetails,
    getCurrencyCode,
  },
  DEFAULT_CURRENCY_CODE,
}
