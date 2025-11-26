import { scriptRunner } from './lib/ScriptRunner.mjs'
import { db } from '../app/src/infrastructure/mongodb.mjs'
import minimist from 'minimist'
const argv = minimist(process.argv.slice(2))

async function resetTutorials() {
  const commit = argv.commit !== undefined

  const users = await db.users
    .find(
      {
        'completedTutorials.rolling-compile-image-changed.state': 'completed',
      },
      { readPreference: 'secondaryPreferred' }
    )
    .toArray()

  if (!commit) {
    console.log(
      `would have removed rolling-compile-image-changed tutorial for ${users.length} users`
    )
    return
  }

  await db.users.updateMany(
    { _id: { $in: users.map(user => user._id) } },
    {
      $unset: { 'completedTutorials.rolling-compile-image-changed': '' },
    }
  )
  console.log(`updated ${users.length} users`)
}

try {
  await scriptRunner(resetTutorials)
  process.exit(0)
} catch (error) {
  console.error(error)
  process.exit(1)
}
