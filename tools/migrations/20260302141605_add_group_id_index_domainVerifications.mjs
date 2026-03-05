/* eslint-disable no-unused-vars */

import Helpers from './lib/helpers.mjs'

const tags = ['saas']

const indexes = [
  {
    key: { groupId: 1 },
    name: 'groupId_1',
  },
]

const migrate = async client => {
  const { db } = client

  await Helpers.addIndexesToCollection(db.domainVerifications, indexes)
}

const rollback = async client => {
  const { db } = client
  await Helpers.dropIndexesFromCollection(db.domainVerifications, [
    { name: 'groupId_1' },
  ])
}

export default {
  tags,
  migrate,
  rollback,
}
