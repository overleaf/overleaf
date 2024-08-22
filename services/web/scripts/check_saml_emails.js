process.env.MONGO_SOCKET_TIMEOUT = '300000'
// Run all the mongo queries on secondaries
process.env.MONGO_CONNECTION_STRING =
  process.env.READ_ONLY_MONGO_CONNECTION_STRING
const SAMLEmailBatchCheck = require('../modules/saas-authentication/app/src/SAML/SAMLEmailBatchCheck')

const startInstitutionId = parseInt(process.argv[2])
const emitDetailedData = process.argv.includes('--detailed-data')

SAMLEmailBatchCheck.promises
  .checkEmails(startInstitutionId, emitDetailedData)
  .then(result => {
    console.table(result)
    process.exit()
  })
  .catch(err => {
    console.error(err)
    process.exit(1)
  })
