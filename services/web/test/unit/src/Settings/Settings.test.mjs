import { afterEach, describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

function clearSettingsCache() {
  const monorepoPath = require
    .resolve('../../../../config/settings.defaults.js')
    .replace(/\/services\/web\/config\/settings\.defaults\.js$/, '')
  const settingsDeps = Object.keys(require.cache).filter(
    x =>
      x.includes('/@overleaf/settings') ||
      x.includes('/@overleaf-settings-virtual') ||
      x.includes(`${monorepoPath}/libraries/settings`) ||
      x.includes('/libraries/settings/') ||
      x.includes(`${monorepoPath}/services/web/config`)
  )
  settingsDeps.forEach(dep => delete require.cache[dep])
}

/**
 * @param {any} value
 * @returns {string} A string representation of the structure of the value
 */
function serializeTypes(value) {
  if (typeof value === 'object') {
    const keys = Object.keys(value).sort()
    const types = keys.reduce((acc, key) => {
      acc[key] = serializeTypes(value[key])
      return acc
    }, {})
    return JSON.stringify(types)
  }
  if (Array.isArray(value)) {
    return JSON.stringify(value.map(serializeTypes))
  }
  return typeof value
}

/**
 * @param {any[]} objects
 * @returns {boolean} Whether all objects have the same structure
 */
function haveSameStructure(objects) {
  if (!objects.length) return true
  const referenceStructure = serializeTypes(objects[0])
  return objects.every(obj => serializeTypes(obj) === referenceStructure)
}

describe('settings.defaults', function () {
  it('additional text extensions can be added via config', function () {
    clearSettingsCache()
    process.env.ADDITIONAL_TEXT_EXTENSIONS = 'abc, xyz'
    const settings = require('@overleaf/settings')
    expect(settings.textExtensions).to.include('tex') // from the default list
    expect(settings.textExtensions).to.include('abc')
    expect(settings.textExtensions).to.include('xyz')
  })

  it('generates pricings with same structures', function () {
    const settingsOverridesSaas = require('../../../../config/settings.overrides.saas.js')
    const { localizedPlanPricing } = settingsOverridesSaas

    const pricingCurrencies = Object.keys(localizedPlanPricing)
    expect(pricingCurrencies.sort()).to.eql([
      'AUD',
      'BRL',
      'CAD',
      'CHF',
      'CLP',
      'COP',
      'DKK',
      'EUR',
      'GBP',
      'INR',
      'MXN',
      'NOK',
      'NZD',
      'PEN',
      'SEK',
      'SGD',
      'USD',
    ])

    const pricings = pricingCurrencies.map(
      currency => localizedPlanPricing[currency]
    )
    expect(haveSameStructure(pricings)).to.be.true
  })
})

describe('settings.overrides.saas', function () {
  const originalEnv = {
    SHEERID_ENABLED: process.env.SHEERID_ENABLED,
    SHEERID_MOCK: process.env.SHEERID_MOCK,
    SHEERID_CLIENT_ID: process.env.SHEERID_CLIENT_ID,
    SHEERID_CLIENT_SECRET: process.env.SHEERID_CLIENT_SECRET,
    SHEERID_PROGRAM_ID: process.env.SHEERID_PROGRAM_ID,
    SHEERID_API_BASE_URL: process.env.SHEERID_API_BASE_URL,
    SHEERID_ENABLED_COUNTRIES: process.env.SHEERID_ENABLED_COUNTRIES,
    SHEERID_FALLBACK_COUNTRY: process.env.SHEERID_FALLBACK_COUNTRY,
    NODE_ENV: process.env.NODE_ENV,
  }

  function setCredentials() {
    process.env.SHEERID_CLIENT_ID = 'client-id'
    process.env.SHEERID_CLIENT_SECRET = 'client-secret'
    process.env.SHEERID_PROGRAM_ID = 'program-id'
  }

  afterEach(function () {
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    }
    clearSettingsCache()
  })

  it('sets the verification page CSP frame-src from the configured SheerID host', function () {
    process.env.SHEERID_API_BASE_URL = 'https://sandbox.sheerid.com'
    clearSettingsCache()

    const settings = require('../../../../config/settings.overrides.saas.js')

    expect(
      settings.csp.viewDirectives[
        'modules/student-verification/app/views/student-verification'
      ]
    ).to.deep.equal(["frame-src 'self' https://sandbox.sheerid.com"])
  })

  it('upper-cases the SheerID country settings', function () {
    process.env.SHEERID_ENABLED_COUNTRIES = 'gb, us ,De'
    process.env.SHEERID_FALLBACK_COUNTRY = 'gb'
    clearSettingsCache()

    const settings = require('../../../../config/settings.overrides.saas.js')

    expect(settings.sheerId.enabledCountries).to.deep.equal(['GB', 'US', 'DE'])
    expect(settings.sheerId.fallbackCountry).to.equal('GB')
  })

  it('refuses to boot with SHEERID_ENABLED and the default mock client in production', function () {
    process.env.SHEERID_ENABLED = 'true'
    delete process.env.SHEERID_MOCK // defaults to mock: true
    process.env.NODE_ENV = 'production'
    clearSettingsCache()

    expect(() =>
      require('../../../../config/settings.overrides.saas.js')
    ).to.throw(/SHEERID_ENABLED/)
  })

  it('boots with SHEERID_ENABLED, SHEERID_MOCK=false and credentials in production', function () {
    process.env.SHEERID_ENABLED = 'true'
    process.env.SHEERID_MOCK = 'false'
    process.env.NODE_ENV = 'production'
    setCredentials()
    clearSettingsCache()

    expect(() =>
      require('../../../../config/settings.overrides.saas.js')
    ).not.to.throw()
  })

  it('refuses to boot with the real client and no credentials in production', function () {
    process.env.SHEERID_ENABLED = 'true'
    process.env.SHEERID_MOCK = 'false'
    process.env.NODE_ENV = 'production'
    delete process.env.SHEERID_CLIENT_ID
    delete process.env.SHEERID_CLIENT_SECRET
    delete process.env.SHEERID_PROGRAM_ID
    clearSettingsCache()

    expect(() =>
      require('../../../../config/settings.overrides.saas.js')
    ).to.throw(/SHEERID_CLIENT_ID, SHEERID_CLIENT_SECRET, SHEERID_PROGRAM_ID/)
  })

  it('names only the credentials that are missing', function () {
    process.env.SHEERID_ENABLED = 'true'
    process.env.SHEERID_MOCK = 'false'
    process.env.NODE_ENV = 'production'
    setCredentials()
    delete process.env.SHEERID_PROGRAM_ID
    clearSettingsCache()

    expect(() =>
      require('../../../../config/settings.overrides.saas.js')
    ).to.throw(/requires SHEERID_PROGRAM_ID/)
  })

  it('boots with the real client and no credentials outside production', function () {
    process.env.SHEERID_ENABLED = 'true'
    process.env.SHEERID_MOCK = 'false'
    process.env.NODE_ENV = 'test'
    delete process.env.SHEERID_CLIENT_ID
    delete process.env.SHEERID_CLIENT_SECRET
    delete process.env.SHEERID_PROGRAM_ID
    clearSettingsCache()

    expect(() =>
      require('../../../../config/settings.overrides.saas.js')
    ).not.to.throw()
  })

  it('boots with SHEERID_ENABLED and the default mock client outside production', function () {
    process.env.SHEERID_ENABLED = 'true'
    delete process.env.SHEERID_MOCK
    process.env.NODE_ENV = 'test'
    clearSettingsCache()

    expect(() =>
      require('../../../../config/settings.overrides.saas.js')
    ).not.to.throw()
  })
})
