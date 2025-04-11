/* eslint-disable no-unused-vars */

import Helpers from './lib/helpers.mjs'

const tags = ['saas']

const indexes = [
  {
    key: { canonicalName: 1 },
    name: 'canonicalName_1',
  },
  {
    key: { username: 1 },
    name: 'username_1',
  },
]

const migrate = async client => {
  const { db } = client
  await Helpers.addIndexesToCollection(db.scriptLogs, indexes)
}

const rollback = async client => {
  const { db } = client
  await Helpers.dropIndexesFromCollection(db.scriptLogs, indexes)
}

export default {
  tags,
  migrate,
  rollback,
}
