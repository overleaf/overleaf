import {
  db,
  READ_PREFERENCE_SECONDARY,
} from '../../app/src/infrastructure/mongodb.mjs'
import { hashSecret } from '../../modules/oauth2-server/app/src/SecretsHelper.mjs'
import { scriptRunner } from '../lib/ScriptRunner.mjs'

async function main() {
  console.log('Hashing client secrets...')
  await hashSecrets(db.oauthApplications, 'clientSecret')
  console.log('Hashing access tokens...')
  await hashSecrets(db.oauthAccessTokens, 'accessToken')
  console.log('Hashing refresh tokens...')
  await hashSecrets(db.oauthAccessTokens, 'refreshToken')
  console.log('Hashing authorization codes...')
  await hashSecrets(db.oauthAuthorizationCodes, 'authorizationCode')
}

async function hashSecrets(collection, field) {
  const cursor = collection.find(
    {
      [field]: /^(?!v1\.)/,
    },
    {
      projection: { _id: 1, [field]: 1 },
      readPreference: READ_PREFERENCE_SECONDARY,
    }
  )
  let hashedCount = 0
  for await (const doc of cursor) {
    const hash = hashSecret(doc[field])
    await collection.updateOne({ _id: doc._id }, { $set: { [field]: hash } })
    hashedCount++
  }
  console.log(`${hashedCount} secrets hashed`)
}

try {
  await scriptRunner(main)
  process.exit(0)
} catch (error) {
  console.error(error)
  process.exit(1)
}
