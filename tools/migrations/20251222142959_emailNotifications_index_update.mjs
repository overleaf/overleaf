/* eslint-disable no-unused-vars */

import Helpers from './lib/helpers.mjs'
import { getCollectionInternal } from './lib/mongodb.mjs'

const tags = ['server-pro', 'saas']

const oldIndexes = [
  {
    key: {
      user_id: 1,
      recipient_id: 1,
      project_id: 1,
    },
    name: 'user_id_1_recipient_id_1_project_id_1',
  },
  {
    key: {
      recipient_id: 1,
    },
    name: 'recipientId_1',
    expireAfterSeconds: 60 * 60 * 24, // expire after 24 hours
  },
]

const newIndexes = [
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
