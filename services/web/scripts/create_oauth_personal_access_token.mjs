// Script to create a Personal Access Token for a given user
// Example:
// node scripts/create_oauth_personal_access_token.mjs --user-id=643e5b240dc50c83b5bf1127

import parseArgs from 'minimist'

import OAuthPersonalAccessTokenManager from '../modules/oauth2-server/app/src/OAuthPersonalAccessTokenManager.mjs'

const argv = parseArgs(process.argv.slice(2), {
  string: ['user-id'],
})

const userId = argv['user-id']

if (!userId) {
  console.error('Missing --user-id argument')
  process.exit(1)
}

async function createPersonalAccessToken() {
  const accessToken = await OAuthPersonalAccessTokenManager.createToken(userId)
  console.log('Personal Access Token: ' + accessToken)
}

try {
  await createPersonalAccessToken()
  process.exit()
} catch (error) {
  console.error(error)
  process.exit(1)
}
