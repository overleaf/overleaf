let InstitutionsGetter
const UserGetter = require('../User/UserGetter')
const UserMembershipsHandler = require('../UserMembership/UserMembershipsHandler')
const UserMembershipEntityConfigs = require('../UserMembership/UserMembershipEntityConfigs')

module.exports = InstitutionsGetter = {
  getConfirmedAffiliations(userId, callback) {
    UserGetter.getUserFullEmails(userId, function (error, emailsData) {
      if (error) {
        return callback(error)
      }

      const confirmedAffiliations = emailsData
        .filter(
          emailData =>
            emailData.confirmedAt &&
            emailData.affiliation &&
            emailData.affiliation.institution &&
            emailData.affiliation.institution.confirmed
        )
        .map(emailData => emailData.affiliation)

      callback(null, confirmedAffiliations)
    })
  },

  getConfirmedInstitutions(userId, callback) {
    InstitutionsGetter.getConfirmedAffiliations(
      userId,
      (error, confirmedAffiliations) => {
        if (error) {
          return callback(error)
        }

        const confirmedInstitutions = confirmedAffiliations.map(
          confirmedAffiliation =>
            confirmedAffiliation ? confirmedAffiliation.institution : undefined
        )

        callback(null, confirmedInstitutions)
      }
    )
  },

  getManagedInstitutions(userId, callback) {
    UserMembershipsHandler.getEntitiesByUser(
      UserMembershipEntityConfigs.institution,
      userId,
      callback
    )
  },
}
