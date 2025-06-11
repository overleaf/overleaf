import mongodb from 'mongodb-legacy'
import {
  connectionPromise,
  db,
} from '../../../app/src/infrastructure/mongodb.js'

const { ObjectId } = mongodb

const MIN_MONGO_VERSION = [6, 0]
const MIN_MONGO_FEATURE_COMPATIBILITY_VERSION = [6, 0]

async function main() {
  let mongoClient
  try {
    mongoClient = await connectionPromise
  } catch (err) {
    console.error('Cannot connect to mongodb')
    throw err
  }

  await checkMongoVersion(mongoClient)
  await checkFeatureCompatibilityVersion(mongoClient)

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

async function checkFeatureCompatibilityVersion(mongoClient) {
  const {
    featureCompatibilityVersion: { version },
  } = await mongoClient
    .db()
    .admin()
    .command({ getParameter: 1, featureCompatibilityVersion: 1 })
  const [major, minor] = version.split('.').map(v => parseInt(v))
  const [minMajor, minMinor] = MIN_MONGO_FEATURE_COMPATIBILITY_VERSION

  if (major < minMajor || (major === minMajor && minor < minMinor)) {
    const minVersion = MIN_MONGO_FEATURE_COMPATIBILITY_VERSION.join('.')
    console.error(`
The MongoDB server has featureCompatibilityVersion=${version}, but Overleaf requires at least version ${minVersion}.

Open a mongo shell:
- Overleaf Toolkit deployments: $ bin/mongo
- Legacy docker-compose.yml deployments: $ docker exec -it mongo mongosh localhost/sharelatex

In the mongo shell:
> db.adminCommand( { setFeatureCompatibilityVersion: "${minMajor}.${minMinor}" } )

Verify the new value:
> db.adminCommand( { getParameter: 1, featureCompatibilityVersion: 1 } )
 ...
 {
    featureCompatibilityVersion: { version: ${minMajor}.${minMinor}' },
...

Aborting.
`)
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
