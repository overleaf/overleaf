const {
  db,
  waitForDb,
  READ_PREFERENCE_SECONDARY,
} = require('../../app/src/infrastructure/mongodb')
const {
  hashSecret,
} = require('../../modules/oauth2-server/app/src/SecretsHelper')

async function main() {
  await waitForDb()
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

main()
  .then(() => {
    process.exit(0)
  })
  .catch(err => {
    console.error(err)
    process.exit(1)
  })
