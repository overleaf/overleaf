/* eslint-disable no-unused-vars */

import Helpers from './lib/helpers.mjs'

const tags = ['saas']

const indexes = [
  {
    key: {
      groupId: 1,
      timestamp: 1,
    },
    name: 'groupId_1_timestamp_1',
  },
]

const migrate = async client => {
  const { db } = client
  await Helpers.addIndexesToCollection(db.groupAuditLogEntries, indexes)
}

const rollback = async client => {
  const { db } = client
  try {
    await Helpers.dropIndexesFromCollection(db.groupAuditLogEntries, indexes)
  } catch (err) {
    console.error('Something went wrong rolling back the migrations', err)
  }
}

export default {
  tags,
  migrate,
  rollback,
}
