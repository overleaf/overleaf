/* eslint-disable no-unused-vars */

const Helpers = require('./lib/helpers')

exports.tags = ['server-ce', 'server-pro', 'saas']

const index = {
  key: {
    'data.user_id': 1,
  },
  name: 'data.user_id_1',
}

exports.migrate = async client => {
  const { db } = client
  await Helpers.addIndexesToCollection(db.tokens, [index])
}

exports.rollback = async client => {
  const { db } = client
  await Helpers.dropIndexesFromCollection(db.tokens, [index])
}
