import { db } from '../../app/src/infrastructure/mongodb.mjs'
import { batchedUpdate } from '@overleaf/mongo-utils/batchedUpdate.js'
import { scriptRunner } from '../lib/ScriptRunner.mjs'

async function main(trackProgress) {
  // if writefull.enabled is unset or null then the account has no promotion attached yet
  await batchedUpdate(db.users, {}, [
    {
      $set: {
        'writefull.initialized': {
          $or: [
            { $eq: ['$writefull.enabled', true] },
            { $eq: ['$writefull.enabled', false] },
          ],
        },
      },
    },
  ])
  console.log('completed migration to writefull.initialized')
}

export default main

try {
  await scriptRunner(main)
  process.exit(0)
} catch (error) {
  console.error({ error })
  process.exit(1)
}
