/* eslint-disable
    camelcase,
    max-len,
    no-path-concat,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const Settings = require('settings-sharelatex')
const fs = require('fs')

// The groups.json file encodes the various group plan options we provide, and
// is used in the app the render the appropriate dialog in the plans page, and
// to generate the appropriate entries in the Settings.plans array.
// It is also used by scripts/recurly/sync_recurly.rb, which will make sure
// Recurly has a plan configured for all the groups, and that the prices are
// up to date with the data in groups.json.
const data = fs.readFileSync(
  __dirname + '/../../../templates/plans/groups.json'
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
for (let usage in groups) {
  const plan_data = groups[usage]
  for (let plan_code in plan_data) {
    const currency_data = plan_data[plan_code]
    for (let currency in currency_data) {
      const price_data = currency_data[currency]
      for (let size in price_data) {
        const price = price_data[size]
        Settings.plans.push({
          planCode: `group_${plan_code}_${size}_${usage}`,
          name: `${Settings.appName} ${capitalize(
            plan_code
          )} - Group Account (${size} licenses) - ${capitalize(usage)}`,
          hideFromUsers: true,
          annual: true,
          features: Settings.features[plan_code],
          groupPlan: true,
          membersLimit: parseInt(size)
        })
      }
    }
  }
}

module.exports = groups
