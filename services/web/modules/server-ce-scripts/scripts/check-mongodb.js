const { ObjectId } = require('mongodb')
const { waitForDb, db } = require('../../../app/src/infrastructure/mongodb')
const { getMongoClient } = require('../../../app/src/infrastructure/Mongoose')

async function main() {
  try {
    await waitForDb()
  } catch (err) {
    console.error('Cannot connect to mongodb')
    throw err
  }
  try {
    await testTransactions()
  } catch (err) {
    console.error("Mongo instance doesn't support transactions")
    throw err
  }
}

async function testTransactions() {
  const mongoClient = await getMongoClient()
  const session = mongoClient.startSession()
  try {
    await session.withTransaction(async () => {
      await db.users.findOne({ _id: ObjectId() }, { session })
    })
  } finally {
    await session.endSession()
  }
}

main()
  .then(() => {
    console.error('Mongodb is up.')
    process.exit(0)
  })
  .catch(err => {
    console.error(err)
    process.exit(1)
  })
