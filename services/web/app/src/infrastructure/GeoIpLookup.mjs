import settings from '@overleaf/settings'
import logger from '@overleaf/logger'
import { fetchJson } from '@overleaf/fetch-utils'

const DEFAULT_CURRENCY_CODE = 'USD'

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

function isValidCurrencyParam(currency) {
  if (!currency) {
    return false
  }
  return validCurrencyParams.includes(currency)
}

async function getDetails(ip, callback) {
  if (!ip) {
    return callback(new Error('no ip passed'))
  }
  ip = ip.trim().split(' ')[0]
  const url = new URL(settings.apis.geoIpLookup.url)
  url.pathname += ip
  logger.debug({ ip, url }, 'getting geo ip details')
  return await fetchJson(url, { signal: AbortSignal.timeout(1_000) })
}

async function getCurrencyCode(ip) {
  let ipDetails
  try {
    ipDetails = await getDetails(ip)
  } catch (err) {
    logger.err(
      { err, ip },
      `problem getting currencyCode for ip, defaulting to ${DEFAULT_CURRENCY_CODE}`
    )
    return { currencyCode: DEFAULT_CURRENCY_CODE }
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
