import { db } from '../../app/src/infrastructure/mongodb.mjs'
import { batchedUpdate } from '@overleaf/mongo-utils/batchedUpdate.js'
import { scriptRunner } from '../lib/ScriptRunner.mjs'

async function main(trackProgress) {
  // update all applicable user models
  await batchedUpdate(
    db.users,
    {
      'writefull.enabled': false,
    },
    {
      $set: {
        'aiErrorAssistant.enabled': false,
      },
    },
    undefined,
    undefined,
    { trackProgress }
  )
  console.log('completed syncing writefull state with error assist')
}

export default main

try {
  await scriptRunner(main)
  process.exit(0)
} catch (error) {
  console.error({ error })
  process.exit(1)
}
