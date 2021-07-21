/* eslint-disable no-unused-vars */

exports.tags = ['saas']

const Helpers = require('./lib/helpers')

const indexes = [
  {
    key: {
      'emails.affiliationUnchecked': 1,
    },
    name: 'affiliationUnchecked_1',
    sparse: true,
  },
]

exports.migrate = async client => {
  const { db } = client
  await Helpers.addIndexesToCollection(db.users, indexes)
}

exports.rollback = async client => {
  const { db } = client
  await Helpers.dropIndexesFromCollection(db.users, indexes)
}
