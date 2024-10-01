const Helpers = require('./lib/helpers')

exports.tags = ['saas']

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

exports.migrate = async client => {
  const { db } = client
  await Helpers.addIndexesToCollection(db.oauthAccessTokens, [index])
}

exports.rollback = async client => {
  const { db } = client
  await Helpers.dropIndexesFromCollection(db.oauthAccessTokens, [index])
}
