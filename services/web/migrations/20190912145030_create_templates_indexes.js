/* eslint-disable no-unused-vars */

const Helpers = require('./lib/helpers')

exports.tags = ['server-pro', 'saas']

const indexes = [
  {
    unique: true,
    key: {
      project_id: 1,
    },
    name: 'project_id_1',
  },
  {
    key: {
      user_id: 1,
    },
    name: 'user_id_1',
  },
  {
    key: {
      name: 1,
    },
    name: 'name_1',
  },
]

exports.migrate = async client => {
  const { db } = client

  await Helpers.addIndexesToCollection(db.templates, indexes)
}

exports.rollback = async client => {
  const { db } = client

  try {
    await Helpers.dropIndexesFromCollection(db.templates, indexes)
  } catch (err) {
    console.error('Something went wrong rolling back the migrations', err)
  }
}
