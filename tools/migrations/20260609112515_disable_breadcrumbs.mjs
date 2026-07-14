import { batchedUpdate } from '@overleaf/mongo-utils/batchedUpdate.js'

const tags = ['saas']

const migrate = async client => {
  const { db } = client
  await batchedUpdate(
    db.users,
    {
      'ace.breadcrumbs': true,
    },
    { $set: { 'ace.breadcrumbs': false } }
  )
}

const rollback = async () => {}

export default {
  tags,
  migrate,
  rollback,
}
