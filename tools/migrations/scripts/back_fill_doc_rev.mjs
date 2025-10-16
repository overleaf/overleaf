import { db } from '../lib/mongodb.mjs'
import { batchedUpdate } from '@overleaf/mongo-utils/batchedUpdate.js'

const LOG_EVERY_IN_S = parseInt(process.env.LOG_EVERY_IN_S, 10) || 5

async function main() {
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
      await db.docs.updateMany(
        {
          _id: { $in: docs.map(doc => doc._id) },
          rev: { $exists: false },
        },
        { $set: { rev: 1 } }
      )

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
