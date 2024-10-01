/* eslint-disable no-unused-vars */

const Helpers = require('./lib/helpers')

exports.tags = ['server-ce', 'server-pro', 'saas']

const indexes = [
  {
    key: {
      expires: 1,
    },
    name: 'expires_1',
    expireAfterSeconds: 10,
  },
  {
    key: {
      projectId: 1,
    },
    name: 'projectId_1',
  },
]

exports.migrate = async client => {
  const { db } = client

  await Helpers.addIndexesToCollection(db.projectInvites, indexes)
}

exports.rollback = async client => {
  const { db } = client

  try {
    await Helpers.dropIndexesFromCollection(db.projectInvites, indexes)
  } catch (err) {
    console.error('Something went wrong rolling back the migrations', err)
  }
}
