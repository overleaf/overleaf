/* eslint-disable no-unused-vars */

import Helpers from './lib/helpers.mjs'

const tags = ['saas']

const index = {
  key: {
    featuresUpdatedAt: 1,
  },
  name: 'featuresUpdatedAt_1',
}

const migrate = async client => {
  const { db } = client
  await Helpers.addIndexesToCollection(db.users, [index])
}

const rollback = async client => {
  const { db } = client
  await Helpers.dropIndexesFromCollection(db.users, [index])
}

export default {
  tags,
  migrate,
  rollback,
}
