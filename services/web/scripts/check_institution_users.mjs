import InstitutionsManager from '../app/src/Features/Institutions/InstitutionsManager.mjs'
import { ensureRunningOnMongoSecondaryWithTimeout } from './helpers/env_variable_helper.mjs'

// ScriptRunner can not be used when using this assertion
ensureRunningOnMongoSecondaryWithTimeout(300000)

const institutionId = parseInt(process.argv[2])
if (isNaN(institutionId)) throw new Error('No institution id')
console.log('Checking users of institution', institutionId)
const emitNonProUserIds = process.argv.includes('--emit-non-pro-user-ids')

async function main() {
  const usersSummary = await InstitutionsManager.promises.checkInstitutionUsers(
    institutionId,
    emitNonProUserIds
  )
  console.log(usersSummary)
  process.exit()
}

try {
  await main()
} catch (error) {
  console.error(error)
  process.exit(1)
}
