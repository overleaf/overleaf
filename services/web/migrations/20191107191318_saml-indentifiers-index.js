/* eslint-disable no-unused-vars */

const Helpers = require('./lib/helpers')

exports.tags = ['saas']

const indexes = [
  {
    key: {
      'samlIdentifiers.externalUserId': 1,
      'samlIdentifiers.providerId': 1,
    },
    name: 'samlIdentifiers.externalUserId_1_samlIdentifiers.providerId_1',
    sparse: true,
  },
]

exports.migrate = async client => {
  const { db } = client

  await Helpers.addIndexesToCollection(db.user, indexes)
}

exports.rollback = async client => {
  const { db } = client

  try {
    await Helpers.dropIndexesFromCollection(db.user, indexes)
  } catch (err) {
    console.error('Something went wrong rolling back the migrations', err)
  }
}
