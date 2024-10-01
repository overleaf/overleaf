const Helpers = require('./lib/helpers')

exports.tags = ['server-ce', 'server-pro', 'saas']

const ACCESS_TOKENS_INDEX = {
  name: 'expiresAt_1',
  key: { expiresAt: 1 },
  partialFilterExpression: { expiresAt: { $exists: true } },
  expireAfterSeconds: 0,
}

const AUTHORIZATION_CODES_INDEX = {
  name: 'expiresAt_1',
  key: { expiresAt: 1 },
  partialFilterExpression: { expiresAt: { $exists: true } },
  expireAfterSeconds: 0,
}

exports.migrate = async ({ db }) => {
  await Helpers.addIndexesToCollection(db.oauthAccessTokens, [
    ACCESS_TOKENS_INDEX,
  ])
  await Helpers.addIndexesToCollection(db.oauthAuthorizationCodes, [
    AUTHORIZATION_CODES_INDEX,
  ])
}

exports.rollback = async ({ db }) => {
  await Helpers.dropIndexesFromCollection(db.oauthAccessTokens, [
    ACCESS_TOKENS_INDEX,
  ])
  await Helpers.dropIndexesFromCollection(db.oauthAuthorizationCodes, [
    AUTHORIZATION_CODES_INDEX,
  ])
}
