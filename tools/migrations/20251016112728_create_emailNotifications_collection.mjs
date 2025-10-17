/* eslint-disable no-unused-vars */

import Helpers from './lib/helpers.mjs'
import { getCollectionInternal } from './lib/mongodb.mjs'

const tags = ['server-pro', 'saas']

const indexes = [
  {
    key: {
      scheduledAt: 1,
    },
    name: 'scheduledAt_1',
    expireAfterSeconds: 60 * 60 * 24, // expire after 24 hours
  },
  {
    // used for querying notifications to find possible duplicates
    unique: false,
    key: {
      user_id: 1,
      recipient_id: 1,
      project_id: 1,
    },
    name: 'user_id_1_recipient_id_1_project_id_1',
  },
]

const migrate = async () => {
  const emailNotifications = await getCollectionInternal('emailNotifications')
  await Helpers.addIndexesToCollection(emailNotifications, indexes)
}

const rollback = async () => {
  const emailNotifications = await getCollectionInternal('emailNotifications')
  await Helpers.dropIndexesFromCollection(emailNotifications, indexes)
}

export default {
  tags,
  migrate,
  rollback,
}
