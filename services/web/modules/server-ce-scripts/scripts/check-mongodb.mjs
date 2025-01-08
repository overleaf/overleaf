import mongodb from 'mongodb-legacy'
import {
  connectionPromise,
  db,
} from '../../../app/src/infrastructure/mongodb.js'

const { ObjectId } = mongodb

const MIN_MONGO_VERSION = [5, 0]

async function main() {
  let mongoClient
  try {
    mongoClient = await connectionPromise
  } catch (err) {
    console.error('Cannot connect to mongodb')
    throw err
  }

  await checkMongoVersion(mongoClient)

  try {
    await testTransactions(mongoClient)
  } catch (err) {
    console.error("Mongo instance doesn't support transactions")
    throw err
  }
}

async function testTransactions(mongoClient) {
  const session = mongoClient.startSession()
  try {
    await session.withTransaction(async () => {
      await db.users.findOne({ _id: new ObjectId() }, { session })
    })
  } finally {
    await session.endSession()
  }
}

async function checkMongoVersion(mongoClient) {
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
