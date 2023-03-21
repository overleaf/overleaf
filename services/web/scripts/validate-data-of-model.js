const { batchedUpdateWithResultHandling } = require('./helpers/batchedUpdate')

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

batchedUpdateWithResultHandling(
  Model.collection.name,
  {},
  async (_, nextBatch) => {
    await processBatch(nextBatch)
  },
  {}
)
