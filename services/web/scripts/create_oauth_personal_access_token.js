// Script to create a Personal Access Token for a given user
// Example:
// node scripts/create_oauth_personal_access_token.js --user-id=643e5b240dc50c83b5bf1127

const parseArgs = require('minimist')
const { waitForDb } = require('../app/src/infrastructure/mongodb')
const OAuthPersonalAccessTokenManager = require('../modules/oauth2-server/app/src/OAuthPersonalAccessTokenManager')

const argv = parseArgs(process.argv.slice(2), {
  string: ['user-id'],
})

const userId = argv['user-id']

if (!userId) {
  console.error('Missing --user-id argument')
  process.exit(1)
}

async function createPersonalAccessToken() {
  await waitForDb()
  const accessToken = await OAuthPersonalAccessTokenManager.createToken(userId)
  console.log('Personal Access Token: ' + accessToken)
}

createPersonalAccessToken()
  .then(() => {
    process.exit()
  })
  .catch(err => {
    console.error(err)
    process.exit(1)
  })
