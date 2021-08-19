/* eslint-disable no-unused-vars */

const Helpers = require('./lib/helpers')

exports.tags = ['saas']

const indexes = [
  {
    unique: true,
    key: {
      'subscription._id': 1,
    },
    name: 'subscription._id_1',
  },
  {
    key: {
      'subscription.admin_id': 1,
    },
    name: 'subscription.admin_id_1',
  },
]

exports.migrate = async client => {
  const { db } = client

  await Helpers.addIndexesToCollection(db.deletedSubscriptions, indexes)
}

exports.rollback = async client => {
  const { db } = client

  try {
    await Helpers.dropIndexesFromCollection(db.deletedSubscriptions, indexes)
  } catch (err) {
    console.error('Something went wrong rolling back the migrations', err)
  }
}
