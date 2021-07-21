/* eslint-disable no-unused-vars */

const Helpers = require('./lib/helpers')

exports.tags = ['server-ce', 'server-pro', 'saas']

const indexes = [
  {
    key: {
      room_id: 1,
      timestamp: -1,
    },
    name: 'room_id_1_timestamp_-1',
  },
]

exports.migrate = async client => {
  const { db } = client

  await Helpers.addIndexesToCollection(db.messages, indexes)
}

exports.rollback = async client => {
  const { db } = client

  try {
    await Helpers.dropIndexesFromCollection(db.messages, indexes)
  } catch (err) {
    console.error('Something went wrong rolling back the migrations', err)
  }
}
