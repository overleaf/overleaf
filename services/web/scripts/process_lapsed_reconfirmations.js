const InstitutionsReconfirmationHandler = require('../modules/institutions/app/src/InstitutionsReconfirmationHandler')

InstitutionsReconfirmationHandler.processLapsed()
  .then(() => {
    process.exit(0)
  })
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
