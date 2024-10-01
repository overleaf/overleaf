/* eslint-disable no-unused-vars */

const Helpers = require('./lib/helpers')

exports.tags = ['saas']

const indexes = [
  {
    unique: true,
    key: {
      v1Id: 1,
    },
    name: 'v1Id_1',
  },
]

exports.migrate = async client => {
  const { db } = client

  await Helpers.addIndexesToCollection(db.institutions, indexes)
}

exports.rollback = async client => {
  const { db } = client

  try {
    await Helpers.dropIndexesFromCollection(db.institutions, indexes)
  } catch (err) {
    console.error('Something went wrong rolling back the migrations', err)
  }
}
