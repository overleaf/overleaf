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
]

exports.migrate = async client => {
  const { db } = client

  await Helpers.addIndexesToCollection(db.projectHistoryFailures, indexes)
}

exports.rollback = async client => {
  const { db } = client

  try {
    await Helpers.dropIndexesFromCollection(db.projectHistoryFailures, indexes)
  } catch (err) {
    console.error('Something went wrong rolling back the migrations', err)
  }
}
