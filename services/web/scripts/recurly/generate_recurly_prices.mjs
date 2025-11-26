// script to generate plan prices for recurly from a csv file
//
// Usage:
//
// $ node scripts/recurly/generate_recurly_prices.mjs -f input.csv -o prices.json
//
// The input csv file has the following format:
//
//     plan_code,USD,EUR,GBP,...
//     student,9,8,7,...
//     student-annual,89,79,69,...
//     group_professional_2_educational,558,516,446,...
//
// The output file format is the JSON of the plans returned by recurly, with an
// extra _addOns property for the addOns associated with that plan.
//
// The output can be used as input for the upload script `recurly_prices.js`.

import minimist from 'minimist'

// https://github.com/import-js/eslint-plugin-import/issues/1810
// eslint-disable-next-line import/no-unresolved
import * as csv from 'csv/sync'
import _ from 'lodash'
import fs from 'node:fs'

const argv = minimist(process.argv.slice(2), {
  string: ['output', 'file'],
  alias: { o: 'output', f: 'file' },
  default: { output: '/dev/stdout' },
})

// All currency codes are 3 uppercase letters
const CURRENCY_CODE_REGEX = /^[A-Z]{3}$/
// Group plans have a plan code of the form group_name_size_type, e.g.
const GROUP_SIZE_REGEX = /group_\w+_([0-9]+)_\w+/

// Compute prices for the base plan

function computePrices(plan) {
  const prices = _.pickBy(plan, (value, key) => CURRENCY_CODE_REGEX.test(key))
  const result = []
  for (const currency in prices) {
    result.push({
      currency,
      setupFee: 0,
      unitAmount: parseInt(prices[currency], 10),
    })
  }
  return _.sortBy(result, 'currency')
}

// Handle prices for license add-ons associated with group plans

function isGroupPlan(plan) {
  return plan.plan_code.startsWith('group_')
}

function getGroupSize(plan) {
  // extract the group size from the plan code group_name_size_type using a regex
  const match = plan.plan_code.match(GROUP_SIZE_REGEX)
  if (!match) {
    throw new Error(`cannot find group size in plan code: ${plan.plan_code}`)
  }
  const size = parseInt(match[1], 10)
  return size
}

function computeAddOnPrices(prices, size) {
  // The price of an additional license is the per-user cost of the base plan,
  // i.e. the price of the plan divided by the group size of the plan
  return prices.map(price => {
    return {
      currency: price.currency,
      unitAmount: Math.round((100 * price.unitAmount) / size) / 100,
      unitAmountDecimal: null,
    }
  })
}

function shouldSkipPlan(record) {
  const planCode = record.plan_code
  // Skip non-legacy group plan codes (e.g. group_professional_20_enterprise)
  if (planCode.startsWith('group_') && !GROUP_SIZE_REGEX.test(planCode)) {
    return true
  }

  return false
}

// Convert the raw records into the output format

function transformRecordToPlan(record) {
  const prices = computePrices(record)
  // The base plan has no add-ons
  const plan = {
    code: record.plan_code,
    currencies: prices,
  }
  // Large group plans have an add-on for additional licenses
  if (isGroupPlan(record)) {
    const size = getGroupSize(record)
    const addOnPrices = computeAddOnPrices(prices, size)
    plan._addOns = [
      {
        code: 'additional-license',
        currencies: addOnPrices,
      },
    ]
  }
  return plan
}

function generate(inputFile, outputFile) {
  const input = fs.readFileSync(inputFile, 'utf8')
  const rawRecords = csv.parse(input, { columns: true })
  // filter out plans that should be skipped
  const filteredRecords = rawRecords.filter(record => !shouldSkipPlan(record))
  // transform the raw records into the output format
  const plans = _.sortBy(filteredRecords, 'plan_code').map(
    transformRecordToPlan
  )
  const output = JSON.stringify(plans, null, 2)
  fs.writeFileSync(outputFile, output)
}

if (argv.file) {
  generate(argv.file, argv.output)
} else {
  console.log('usage:\n' + '  --file input.csv -o file.json\n')
}
