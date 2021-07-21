/* eslint-disable no-unused-vars */

const Helpers = require('./lib/helpers')

exports.tags = ['saas']

const indexes = [
  {
    key: {
      v1_project_id: 1,
    },
    name: 'v1_project_id_1',
  },
]

exports.migrate = async client => {
  const { db } = client

  await Helpers.addIndexesToCollection(db.projectImportFailures, indexes)
}

exports.rollback = async client => {
  const { db } = client

  try {
    await Helpers.dropIndexesFromCollection(db.projectImportFailures, indexes)
  } catch (err) {
    console.error('Something went wrong rolling back the migrations', err)
  }
}
