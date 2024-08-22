process.env.MONGO_SOCKET_TIMEOUT = '300000'
process.env.MONGO_CONNECTION_STRING =
  process.env.READ_ONLY_MONGO_CONNECTION_STRING

const { waitForDb } = require('../app/src/infrastructure/mongodb')
const SAMLUserIdMigrationHandler = require('../modules/saas-authentication/app/src/SAML/SAMLUserIdMigrationHandler')

const institutionId = parseInt(process.argv[2])
if (isNaN(institutionId)) throw new Error('No institution id')
const emitUsers = process.argv.includes('--emit-users')

console.log('Checking SSO user ID migration for institution:', institutionId)

waitForDb()
  .then(main)
  .catch(error => {
    console.error(error)
    process.exit(1)
  })

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
