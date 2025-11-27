import { batchedUpdateWithResultHandling } from '@overleaf/mongo-utils/batchedUpdate.js'
import { db } from '../app/src/infrastructure/mongodb.mjs'

const MODEL_NAME = process.argv.pop()

const { [MODEL_NAME]: Model } = await import(
  `../app/src/models/${MODEL_NAME}.mjs`
)

function processBatch(batch) {
  for (const doc of batch) {
    const error = new Model(doc).validateSync()
    if (error) {
      const { errors } = error
      console.log(JSON.stringify({ _id: doc._id, errors }))
    }
  }
}

batchedUpdateWithResultHandling(
  db[Model.collection.name],
  {},
  async nextBatch => {
    processBatch(nextBatch)
  },
  {} // fetch the entire record
)
