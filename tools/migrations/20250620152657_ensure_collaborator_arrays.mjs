import { batchedUpdate } from '@overleaf/mongo-utils/batchedUpdate.js'
import { db } from './lib/mongodb.mjs'

const tags = ['server-ce', 'server-pro', 'saas']

const migrate = async () => {
  const fields = [
    'collaberator_refs',
    'pendingEditor_refs',
    'pendingReviewer_refs',
    'readOnly_refs',
    'reviewer_refs',
  ]
  for (const field of fields) {
    await batchedUpdate(
      db.projects,
      { [field]: { $type: 'null' } },
      { $set: { [field]: [] } }
    )
  }
}

const rollback = async () => {}

export default {
  tags,
  migrate,
  rollback,
}
