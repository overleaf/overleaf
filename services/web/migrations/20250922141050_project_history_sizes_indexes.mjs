/* eslint-disable no-unused-vars */

import Helpers from './lib/helpers.mjs'

const tags = ['saas']

const indexes = [
  {
    key: { lastUpdatedAt: 1 },
    expireAfterSeconds: 60 * 60 * 24 * 30 /* 30 days */,
    name: 'projectHistorySizes_lastUpdatedAt_ttl_1',
  },
  {
    key: { estimatedSize: 1 },
    name: 'projectHistorySizes_estimatedSize_1',
  },
]

const migrate = async client => {
  const { db } = client

  await Helpers.addIndexesToCollection(db.projectHistorySizes, indexes)
}

const rollback = async client => {
  const { db } = client
  await Helpers.dropIndexesFromCollection(db.projectHistorySizes, indexes)
}

export default {
  tags,
  migrate,
  rollback,
}
