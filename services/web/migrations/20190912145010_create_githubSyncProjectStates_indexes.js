/* eslint-disable no-unused-vars */

const Helpers = require('./lib/helpers')

exports.tags = ['saas']

const indexes = [
  {
    key: {
      project_id: 1,
    },
    name: 'project_id_1',
  },
  {
    key: {
      owner_id: 1,
    },
    name: 'owner_id_1',
  },
]

exports.migrate = async client => {
  const { db } = client

  await Helpers.addIndexesToCollection(db.githubSyncProjectStates, indexes)
}

exports.rollback = async client => {
  const { db } = client

  try {
    await Helpers.dropIndexesFromCollection(db.githubSyncProjectStates, indexes)
  } catch (err) {
    console.error('Something went wrong rolling back the migrations', err)
  }
}
