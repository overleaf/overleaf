/* eslint-disable no-unused-vars */

import Helpers from './lib/helpers.mjs'

const tags = ['saas']

const indexes = [
  {
    key: {
      'emails.affiliationUnchecked': 1,
    },
    name: 'affiliationUnchecked_1',
    sparse: true,
  },
]

const migrate = async client => {
  const { db } = client
  await Helpers.addIndexesToCollection(db.users, indexes)
}

const rollback = async client => {
  const { db } = client
  await Helpers.dropIndexesFromCollection(db.users, indexes)
}

export default {
  tags,
  migrate,
  rollback,
}
