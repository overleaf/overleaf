/* eslint-disable no-unused-vars */

const Helpers = require('./lib/helpers')

exports.tags = ['saas']

const indexes = [
  {
    key: {
      pid: 1,
      eid: 1,
    },
    name: 'pid_1_eid_1',
  },
  {
    key: {
      c: 1,
    },
    name: 'c_1',
    expireAfterSeconds: 2592000,
  },
]

exports.migrate = async client => {
  const { db } = client

  await Helpers.addIndexesToCollection(db.githubSyncEntityVersions, indexes)
}

exports.rollback = async client => {
  const { db } = client

  try {
    await Helpers.dropIndexesFromCollection(
      db.githubSyncEntityVersions,
      indexes
    )
  } catch (err) {
    console.error('Something went wrong rolling back the migrations', err)
  }
}
