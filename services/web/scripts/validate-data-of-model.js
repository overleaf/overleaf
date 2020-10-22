const { getNextBatch } = require('./helpers/batchedUpdate')
const { db, waitForDb } = require('../app/src/infrastructure/mongodb')

const MODEL_NAME = process.argv.pop()
const Model = require(`../app/src/models/${MODEL_NAME}`)[MODEL_NAME]

function processBatch(batch) {
  for (const doc of batch) {
    const error = new Model(doc).validateSync()
    if (error) {
      const { errors } = error
      console.log(JSON.stringify({ _id: doc._id, errors }))
    }
  }
}

async function main() {
  await waitForDb()
  const collection = db[Model.collection.name]

  const query = {}
  const projection = {}

  let nextBatch
  let processed = 0
  let maxId
  while (
    (nextBatch = await getNextBatch(collection, query, maxId, projection))
      .length
  ) {
    processBatch(nextBatch)

    maxId = nextBatch[nextBatch.length - 1]._id
    processed += nextBatch.length
    console.error(maxId, processed)
  }
  console.error('done')
}

main()
  .then(() => {
    process.exit(0)
  })
  .catch(error => {
    console.error({ error })
    process.exit(1)
  })
