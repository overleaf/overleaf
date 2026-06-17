import { batchedUpdate } from '@overleaf/mongo-utils/batchedUpdate.js'

const tags = ['server-ce', 'server-pro', 'saas']

const migrate = async client => {
  const { db } = client
  await batchedUpdate(
    db.users,
    { labsProgram: { $ne: true } },
    { $set: { labsProgram: false } }
  )
}

const rollback = async () => {}

export default {
  tags,
  migrate,
  rollback,
}
