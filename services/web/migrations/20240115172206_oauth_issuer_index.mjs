import Helpers from './lib/helpers.mjs'

const tags = ['saas']

const index = {
  key: {
    oauthApplication_id: 1,
  },
  name: 'oauthApplication_id_1',
  partialFilterExpression: {
    oauthApplication_id: {
      $exists: true,
    },
  },
}

const migrate = async client => {
  const { db } = client
  await Helpers.addIndexesToCollection(db.oauthAccessTokens, [index])
}

const rollback = async client => {
  const { db } = client
  await Helpers.dropIndexesFromCollection(db.oauthAccessTokens, [index])
}

export default {
  tags,
  migrate,
  rollback,
}
