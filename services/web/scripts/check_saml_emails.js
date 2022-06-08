// Run all the mongo queries on secondaries
process.env.MONGO_CONNECTION_STRING =
  process.env.READ_ONLY_MONGO_CONNECTION_STRING
const SAMLEmailBatchCheck = require('../modules/overleaf-integration/app/src/SAML/SAMLEmailBatchCheck')

const emitDetailedData = process.argv.includes('--detailed-data')

SAMLEmailBatchCheck.promises
  .checkEmails(emitDetailedData)
  .then(result => {
    console.table(result)
    process.exit()
  })
  .catch(err => {
    console.error(err)
    process.exit(1)
  })
