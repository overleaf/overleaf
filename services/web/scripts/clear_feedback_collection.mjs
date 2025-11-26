/* Clear feedback collection before a cutoff date
 *
 * Usage
 *   node scripts/clear_feedback_collection.mjs 2022-11-01               # dry run mode
 *   DRY_RUN=false node scripts/clear_feedback_collection.mjs 2022-11-01 # deletion mode
 */

import { db, ObjectId } from '../app/src/infrastructure/mongodb.js'
import { fileURLToPath } from 'node:url'

const runScript = async (timestamp, dryRun) => {
  const t = new Date(timestamp)
  if (isNaN(t)) {
    throw new Error('invalid date ' + timestamp)
  }
  const cutoffId = ObjectId.createFromTime(t / 1000)
  console.log('deleting all feedback entries before', t, '=>', cutoffId)
  const cursor = db.feedbacks.find({ _id: { $lt: cutoffId } })
  for await (const entry of cursor) {
    console.log('deleting', entry._id)
    if (dryRun) {
      console.log('skipping in dry run mode')
      continue
    }
    await db.feedbacks.deleteOne({ _id: entry._id })
  }
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  // we are in the root module, which means that we're running as a script
  const timestamp = process.env.CUTOFF_TIMESTAMP || process.argv[2]
  const dryRun = process.env.DRY_RUN !== 'false'
  runScript(timestamp, dryRun)
    .then(() => process.exit())
    .catch(err => {
      console.error(err)
      process.exit(1)
    })
}

export default runScript
