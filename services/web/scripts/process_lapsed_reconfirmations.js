const InstitutionsReconfirmationHandler = require('../app/src/Features/Institutions/InstitutionsReconfirmationHandler')

InstitutionsReconfirmationHandler.processLapsed()
  .then(() => {
    process.exit(0)
  })
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
