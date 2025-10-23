/* eslint-disable no-unused-vars */

import Helpers from './lib/helpers.mjs'
import { getCollectionInternal } from './lib/mongodb.mjs'

const tags = ['server-pro', 'saas']

const oldIndexes = [
  {
    key: {
      scheduledAt: 1,
    },
    name: 'scheduledAt_1',
    expireAfterSeconds: 60 * 60 * 24, // expire after 24 hours
  },
]

const newIndexes = [
  {
    key: {
      createdAt: 1,
    },
    name: 'createdAt_1',
    expireAfterSeconds: 60 * 60 * 24, // expire after 24 hours
  },
  {
    key: {
      project_id: 1,
    },
    name: 'project_id_1',
    expireAfterSeconds: 60 * 60 * 24, // expire after 24 hours
  },
]

const migrate = async client => {
  const emailNotifications = await getCollectionInternal('emailNotifications')
  await Helpers.dropIndexesFromCollection(emailNotifications, oldIndexes)
  await Helpers.addIndexesToCollection(emailNotifications, newIndexes)
}

const rollback = async client => {
  const emailNotifications = await getCollectionInternal('emailNotifications')
  await Helpers.dropIndexesFromCollection(emailNotifications, newIndexes)
  await Helpers.addIndexesToCollection(emailNotifications, oldIndexes)
}

export default {
  tags,
  migrate,
  rollback,
}
