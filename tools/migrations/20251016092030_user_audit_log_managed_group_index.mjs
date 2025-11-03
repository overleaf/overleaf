/* eslint-disable no-unused-vars */

import Helpers from './lib/helpers.mjs'

const tags = ['saas']

const indexes = [
  {
    key: {
      managedSubscriptionId: 1,
      timestamp: 1,
    },
    name: 'managedSubscriptionId_1_timestamp_1',
  },
]

const migrate = async client => {
  const { db } = client
  await Helpers.addIndexesToCollection(db.userAuditLogEntries, indexes)
}

const rollback = async client => {
  const { db } = client
  try {
    await Helpers.dropIndexesFromCollection(db.userAuditLogEntries, indexes)
  } catch (err) {
    console.error('Something went wrong rolling back the migrations', err)
  }
}

export default {
  tags,
  migrate,
  rollback,
}
