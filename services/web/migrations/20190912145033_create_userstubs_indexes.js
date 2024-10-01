/* eslint-disable no-unused-vars */

const Helpers = require('./lib/helpers')

exports.tags = ['saas']

const indexes = [
  {
    key: {
      'overleaf.id': 1,
    },
    name: 'overleaf.id_1',
  },
]

exports.migrate = async client => {
  const { db } = client

  await Helpers.addIndexesToCollection(db.userstubs, indexes)
}

exports.rollback = async client => {
  const { db } = client

  try {
    await Helpers.dropIndexesFromCollection(db.userstubs, indexes)
  } catch (err) {
    console.error('Something went wrong rolling back the migrations', err)
  }
}
