import { batchedUpdate } from '@overleaf/mongo-utils/batchedUpdate.js'

const tags = ['saas']

const migrate = async client => {
  const { db } = client
  await batchedUpdate(
    db.subscriptions,
    { groupPolicy: { $exists: true } },
    { $set: { managedUsersEnabled: true } }
  )
}

const rollback = async client => {
  const { db } = client
  await batchedUpdate(
    db.subscriptions,
    { groupPolicy: { $exists: true } },
    { $unset: { managedUsersEnabled: '' } }
  )
}

export default {
  tags,
  migrate,
  rollback,
}
