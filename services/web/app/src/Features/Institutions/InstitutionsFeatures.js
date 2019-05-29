/* eslint-disable
    handle-callback-err,
    max-len,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let InstitutionsFeatures
const InstitutionsGetter = require('./InstitutionsGetter')
const PlansLocator = require('../Subscription/PlansLocator')
const Settings = require('settings-sharelatex')
const logger = require('logger-sharelatex')

module.exports = InstitutionsFeatures = {
  getInstitutionsFeatures(userId, callback) {
    if (callback == null) {
      callback = function(error, features) {}
    }
    return InstitutionsFeatures.getInstitutionsPlan(userId, function(
      error,
      plan
    ) {
      if (error != null) {
        return callback(error)
      }
      plan = PlansLocator.findLocalPlanInSettings(plan)
      return callback(null, (plan != null ? plan.features : undefined) || {})
    })
  },

  getInstitutionsPlan(userId, callback) {
    if (callback == null) {
      callback = function(error, plan) {}
    }
    return InstitutionsFeatures.hasLicence(userId, function(error, hasLicence) {
      if (error != null) {
        return callback(error)
      }
      if (!hasLicence) {
        return callback(null, null)
      }
      return callback(null, Settings.institutionPlanCode)
    })
  },

  hasLicence(userId, callback) {
    if (callback == null) {
      callback = function(error, hasLicence) {}
    }
    return InstitutionsGetter.getConfirmedInstitutions(userId, function(
      error,
      institutions
    ) {
      if (error != null) {
        return callback(error)
      }

      const hasLicence = institutions.some(
        institution => institution.licence && institution.licence !== 'free'
      )

      return callback(null, hasLicence)
    })
  }
}
