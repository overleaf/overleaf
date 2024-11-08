import { db } from '../app/src/infrastructure/mongodb.js'
import { batchedUpdate } from '@overleaf/mongo-utils/batchedUpdate.js'
import { fileURLToPath } from 'node:url'

const DRY_RUN = !process.argv.includes('--dry-run=false')
const LOG_EVERY_IN_S = parseInt(process.env.LOG_EVERY_IN_S, 10) || 5

async function main(DRY_RUN) {
  let processed = 0
  let deleted = 0
  let lastLog = 0

  function logProgress() {
    console.log(`rev missing ${processed} | deleted=true ${deleted}`)
  }

  await batchedUpdate(
    db.docs,
    { rev: { $exists: false } },
    async docs => {
      if (!DRY_RUN) {
        await db.docs.updateMany(
          {
            _id: { $in: docs.map(doc => doc._id) },
            rev: { $exists: false },
          },
          { $set: { rev: 1 } }
        )
      }

      processed += docs.length
      deleted += docs.filter(doc => doc.deleted).length

      if (Date.now() - lastLog >= LOG_EVERY_IN_S * 1000) {
        logProgress()
        lastLog = Date.now()
      }
    },
    {
      _id: 1,
      deleted: true,
    }
  )

  logProgress()
}

export default main

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    await main(DRY_RUN)
    console.log('Done.')
    process.exit(0)
  } catch (error) {
    console.error({ error })
    process.exit(1)
  }
}
