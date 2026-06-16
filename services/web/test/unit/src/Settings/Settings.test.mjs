import { expect } from 'vitest'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

function clearSettingsCache() {
  const monorepoPath = require
    .resolve('../../../../config/settings.defaults.js')
    .replace(/\/services\/web\/config\/settings\.defaults\.js$/, '')
  const settingsDeps = Object.keys(require.cache).filter(
    x =>
      x.includes('/@overleaf/settings') ||
      x.includes(`${monorepoPath}/libraries/settings`) ||
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
