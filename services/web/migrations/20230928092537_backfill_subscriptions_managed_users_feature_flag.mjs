import { batchedUpdate } from '@overleaf/mongo-utils/batchedUpdate.js'

const tags = ['saas']

const migrate = async client => {
  const { db } = client
  await batchedUpdate(
    db.subscriptions,
    { 'features.managedUsers': { $ne: true } },
    { $set: { 'features.managedUsers': null } }
  )
}

const rollback = async client => {
  const { db } = client
  await batchedUpdate(
    db.subscriptions,
    { 'features.managedUsers': { $eq: null } },
    { $set: { 'features.managedUsers': false } }
  )
}

export default {
  tags,
  migrate,
  rollback,
}
