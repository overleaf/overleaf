/* eslint-disable no-unused-vars */

const Helpers = require('./lib/helpers')

exports.tags = ['server-ce', 'server-pro', 'saas']

const indexes = [
  {
    key: {
      project_id: 1,
    },
    name: 'project_id',
  },
]

exports.migrate = async client => {
  const { db } = client

  await Helpers.addIndexesToCollection(db.rooms, indexes)
}

exports.rollback = async client => {
  const { db } = client

  try {
    await Helpers.dropIndexesFromCollection(db.rooms, indexes)
  } catch (err) {
    console.error('Something went wrong rolling back the migrations', err)
  }
}
