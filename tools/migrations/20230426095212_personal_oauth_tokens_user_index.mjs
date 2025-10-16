import Helpers from './lib/helpers.mjs'

const tags = ['server-ce', 'server-pro', 'saas']

const indexes = [
  {
    key: { user_id: 1 },
    name: 'pat_user_id_1',
    partialFilterExpression: { type: 'pat' },
  },
]

const migrate = async client => {
  const { db } = client
  await Helpers.addIndexesToCollection(db.oauthAccessTokens, indexes)
}

const rollback = async client => {
  const { db } = client
  await Helpers.dropIndexesFromCollection(db.oauthAccessTokens, indexes)
}

export default {
  tags,
  migrate,
  rollback,
}
