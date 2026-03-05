/* eslint-disable no-unused-vars */

import Helpers from './lib/helpers.mjs'

const tags = ['saas']

const indexes = [
  {
    key: { domain: 1 },
    name: 'domain_1',
    unique: true,
  },
]

const migrate = async client => {
  const { db } = client

  await Helpers.addIndexesToCollection(db.domainVerifications, indexes)
}

const rollback = async client => {
  const { db } = client
  await Helpers.dropIndexesFromCollection(db.domainVerifications, [
    { name: 'domain_1' },
  ])
}

export default {
  tags,
  migrate,
  rollback,
}
