import { db } from './lib/mongodb.mjs'
import { batchedUpdate } from '@overleaf/mongo-utils/batchedUpdate.js'

const tags = ['saas']

const migrate = async () => {
  await batchedUpdate(
    db.users,
    { splitTests: { $exists: true } },
    async function (batch) {
      for (const user of batch) {
        const splitTests = user.splitTests
        for (const splitTest of Object.values(user.splitTests)) {
          for (const variant of splitTest) {
            variant.assignedAt = new Date(variant.assignedAt)
          }
        }

        await db.users.updateOne({ _id: user._id }, { $set: { splitTests } })
      }
    },
    { splitTests: 1 }
  )
}

const rollback = async () => {
  /* nothing to do */
}

export default {
  tags,
  migrate,
  rollback,
}
