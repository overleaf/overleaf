// @ts-check

const _ = require('lodash')
const recurly = require('recurly')
const minimist = require('minimist')
const Settings = require('@overleaf/settings')

const ADD_ON_CODE = 'assistant'
const ADD_ON_NAME = 'Error Assist'

const INDIVIDUAL_PLANS = [
  'student',
  'collaborator',
  'professional',
  'paid-personal',
]
const INDIVIDUAL_VARIANTS = ['', '_free_trial_7_days']
const GROUP_PLANS = ['collaborator', 'professional']
const GROUP_SIZES = [2, 3, 4, 5, 10, 20, 50]
const GROUP_SEGMENTS = ['educational', 'enterprise']

const ARGS = parseArgs()

const recurlyClient = new recurly.Client(Settings.apis.recurly.apiKey)

function usage() {
  console.log(`Usage: setup_assistant_addon.js [--commit]

This script will copy prices from the ${ADD_ON_CODE} and ${ADD_ON_CODE}-annual
plans into the ${ADD_ON_CODE} add-on for every other plan

Options:

    --commit    Make actual changes to Recurly
`)
}

function parseArgs() {
  const args = minimist(process.argv.slice(2), {
    boolean: ['commit', 'help'],
  })

  if (args.help) {
    usage()
    process.exit(0)
  }

  return { commit: args.commit }
}

async function main() {
  const monthlyPlan = await getPlan(ADD_ON_CODE)
  if (monthlyPlan == null) {
    console.error(`Monthly plan missing in Recurly: ${ADD_ON_CODE}`)
    process.exit(1)
  }
  console.log('\nMonthly prices:')
  for (const { currency, unitAmount } of monthlyPlan.currencies ?? []) {
    console.log(`- ${unitAmount} ${currency}`)
  }

  const annualPlan = await getPlan(`${ADD_ON_CODE}-annual`)
  if (annualPlan == null) {
    console.error(`Annual plan missing in Recurly: ${ADD_ON_CODE}-annual`)
    process.exit(1)
  }
  console.log('\nAnnual prices:')
  for (const { currency, unitAmount } of annualPlan.currencies ?? []) {
    console.log(`- ${unitAmount} ${currency}`)
  }
  console.log()

  for (const { code, annual } of getPlanSpecs()) {
    const prices = annual ? annualPlan.currencies : monthlyPlan.currencies
    await setupAddOn(code, prices ?? [])
  }
  if (ARGS.commit) {
    console.log('Done')
  } else {
    console.log('This was a dry run. Re-run with --commit to apply changes.')
  }
}

function* getPlanSpecs() {
  for (const plan of INDIVIDUAL_PLANS) {
    for (const variant of INDIVIDUAL_VARIANTS) {
      yield { code: `${plan}${variant}`, annual: false }
      yield { code: `${plan}-annual${variant}`, annual: true }
    }
  }
  for (const plan of GROUP_PLANS) {
    for (const size of GROUP_SIZES) {
      for (const segment of GROUP_SEGMENTS) {
        yield { code: `group_${plan}_${size}_${segment}`, annual: true }
      }
    }
  }
}

/**
 * Create or update the assistant add-on for a plan
 *
 * @param {string} planCode
 * @param {recurly.AddOnPricing[]} prices
 */
async function setupAddOn(planCode, prices) {
  const currentAddOn = await getAddOn(planCode, ADD_ON_CODE)
  const newAddOnConfig = getAddOnConfig(prices)
  if (currentAddOn == null || currentAddOn.deletedAt != null) {
    await createAddOn(planCode, newAddOnConfig)
  } else if (_.isMatch(currentAddOn, newAddOnConfig)) {
    console.log(`No changes for plan ${planCode}`)
  } else {
    await updateAddOn(planCode, newAddOnConfig)
  }
}

/**
 * Get a plan configuration from Recurly
 *
 * @param {string} planCode
 */
async function getPlan(planCode) {
  try {
    return await recurlyClient.getPlan(`code-${planCode}`)
  } catch (err) {
    if (err instanceof recurly.errors.NotFoundError) {
      return null
    } else {
      throw err
    }
  }
}

/**
 * Get an add-on configuration from Recurly
 *
 * @param {string} planCode
 * @param {string} addOnCode
 */
async function getAddOn(planCode, addOnCode) {
  try {
    return await recurlyClient.getPlanAddOn(
      `code-${planCode}`,
      `code-${addOnCode}`
    )
  } catch (err) {
    if (err instanceof recurly.errors.NotFoundError) {
      return null
    } else {
      throw err
    }
  }
}

/**
 * Create the add-on described by the given config on the given plan
 *
 * @param {string} planCode
 * @param {recurly.AddOnCreate} config
 */
async function createAddOn(planCode, config) {
  if (ARGS.commit) {
    console.log(`Creating ${ADD_ON_CODE} add-on for plan ${planCode}...`)
    await recurlyClient.createPlanAddOn(`code-${planCode}`, config)
  } else {
    console.log(`Would create ${ADD_ON_CODE} add-on for plan ${planCode}`)
  }
}

/**
 * Update the add-on described by the given config on the given plan
 *
 * @param {string} planCode
 * @param {recurly.AddOnUpdate} config
 */
async function updateAddOn(planCode, config) {
  if (ARGS.commit) {
    console.log(`Updating ${ADD_ON_CODE} add-on for plan ${planCode}...`)
    await recurlyClient.updatePlanAddOn(
      `code-${planCode}`,
      `code-${ADD_ON_CODE}`,
      config
    )
  } else {
    console.log(`Would update ${ADD_ON_CODE} add-on for plan ${planCode}`)
  }
}

/**
 * Get an assistant add-on config
 *
 * @param {recurly.AddOnPricing[]} prices
 */
function getAddOnConfig(prices) {
  return {
    code: ADD_ON_CODE,
    name: ADD_ON_NAME,
    optional: true,
    currencies: prices.map(price =>
      _.pick(
        price,
        'currency',
        'unitAmount',
        'unitAmountDecimal',
        'taxInclusive'
      )
    ),
  }
}

main()
  .then(() => {
    process.exit(0)
  })
  .catch(err => {
    console.error(err)
    process.exit(1)
  })
