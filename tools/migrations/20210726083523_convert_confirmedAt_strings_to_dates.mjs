import { db } from './lib/mongodb.mjs'
import { batchedUpdate } from '@overleaf/mongo-utils/batchedUpdate.js'

const tags = ['saas']

const migrate = async () => {
  await batchedUpdate(
    db.users,
    { 'emails.confirmedAt': { $type: 'string' } },
    async function (batch) {
      for (const user of batch) {
        for (const email of user.emails) {
          if (typeof email.confirmedAt === 'string') {
            await db.users.updateOne(
              { _id: user._id, 'emails.email': email.email },
              {
                $set: {
                  'emails.$.confirmedAt': new Date(
                    email.confirmedAt.replace(/ UTC$/, '')
                  ),
                },
              }
            )
          }
        }
      }
    },
    { emails: 1 }
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
