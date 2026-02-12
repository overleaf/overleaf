import { db } from '../../app/src/infrastructure/mongodb.mjs'
import { batchedUpdate } from '@overleaf/mongo-utils/batchedUpdate.js'
import { scriptRunner } from '../lib/ScriptRunner.mjs'

async function main(trackProgress) {
  // Set aiFeatures.enabled to false where writefull.enabled is false
  await batchedUpdate(
    db.users,
    { 'writefull.enabled': false },
    { $set: { 'aiFeatures.enabled': false } },
    undefined,
    undefined,
    { trackProgress }
  )

  // Set aiFeatures.enabled to true for all other cases (true, null, or not exists)
  await batchedUpdate(
    db.users,
    { 'writefull.enabled': { $ne: false } },
    { $set: { 'aiFeatures.enabled': true } },
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
