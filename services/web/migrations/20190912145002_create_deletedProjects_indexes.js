/* eslint-disable no-unused-vars */

const Helpers = require('./lib/helpers')

exports.tags = ['server-ce', 'server-pro', 'saas']

const indexes = [
  {
    key: {
      'deleterData.deletedAt': 1,
    },
    name: 'deleterData.deletedAt_1',
  },
  {
    key: {
      'deleterData.deletedProjectId': 1,
    },
    name: 'deleterData.deletedProjectId_1',
  },
]

exports.migrate = async client => {
  const { db } = client

  await Helpers.addIndexesToCollection(db.deletedProjects, indexes)
}

exports.rollback = async client => {
  const { db } = client

  try {
    await Helpers.dropIndexesFromCollection(db.deletedProjects, indexes)
  } catch (err) {
    console.error('Something went wrong rolling back the migrations', err)
  }
}
