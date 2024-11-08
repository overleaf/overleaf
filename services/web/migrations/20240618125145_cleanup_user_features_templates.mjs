import { db } from '../app/src/infrastructure/mongodb.js'
import { batchedUpdate } from '@overleaf/mongo-utils/batchedUpdate.js'

const tags = ['server-ce', 'server-pro', 'saas']

const migrate = async () => {
  await batchedUpdate(
    db.users,
    { 'features.templates': { $exists: true } },
    { $unset: { 'features.templates': true } }
  )
}

const rollback = async () => {}

export default {
  tags,
  migrate,
  rollback,
}
