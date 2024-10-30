import SAMLEmailBatchCheck from '../modules/saas-authentication/app/src/SAML/SAMLEmailBatchCheck.mjs'
import { ensureRunningOnMongoSecondaryWithTimeout } from './helpers/env_variable_helper.mjs'

ensureRunningOnMongoSecondaryWithTimeout(300000)

const startInstitutionId = parseInt(process.argv[2])
const emitDetailedData = process.argv.includes('--detailed-data')

try {
  const result = await SAMLEmailBatchCheck.promises.checkEmails(
    startInstitutionId,
    emitDetailedData
  )
  console.table(result)
  process.exit()
} catch (error) {
  console.error(error)
  process.exit(1)
}
