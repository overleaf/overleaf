/* eslint-disable no-unused-vars */

const Helpers = require('./lib/helpers')

exports.tags = ['saas']

const indexes = [
  {
    key: {
      user_id: 1,
    },
    name: 'user_id_1',
  },
]

exports.migrate = async client => {
  const { db } = client

  await Helpers.addIndexesToCollection(db.githubSyncUserCredentials, indexes)
}

exports.rollback = async client => {
  const { db } = client

  try {
    await Helpers.dropIndexesFromCollection(
      db.githubSyncUserCredentials,
      indexes
    )
  } catch (err) {
    console.error('Something went wrong rolling back the migrations', err)
  }
}
