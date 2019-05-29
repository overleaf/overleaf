// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const Settings = require('settings-sharelatex')

module.exports = {
  findLocalPlanInSettings(planCode) {
    for (let plan of Array.from(Settings.plans)) {
      if (plan.planCode === planCode) {
        return plan
      }
    }
    return null
  }
}
