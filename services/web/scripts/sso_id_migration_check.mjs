import SAMLUserIdMigrationHandler from '../modules/saas-authentication/app/src/SAML/SAMLUserIdMigrationHandler.mjs'
import { ensureRunningOnMongoSecondaryWithTimeout } from './helpers/env_variable_helper.mjs'

// ScriptRunner can not be used when using this assertion
ensureRunningOnMongoSecondaryWithTimeout(300000)

const institutionId = parseInt(process.argv[2])
if (isNaN(institutionId)) throw new Error('No institution id')
const emitUsers = process.argv.includes('--emit-users')

console.log('Checking SSO user ID migration for institution:', institutionId)

try {
  await main()
} catch (error) {
  console.error(error)
  process.exit(1)
}

async function main() {
  const result =
    await SAMLUserIdMigrationHandler.promises.checkMigration(institutionId)

  if (emitUsers) {
    console.log(
      `\nMigrated: ${result.migrated}\nNot migrated: ${result.notMigrated}\nMultiple Identifiers: ${result.multipleIdentifiers}`
    )
  }

  console.log(
    `\nMigrated: ${result.migrated.length}\nNot migrated: ${result.notMigrated.length}\nMultiple Identifiers: ${result.multipleIdentifiers.length}`
  )

  process.exit()
}
