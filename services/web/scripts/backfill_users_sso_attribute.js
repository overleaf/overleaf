const SAMLUserIdAttributeBatchHandler = require('../modules/overleaf-integration/app/src/SAML/SAMLUserIdAttributeBatchHandler')

const COMMIT = process.argv.includes('--commit')
const startInstitutionId = parseInt(process.argv[2])
const endInstitutionId = parseInt(process.argv[3])

process.env.LOG_LEVEL = 'info'

let method = 'check'
if (COMMIT) {
  method = 'run'
  console.log('Setting attribute for linked users')
} else {
  process.env.MONGO_CONNECTION_STRING =
    process.env.READ_ONLY_MONGO_CONNECTION_STRING
  console.log('Doing a dry run without --commit')
  console.log('Checking users at institutions')
}

console.log(
  'Start institution ID:',
  startInstitutionId ||
    'none provided, will start at beginning of ordered list.'
)
console.log(
  'End institution ID:',
  endInstitutionId || 'none provided, will go to end of ordered list.'
)

SAMLUserIdAttributeBatchHandler[method](startInstitutionId, endInstitutionId)
  .then(result => {
    console.log(result)
    process.exit(0)
  })
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
