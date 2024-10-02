/* eslint-disable no-unused-vars */

import Helpers from './lib/helpers.mjs'

const tags = ['saas']

const migrate = async client => {
  const { db } = client
  await db.subscriptions.updateMany(
    { groupPolicy: { $exists: true } },
    { $set: { managedUsersEnabled: true } }
  )
}

const rollback = async client => {
  const { db } = client
  await db.subscriptions.updateMany(
    { groupPolicy: { $exists: true } },
    { $unset: { managedUsersEnabled: '' } }
  )
}

export default {
  tags,
  migrate,
  rollback,
}
