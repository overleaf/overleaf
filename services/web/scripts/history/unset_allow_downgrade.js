const BATCH_SIZE = parseInt(process.env.BATCH_SIZE, 10) || 100
// persist fallback in order to keep batchedUpdate in-sync
process.env.BATCH_SIZE = BATCH_SIZE

const PROJECT_ID = process.env.PROJECT_ID

const {
  db,
  waitForDb,
  ObjectId,
} = require('../../app/src/infrastructure/mongodb')
const { batchedUpdate } = require('../helpers/batchedUpdate')

console.log({
  PROJECT_ID,
  BATCH_SIZE,
  VERBOSE_LOGGING: process.env.VERBOSE_LOGGING, // for batchedUpdate() logging
})

async function main() {
  if (PROJECT_ID) {
    await waitForDb()
    const { modifiedCount } = await db.projects.updateOne(
      { _id: ObjectId(PROJECT_ID), 'overleaf.history.allowDowngrade': true },
      { $unset: { 'overleaf.history.allowDowngrade': 1 } }
    )
    console.log(`modifiedCount: ${modifiedCount}`)
  } else {
    await batchedUpdate(
      'projects',
      { 'overleaf.history.allowDowngrade': true },
      { $unset: { 'overleaf.history.allowDowngrade': 1 } }
    )
  }
  console.log('Final')
}

main()
  .then(() => {
    console.error('Done.')
    process.exit(0)
  })
  .catch(error => {
    console.error({ error })
    process.exit(1)
  })
