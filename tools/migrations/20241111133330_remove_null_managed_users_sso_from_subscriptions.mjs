import { batchedUpdate } from '@overleaf/mongo-utils/batchedUpdate.js'

const tags = ['saas']

const migrate = async client => {
  const { db } = client
  await batchedUpdate(
    db.subscriptions,
    { 'features.managedUsers': { $eq: null } },
    { $set: { 'features.managedUsers': true } }
  )
  await batchedUpdate(
    db.subscriptions,
    { 'features.groupSSO': { $eq: null } },
    { $set: { 'features.groupSSO': true } }
  )
}

const rollback = async () => {}

export default {
  tags,
  migrate,
  rollback,
}
