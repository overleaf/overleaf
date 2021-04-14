let InstitutionsFeatures
const UserGetter = require('../User/UserGetter')
const PlansLocator = require('../Subscription/PlansLocator')
const Settings = require('settings-sharelatex')

module.exports = InstitutionsFeatures = {
  getInstitutionsFeatures(userId, callback) {
    InstitutionsFeatures.getInstitutionsPlan(
      userId,
      function (error, planCode) {
        if (error) {
          return callback(error)
        }
        const plan = planCode && PlansLocator.findLocalPlanInSettings(planCode)
        const features = plan && plan.features
        callback(null, features || {})
      }
    )
  },

  getInstitutionsPlan(userId, callback) {
    InstitutionsFeatures.hasLicence(userId, function (error, hasLicence) {
      if (error) {
        return callback(error)
      }
      if (!hasLicence) {
        return callback(null, null)
      }
      callback(null, Settings.institutionPlanCode)
    })
  },

  hasLicence(userId, callback) {
    UserGetter.getUserFullEmails(userId, function (error, emailsData) {
      if (error) {
        return callback(error)
      }

      const hasLicence = emailsData.some(
        emailData => emailData.emailHasInstitutionLicence
      )

      callback(null, hasLicence)
    })
  }
}
