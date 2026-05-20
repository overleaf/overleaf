import bcrypt from 'bcrypt'
import { db } from './lib/mongodb.mjs'
import { batchedUpdate } from '@overleaf/mongo-utils/batchedUpdate.js'
import { promiseMapWithLimit } from '@overleaf/promise-utils'

const tags = ['server-ce', 'server-pro']

const HARDCODED_PASSWORD = 'password_here'
const CONCURRENCY = parseInt(process.env.CONCURRENCY, 10) || 10

const migrate = async () => {
  await batchedUpdate(
    db.users,
    { hashedPassword: { $type: 'string' } },
    async function (batch) {
      await promiseMapWithLimit(CONCURRENCY, batch, async user => {
        const match = await bcrypt.compare(
          HARDCODED_PASSWORD,
          user.hashedPassword
        )
        if (match) {
          await db.users.updateOne(
            { _id: user._id, hashedPassword: user.hashedPassword },
            { $unset: { hashedPassword: 1 } }
          )
        }
      })
    },
    { hashedPassword: 1 }
  )
}

const rollback = async () => {}

export default {
  tags,
  migrate,
  rollback,
}
