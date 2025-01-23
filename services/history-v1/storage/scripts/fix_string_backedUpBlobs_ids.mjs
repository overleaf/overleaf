// @ts-check
import { backedUpBlobs } from '../lib/mongodb.js'
import { mongoId } from '../lib/assert.js'
import { ObjectId } from 'mongodb'
import commandLineArgs from 'command-line-args'

const STATS = {
  total: 0,
  replaced: 0,
  skipped: 0,
}

const config = commandLineArgs([
  { name: 'commit', type: Boolean, defaultValue: false },
])

async function processRecord(record) {
  STATS.total++
  try {
    mongoId(record._id)
    const newId = new ObjectId(record._id)
    if (config.commit) {
      await backedUpBlobs.updateOne(
        { _id: newId },
        {
          $addToSet: { blobs: { $each: record.blobs } },
        },
        { upsert: true }
      )
      await backedUpBlobs.deleteOne({ _id: record._id })
    }
    STATS.replaced++
  } catch (error) {
    console.log(error)
    STATS.skipped++
  }
}

const cursor = backedUpBlobs
  .find({ _id: { $type: 'string' } })
  .project({ _id: 1, blobs: 1 })

while (await cursor.hasNext()) {
  const record = await cursor.next()
  await processRecord(record)
}

console.log(
  `${!config.commit ? 'DRY RUN' : ''} ${STATS.total} records ${STATS.replaced} replaced, ${STATS.skipped} skipped`
)
process.exit()
