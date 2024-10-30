import SAMLUserIdAttributeBatchHandler from '../modules/saas-authentication/app/src/SAML/SAMLUserIdAttributeBatchHandler.mjs'

const startInstitutionId = parseInt(process.argv[2])
const endInstitutionId = parseInt(process.argv[3])

process.env.LOG_LEVEL = 'info'

process.env.MONGO_CONNECTION_STRING =
  process.env.READ_ONLY_MONGO_CONNECTION_STRING

console.log('Checking users at institutions')

console.log(
  'Start institution ID:',
  startInstitutionId ||
    'none provided, will start at beginning of ordered list.'
)
console.log(
  'End institution ID:',
  endInstitutionId || 'none provided, will go to end of ordered list.'
)

try {
  const result = await SAMLUserIdAttributeBatchHandler.check(
    startInstitutionId,
    endInstitutionId
  )
  console.log(result)
  process.exit(0)
} catch (error) {
  console.error(error)
  process.exit(1)
}
