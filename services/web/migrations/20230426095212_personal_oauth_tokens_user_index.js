const Helpers = require('./lib/helpers')

exports.tags = ['server-ce', 'server-pro', 'saas']

const indexes = [
  {
    key: { user_id: 1 },
    name: 'pat_user_id_1',
    partialFilterExpression: { type: 'pat' },
  },
]

exports.migrate = async client => {
  const { db } = client
  await Helpers.addIndexesToCollection(db.oauthAccessTokens, indexes)
}

exports.rollback = async client => {
  const { db } = client
  await Helpers.dropIndexesFromCollection(db.oauthAccessTokens, indexes)
}
