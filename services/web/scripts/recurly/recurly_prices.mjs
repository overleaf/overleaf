// script to sync plan prices to/from recurly
//
// Usage:
//
// Save current plan and addon prices to file
// $ node scripts/recurly/recurly_prices.mjs --download -o prices.json
//
// Upload new plan and addon prices (change --dry-run to --commit to make the change)
// $ node scripts/recurly/recurly_prices.mjs --upload -f prices.json --dry-run
//
// File format is JSON of the plans returned by recurly, with an extra _addOns property for the
// addOns associated with that plan.
//
// The idea is to download the current prices to a file, update them locally (e.g. via a script)
// and then upload them to recurly.

import recurly from 'recurly'

import Settings from '@overleaf/settings'
import minimist from 'minimist'
import _ from 'lodash'
import fs from 'node:fs'

const recurlySettings = Settings.apis.recurly
const recurlyApiKey = recurlySettings ? recurlySettings.apiKey : undefined

const client = new recurly.Client(recurlyApiKey)

async function getRecurlyPlans() {
  const plans = client.listPlans({ params: { limit: 200, state: 'active' } })
  const result = []
  for await (const plan of plans.each()) {
    plan._addOns = await getRecurlyPlanAddOns(plan) // store the addOns in a private property
    if (VERBOSE) {
      console.error('plan', plan.code, 'found', plan._addOns.length, 'addons')
    }
    result.push(plan)
  }
  return _.sortBy(result, 'code')
}

async function getRecurlyPlanAddOns(plan) {
  // also store the addons for each plan
  const addOns = await client.listPlanAddOns(plan.id, {
    params: { limit: 200, state: 'active' },
  })
  const result = []
  for await (const addOn of addOns.each()) {
    if (addOn.code === 'additional-license') {
      result.push(addOn)
    } else {
      console.error('UNRECOGNISED ADD-ON CODE', plan.code, addOn.code)
    }
  }
  return result
}

async function download(outputFile) {
  const plans = await getRecurlyPlans()
  console.error('retrieved', plans.length, 'plans')
  fs.writeFileSync(outputFile, JSON.stringify(plans, null, 2))
}

async function upload(inputFile) {
  const localPlans = JSON.parse(fs.readFileSync(inputFile))
  console.error('local plans', localPlans.length)
  console.error('checking remote plans for consistency')
  const remotePlans = await getRecurlyPlans() // includes addOns
  // compare local with remote
  console.error('remote plans', remotePlans.length)
  const matching = _.intersectionBy(localPlans, remotePlans, 'code')
  const localOnly = _.differenceBy(localPlans, remotePlans, 'code')
  const remoteOnly = _.differenceBy(remotePlans, localPlans, 'code')
  console.error(
    'plan status:',
    matching.length,
    'matching,',
    localOnly.length,
    'local only,',
    remoteOnly.length,
    'remote only.'
  )
  if (localOnly.length > 0) {
    const localOnlyPlanCodes = localOnly.map(p => p.code)
    throw new Error(
      `plans not found in Recurly: ${localOnlyPlanCodes.join(', ')}`
    )
  }
  // update remote plan pricing with local version
  for (const localPlan of localPlans) {
    console.error(`=== ${localPlan.code} ===`)
    await updatePlan(localPlan)
    if (!localPlan._addOns?.length) {
      console.error('no addons for this plan')
      continue
    }
    for (const localPlanAddOn of localPlan._addOns) {
      await updatePlanAddOn(localPlan, localPlanAddOn)
    }
    process.stderr.write('\n')
  }
}

async function updatePlan(localPlan) {
  const planCodeId = `code-${localPlan.code}`
  const originalPlan = await client.getPlan(planCodeId)
  const changes = _.differenceWith(
    localPlan.currencies,
    originalPlan.currencies,
    (a, b) => _.isEqual(a, _.assign({}, b))
  )
  if (changes.length === 0) {
    console.error('no changes to plan currencies')
    return
  } else {
    console.error('changes', changes)
  }
  const planUpdate = { currencies: localPlan.currencies }
  try {
    if (DRY_RUN) {
      console.error('skipping update to', planCodeId)
      return
    }
    const newPlan = await client.updatePlan(planCodeId, planUpdate)
    if (VERBOSE) {
      console.error('new plan', newPlan)
    }
  } catch (err) {
    console.error('failed to update', localPlan.code, 'error', err)
  }
}

async function updatePlanAddOn(plan, localAddOn) {
  if (localAddOn.code != null && localAddOn.code !== 'additional-license') {
    return
  }
  const planCodeId = `code-${plan.code}`
  const addOnId = 'code-additional-license'
  let originalPlanAddOn
  try {
    originalPlanAddOn = await client.getPlanAddOn(planCodeId, addOnId)
  } catch (error) {
    if (error instanceof recurly.errors.NotFoundError) {
      console.error('plan add-on not found', planCodeId, addOnId)
      return
    } else {
      throw error
    }
  }
  const changes = _.differenceWith(
    localAddOn.currencies,
    originalPlanAddOn.currencies,
    (a, b) => _.isEqual(a, _.assign({}, b))
  )
  if (changes.length === 0) {
    console.error('no changes to addon currencies')
    return
  } else {
    console.error('changes', changes)
  }
  const planAddOnUpdate = { currencies: localAddOn.currencies }
  try {
    if (DRY_RUN) {
      console.error('skipping update to additional license for', planCodeId)
      return
    }
    const newPlanAddOn = await client.updatePlanAddOn(
      planCodeId,
      addOnId,
      planAddOnUpdate
    )
    if (VERBOSE) {
      console.error('new plan addon', newPlanAddOn)
    }
  } catch (err) {
    console.error(
      'failed to update plan addon',
      plan.code,
      '=>',
      localAddOn.code
    )
  }
}

const argv = minimist(process.argv.slice(2), {
  boolean: ['download', 'upload', 'dry-run', 'commit', 'verbose'],
  string: ['output', 'file'],
  alias: { o: 'output', f: 'file', v: 'verbose' },
  default: { output: '/dev/stdout' },
})

const DRY_RUN = argv['dry-run']
const COMMIT = argv.commit
const VERBOSE = argv.verbose

if (argv.download === argv.upload) {
  console.error('specify one of --download or --upload')
  process.exit(1)
}

if (argv.upload && DRY_RUN === COMMIT) {
  console.error('specify one of --dry-run or --commit when uploading prices')
  process.exit(1)
}

if (argv.download) {
  try {
    await download(argv.output)
    process.exit(0)
  } catch (error) {
    console.error({ error })
    process.exit(1)
  }
} else if (argv.upload) {
  try {
    await upload(argv.file)
    process.exit(0)
  } catch (error) {
    console.error({ error })
    process.exit(1)
  }
} else {
  console.log(
    'usage:\n' + '  --save -o file.json\n' + '  --load -f file.json\n'
  )
}
