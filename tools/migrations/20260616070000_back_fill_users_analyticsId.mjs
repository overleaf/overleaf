import { db } from './lib/mongodb.mjs'
import { batchedUpdate } from '@overleaf/mongo-utils/batchedUpdate.js'

const tags = ['saas', 'server-ce', 'server-pro']

const migrate = async () => {
  await batchedUpdate(db.users, { analyticsId: { $exists: false } }, [
    { $set: { analyticsId: { $toString: '$_id' } } },
  ])
}

const rollback = async () => {
  await batchedUpdate(
    db.users,
    { $expr: { $eq: [{ $strLenCP: '$analyticsId' }, 24] } },
    { $unset: { analyticsId: 1 } }
  )
}

export default {
  tags,
  migrate,
  rollback,
}
