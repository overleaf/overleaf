/* eslint-disable no-unused-vars */

import { batchedUpdate } from '@overleaf/mongo-utils/batchedUpdate.js'

const tags = ['saas']

const migrate = async client => {
  const { db } = client
  // Set aiFeatures.enabled to false where writefull.enabled is false
  await batchedUpdate(
    db.users,
    {
      'writefull.enabled': false,
      // dont re-set in cases where we already set aiFeatures, ie: by running the script
      'aiFeatures.enabled': { $exists: false },
    },
    { $set: { 'aiFeatures.enabled': false } }
  )

  // Set aiFeatures.enabled to true for all other cases (true, null, or not exists)
  await batchedUpdate(
    db.users,
    {
      'writefull.enabled': { $ne: false },
      // dont re-set in cases where we already set aiFeatures, ie: by running the script
      'aiFeatures.enabled': { $exists: false },
    },
    { $set: { 'aiFeatures.enabled': true } }
  )

  console.log(
    'completed syncing rename of aiErrorAssist.enabled to aiFeatures.enabled'
  )
}

const rollback = async client => {
  const { db } = client
  // unset the user.writefull.initialized value only if its been set
  await batchedUpdate(
    db.users,
    { 'aiFeatures.enabled': { $exists: true } },
    { $unset: { 'aiFeatures.enabled': 1 } }
  )
  console.log('completed rollback of aiFeatures.enabled migration')
}

export default {
  tags,
  migrate,
  rollback,
}
