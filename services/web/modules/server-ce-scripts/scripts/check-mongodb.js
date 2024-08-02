const { ObjectId } = require('mongodb-legacy')
const { waitForDb, db } = require('../../../app/src/infrastructure/mongodb')
const { getMongoClient } = require('../../../app/src/infrastructure/Mongoose')

const MIN_MONGO_VERSION = [5, 0]

async function main() {
  try {
    await waitForDb()
  } catch (err) {
    console.error('Cannot connect to mongodb')
    throw err
  }

  await checkMongoVersion()

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
      await db.users.findOne({ _id: new ObjectId() }, { session })
    })
  } finally {
    await session.endSession()
  }
}

async function checkMongoVersion() {
  const mongoClient = await getMongoClient()
  const buildInfo = await mongoClient.db().admin().buildInfo()
  const [major, minor] = buildInfo.versionArray
  const [minMajor, minMinor] = MIN_MONGO_VERSION

  if (major < minMajor || (major === minMajor && minor < minMinor)) {
    const version = buildInfo.version
    const minVersion = MIN_MONGO_VERSION.join('.')
    console.error(
      `The MongoDB server has version ${version}, but Overleaf requires at least version ${minVersion}. Aborting.`
    )
    process.exit(1)
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
