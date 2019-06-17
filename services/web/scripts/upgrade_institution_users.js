const InstitutionsManager = require('../app/src/Features/Institutions/InstitutionsManager')

const institutionId = parseInt(process.argv[2])
if (isNaN(institutionId)) throw new Error('No institution id')
console.log('Upgrading users of institution', institutionId)

InstitutionsManager.upgradeInstitutionUsers(institutionId, function(error) {
  if (error) {
    console.log(error)
  } else {
    console.log('DONE 👌')
  }
  process.exit()
})
