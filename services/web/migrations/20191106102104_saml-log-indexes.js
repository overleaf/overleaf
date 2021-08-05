/* eslint-disable no-unused-vars */

const Helpers = require('./lib/helpers')

exports.tags = ['saas']

const indexes = [
  {
    key: {
      providerId: 1,
    },
    name: 'providerId_1',
  },
  {
    key: {
      sessionId: 1,
    },
    name: 'sessionId_1',
  },
  {
    // expire after 30 days
    expireAfterSeconds: 60 * 60 * 24 * 30,
    key: {
      createdAt: 1,
    },
    name: 'createdAt_1',
  },
]

exports.migrate = async client => {
  const { db } = client

  await Helpers.addIndexesToCollection(db.samllog, indexes)
}

exports.rollback = async client => {
  const { db } = client

  try {
    await Helpers.dropIndexesFromCollection(db.samllog, indexes)
  } catch (err) {
    console.error('Something went wrong rolling back the migrations', err)
  }
}
