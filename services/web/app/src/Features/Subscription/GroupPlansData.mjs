import Settings from '@overleaf/settings'
import fs from 'node:fs'
import Path from 'node:path'

// The groups.json file encodes the various group plan options we provide, and
// is used in the app the render the appropriate dialog in the plans page, and
// to generate the appropriate entries in the Settings.plans array.
// It is also used by scripts/recurly/sync_recurly.rb, which will make sure
// Recurly has a plan configured for all the groups, and that the prices are
// up to date with the data in groups.json.
// Alternatively, scripts/recurly/get_recurly_group_prices.rb can be used to
// fetch pricing data and generate a groups.json using the current Recurly
// prices
const data = fs.readFileSync(
  Path.join(import.meta.dirname, '/../../../templates/plans/groups.json')
)
const groups = JSON.parse(data.toString())

const capitalize = string => string.charAt(0).toUpperCase() + string.slice(1)

// With group accounts in Recurly, we end up with a lot of plans to manage.
// Rather than hand coding them in the settings file, and then needing to keep
// that data in sync with the data in groups.json, we can auto generate the
// group plan entries and append them to Settings.plans at boot time. This is not
// a particularly clean pattern, since it's a little surprising that settings
// are modified at boot-time, but I think it's a better option than trying to
// keep two sources of data in sync.
for (const [usage, planData] of Object.entries(groups)) {
  for (const [planCode, currencyData] of Object.entries(planData)) {
    // Gather all possible sizes that are set up in at least one currency
    const sizes = new Set()
    for (const priceData of Object.values(currencyData)) {
      for (const size in priceData) {
        sizes.add(size)
      }
    }

    const planName =
      planCode === 'collaborator' ? 'Standard' : capitalize(planCode)

    // Generate plans in settings
    for (const size of sizes) {
      const plan = {
        planCode: `group_${planCode}_${size}_${usage}`,
        name:
          usage === 'enterprise'
            ? `Group ${planName} Plan (${size} licenses)`
            : `Group ${planName} Plan (${size} licenses) - ${capitalize(usage)}`,
        hideFromUsers: true,
        price_in_cents: groups[usage][planCode].USD[size].price_in_cents,
        annual: true,
        features: Settings.features[planCode],
        groupPlan: true,
        membersLimit: parseInt(size),
        // Add the `membersLimitAddOn` to all group plans
        membersLimitAddOn: 'additional-license',
        // Unlock flexible licensing for all group plans
        canUseFlexibleLicensing: true,
      }

      Settings.plans.push(plan)
    }
  }
}

export default groups
