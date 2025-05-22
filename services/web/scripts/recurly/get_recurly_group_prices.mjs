// Get prices from Recurly in GroupPlansData format, ie to update:
// app/templates/plans/groups.json
//
// Usage example:
// node scripts/recurly/get_recurly_group_prices.mjs

import recurly from 'recurly'

import Settings from '@overleaf/settings'
import { scriptRunner } from '../lib/ScriptRunner.mjs'

const recurlySettings = Settings.apis.recurly
const recurlyApiKey = recurlySettings ? recurlySettings.apiKey : undefined

const client = new recurly.Client(recurlyApiKey)

async function getRecurlyGroupPrices() {
  const prices = {}
  const plans = client.listPlans({ params: { limit: 200 } })
  for await (const plan of plans.each()) {
    if (plan.code.substr(0, 6) === 'group_') {
      const [, type, size, usage] = plan.code.split('_')
      plan.currencies.forEach(planPricing => {
        const { currency, unitAmount } = planPricing
        prices[usage] = prices[usage] || {}
        prices[usage][type] = prices[usage][type] || {}
        prices[usage][type][currency] = prices[usage][type][currency] || {}
        prices[usage][type][currency][size] = {
          price_in_cents: unitAmount * 100,
        }
      })
    }
  }
  return prices
}

async function main() {
  const prices = await getRecurlyGroupPrices()
  console.log(JSON.stringify(prices, undefined, 2))
}

try {
  await scriptRunner(main)
  process.exit(0)
} catch (error) {
  console.error({ error })
  process.exit(1)
}
