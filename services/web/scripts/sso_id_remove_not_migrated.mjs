import SAMLUserIdMigrationHandler from '../modules/saas-authentication/app/src/SAML/SAMLUserIdMigrationHandler.mjs'
import { ensureMongoTimeout } from './helpers/env_variable_helper.mjs'

ensureMongoTimeout(300000)

const institutionId = parseInt(process.argv[2])
if (isNaN(institutionId)) throw new Error('No institution id')
const emitUsers = process.argv.includes('--emit-users')

console.log(
  'Remove SSO linking for users not migrated at institution:',
  institutionId
)

async function main() {
  const result =
    await SAMLUserIdMigrationHandler.promises.removeNotMigrated(institutionId)

  if (emitUsers) {
    console.log(
      `\nRemoved: ${result.success}\nFailed to remove: ${result.failed}`
    )
  }

  console.log(
    `\nRemoved: ${result.success.length}\nFailed to remove: ${result.failed.length}`
  )

  process.exit()
}

try {
  await main()
} catch (error) {
  console.error(error)
  process.exit(1)
}
