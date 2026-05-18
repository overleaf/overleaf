import Helpers from './lib/helpers.mjs'

const tags = ['server-ce', 'server-pro', 'saas']

// Distinguish between access token not found and access token expired for 24h after expiry.
const oneDayInSeconds = 24 * 60 * 60

const indexes = [
  {
    name: 'accessTokenExpiresAt_1',
    key: { accessTokenExpiresAt: 1 },
    partialFilterExpression: { accessTokenExpiresAt: { $exists: true } },
    expireAfterSeconds: oneDayInSeconds,
  },
]

const migrate = async ({ db }) => {
  await Helpers.addIndexesToCollection(db.oauthAccessTokens, indexes)
}

const rollback = async ({ db }) => {
  await Helpers.dropIndexesFromCollection(db.oauthAccessTokens, indexes)
}

export default {
  tags,
  migrate,
  rollback,
}
