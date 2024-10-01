import Helpers from './lib/helpers.mjs'

const tags = ['server-pro']

const OAUTH_APPLICATIONS_INDEX = {
  key: { id: 1 },
  unique: true,
  name: 'id_1',
}

const OAUTH_ACCESS_TOKENS_INDEX = {
  key: { accessToken: 1 },
  unique: true,
  name: 'accessToken_1',
}

const OAUTH_AUTHORIZATION_CODES_INDEX = {
  key: { authorizationCode: 1 },
  unique: true,
  name: 'authorizationCode_1',
}

const migrate = async client => {
  const { db } = client
  await Helpers.addIndexesToCollection(db.oauthApplications, [
    OAUTH_APPLICATIONS_INDEX,
  ])
  await Helpers.addIndexesToCollection(db.oauthAccessTokens, [
    OAUTH_ACCESS_TOKENS_INDEX,
  ])
  await Helpers.addIndexesToCollection(db.oauthAuthorizationCodes, [
    OAUTH_AUTHORIZATION_CODES_INDEX,
  ])
}

const rollback = async client => {
  const { db } = client
  await Helpers.dropIndexesFromCollection(db.oauthApplications, [
    OAUTH_APPLICATIONS_INDEX,
  ])
  await Helpers.dropIndexesFromCollection(db.oauthAccessTokens, [
    OAUTH_ACCESS_TOKENS_INDEX,
  ])
  await Helpers.dropIndexesFromCollection(db.oauthAuthorizationCodes, [
    OAUTH_AUTHORIZATION_CODES_INDEX,
  ])
}

export default {
  tags,
  migrate,
  rollback,
}
