/* eslint-disable no-unused-vars */

const Helpers = require('./lib/helpers')

exports.tags = ['server-ce', 'server-pro', 'saas']

const indexes = [
  {
    key: {
      user_id: 1,
    },
    name: 'user_id_1',
  },
  {
    unique: true,
    key: {
      user_id: 1,
      name: 1,
    },
    name: 'user_id_1_name_1',
  },
]

exports.migrate = async client => {
  const { db } = client

  await Helpers.addIndexesToCollection(db.tags, indexes)
}

exports.rollback = async client => {
  const { db } = client

  try {
    await Helpers.dropIndexesFromCollection(db.tags, indexes)
  } catch (err) {
    console.error('Something went wrong rolling back the migrations', err)
  }
}
