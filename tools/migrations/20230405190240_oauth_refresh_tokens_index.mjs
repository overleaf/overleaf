import Helpers from './lib/helpers.mjs'

const tags = ['server-ce', 'server-pro', 'saas']

const OLD_INDEX = {
  key: { refreshToken: 1 },
  name: 'refreshToken_1',
  unique: true,
}
const NEW_INDEX = {
  key: { refreshToken: 1 },
  name: 'refreshToken_1',
  unique: true,
  partialFilterExpression: { refreshToken: { $exists: true } },
}
const TMP_INDEX = {
  key: { refreshToken: 1, dummyField: 1 },
  name: 'refreshToken_tmp',
}

const migrate = async client => {
  const { db } = client
  // Create a temporary index so that the refresh tokens are not left unindexed
  // while we drop the index and recreate it.
  await Helpers.addIndexesToCollection(db.oauthAccessTokens, [TMP_INDEX])

  // Drop and recreate the index with different options
  await Helpers.dropIndexesFromCollection(db.oauthAccessTokens, [OLD_INDEX])
  await Helpers.addIndexesToCollection(db.oauthAccessTokens, [NEW_INDEX])

  // Drop the temporary index
  await Helpers.dropIndexesFromCollection(db.oauthAccessTokens, [TMP_INDEX])
}

const rollback = async client => {
  const { db } = client
  // Create a temporary index so that the refresh tokens are not left unindexed
  // while we drop the index and recreate it.
  await Helpers.addIndexesToCollection(db.oauthAccessTokens, [TMP_INDEX])

  // Drop and recreate the index with different options
  await Helpers.dropIndexesFromCollection(db.oauthAccessTokens, [NEW_INDEX])
  await Helpers.addIndexesToCollection(db.oauthAccessTokens, [OLD_INDEX])

  // Drop the temporary index
  await Helpers.dropIndexesFromCollection(db.oauthAccessTokens, [TMP_INDEX])
}

export default {
  tags,
  migrate,
  rollback,
}
