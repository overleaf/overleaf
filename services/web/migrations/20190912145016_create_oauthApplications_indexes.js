/* eslint-disable no-unused-vars */

const Helpers = require('./lib/helpers')

exports.tags = ['saas']

const indexes = [
  {
    unique: true,
    key: {
      id: 1,
    },
    name: 'id_1',
  },
]

exports.migrate = async client => {
  const { db } = client

  await Helpers.addIndexesToCollection(db.oauthApplications, indexes)
}

exports.rollback = async client => {
  const { db } = client

  try {
    await Helpers.dropIndexesFromCollection(db.oauthApplications, indexes)
  } catch (err) {
    console.error('Something went wrong rolling back the migrations', err)
  }
}
