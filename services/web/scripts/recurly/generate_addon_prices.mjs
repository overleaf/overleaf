// @ts-check
import settings from '@overleaf/settings'
import recurly from 'recurly'
import { scriptRunner } from '../lib/ScriptRunner.mjs'

const ADD_ON_CODE = process.argv[2]

async function main() {
  if (!ADD_ON_CODE) {
    console.error('Missing add-on code')
    console.error(
      'Usage: node scripts/recurly/generate_addon_prices.mjs ADD_ON_CODE'
    )
    process.exit(1)
  }

  /** @type {Record<string, any>} */
  const localizedAddOnsPricing = {}

  const monthlyPlan = await getPlan(ADD_ON_CODE)
  if (monthlyPlan == null) {
    console.error(`Monthly plan missing in Recurly: ${ADD_ON_CODE}`)
    process.exit(1)
  }
  for (const { currency, unitAmount } of monthlyPlan.currencies ?? []) {
    /** @type {any} */
    const curr = currency
    if (!localizedAddOnsPricing[curr]) {
      localizedAddOnsPricing[curr] = { [ADD_ON_CODE]: {} }
    }
    localizedAddOnsPricing[curr][ADD_ON_CODE].monthly = unitAmount
  }

  const annualPlan = await getPlan(`${ADD_ON_CODE}-annual`)
  if (annualPlan == null) {
    console.error(`Annual plan missing in Recurly: ${ADD_ON_CODE}-annual`)
    process.exit(1)
  }
  for (const { currency, unitAmount } of annualPlan.currencies ?? []) {
    /** @type {any} */
    const curr = currency
    if (!localizedAddOnsPricing[curr]) {
      localizedAddOnsPricing[curr] = { [ADD_ON_CODE]: {} }
    }
    localizedAddOnsPricing[curr][ADD_ON_CODE].annual = unitAmount
    localizedAddOnsPricing[curr][ADD_ON_CODE].annualDividedByTwelve =
      (unitAmount || 0) / 12
  }

  console.log(JSON.stringify({ localizedAddOnsPricing }, null, 2))
}

/**
 * Get a plan configuration from Recurly
 *
 * @param {string} planCode
 */
async function getPlan(planCode) {
  const recurlyClient = new recurly.Client(settings.apis.recurly.apiKey)
  return await recurlyClient.getPlan(`code-${planCode}`)
}

await scriptRunner(main)
