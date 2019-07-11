const InstitutionsManager = require('../app/src/Features/Institutions/InstitutionsManager')

const institutionId = parseInt(process.argv[2])
if (isNaN(institutionId)) throw new Error('No institution id')
console.log('Checking users of institution', institutionId)

InstitutionsManager.checkInstitutionUsers(institutionId, function(
  error,
  usersSummary
) {
  if (error) {
    console.log(error)
  } else {
    console.log(usersSummary)
  }
  process.exit()
})
