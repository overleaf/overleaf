/* eslint-disable no-unused-vars */

import Helpers from './lib/helpers.mjs'

const tags = ['saas', 'nonblocking']

// Supports the daily scheduler query in scripts/verify_domains.mjs which
// filters on status and lastVerificationAttemptAt.
const indexes = [
  {
    key: { status: 1, lastVerificationAttemptAt: 1 },
    name: 'status_1_lastVerificationAttemptAt_1',
  },
]

const migrate = async client => {
  const { db } = client

  await Helpers.addIndexesToCollection(db.domainVerifications, indexes)
}

const rollback = async client => {
  const { db } = client
  await Helpers.dropIndexesFromCollection(db.domainVerifications, indexes)
}

export default {
  tags,
  migrate,
  rollback,
}
