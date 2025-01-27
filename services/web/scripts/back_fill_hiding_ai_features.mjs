import { db } from '../app/src/infrastructure/mongodb.js'
import { batchedUpdate } from '@overleaf/mongo-utils/batchedUpdate.js'

async function main() {
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
    }
  )
  console.log('completed syncing writefull state with error assist')
}

export default main

try {
  await main()
  process.exit(0)
} catch (error) {
  console.error({ error })
  process.exit(1)
}
