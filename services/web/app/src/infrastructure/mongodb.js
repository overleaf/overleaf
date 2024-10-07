const mongodb = require('mongodb-legacy')
const OError = require('@overleaf/o-error')
const Settings = require('@overleaf/settings')
const Mongoose = require('./Mongoose')
const { addConnectionDrainer } = require('./GracefulShutdown')

// Ensure Mongoose is using the same mongodb instance as the mongodb module,
// otherwise we will get multiple versions of the ObjectId class. Mongoose
// patches ObjectId, so loading multiple versions of the mongodb module can
// cause problems with ObjectId comparisons.
if (Mongoose.mongo.ObjectId !== mongodb.ObjectId) {
  throw new OError(
    'FATAL ERROR: Mongoose is using a different mongodb instance'
  )
}

const { ObjectId, ReadPreference } = mongodb

if (
  typeof global.beforeEach === 'function' &&
  process.argv.join(' ').match(/unit/)
) {
  throw new Error(
    'It looks like unit tests are running, but you are connecting to Mongo. Missing a stub?'
  )
}

const READ_PREFERENCE_PRIMARY = ReadPreference.primary.mode
const READ_PREFERENCE_SECONDARY = Settings.mongo.hasSecondaries
  ? ReadPreference.secondary.mode
  : ReadPreference.secondaryPreferred.mode

let setupDbPromise
async function waitForDb() {
  if (!setupDbPromise) {
    setupDbPromise = setupDb()
  }
  await setupDbPromise
}

const db = {}

const mongoClient = new mongodb.MongoClient(
  Settings.mongo.url,
  Settings.mongo.options
)

addConnectionDrainer('mongodb', async () => {
  await mongoClient.close()
})

async function setupDb() {
  const internalDb = mongoClient.db()

  db.contacts = internalDb.collection('contacts')
  db.deletedFiles = internalDb.collection('deletedFiles')
  db.deletedProjects = internalDb.collection('deletedProjects')
  db.deletedSubscriptions = internalDb.collection('deletedSubscriptions')
  db.deletedUsers = internalDb.collection('deletedUsers')
  db.dropboxEntities = internalDb.collection('dropboxEntities')
  db.dropboxProjects = internalDb.collection('dropboxProjects')
  db.docHistory = internalDb.collection('docHistory')
  db.docHistoryIndex = internalDb.collection('docHistoryIndex')
  db.docSnapshots = internalDb.collection('docSnapshots')
  db.docs = internalDb.collection('docs')
  db.feedbacks = internalDb.collection('feedbacks')
  db.githubSyncEntityVersions = internalDb.collection(
    'githubSyncEntityVersions'
  )
  db.githubSyncProjectStates = internalDb.collection('githubSyncProjectStates')
  db.githubSyncUserCredentials = internalDb.collection(
    'githubSyncUserCredentials'
  )
  db.globalMetrics = internalDb.collection('globalMetrics')
  db.grouppolicies = internalDb.collection('grouppolicies')
  db.institutions = internalDb.collection('institutions')
  db.messages = internalDb.collection('messages')
  db.migrations = internalDb.collection('migrations')
  db.notifications = internalDb.collection('notifications')
  db.oauthAccessTokens = internalDb.collection('oauthAccessTokens')
  db.oauthApplications = internalDb.collection('oauthApplications')
  db.oauthAuthorizationCodes = internalDb.collection('oauthAuthorizationCodes')
  db.projectAuditLogEntries = internalDb.collection('projectAuditLogEntries')
  db.projectHistoryChunks = internalDb.collection('projectHistoryChunks')
  db.projectHistoryFailures = internalDb.collection('projectHistoryFailures')
  db.projectHistoryLabels = internalDb.collection('projectHistoryLabels')
  db.projectHistoryMetaData = internalDb.collection('projectHistoryMetaData')
  db.projectHistorySyncState = internalDb.collection('projectHistorySyncState')
  db.projectInvites = internalDb.collection('projectInvites')
  db.projects = internalDb.collection('projects')
  db.publishers = internalDb.collection('publishers')
  db.rooms = internalDb.collection('rooms')
  db.samlCache = internalDb.collection('samlCache')
  db.samlLogs = internalDb.collection('samlLogs')
  db.spellingPreferences = internalDb.collection('spellingPreferences')
  db.splittests = internalDb.collection('splittests')
  db.ssoConfigs = internalDb.collection('ssoConfigs')
  db.subscriptions = internalDb.collection('subscriptions')
  db.surveys = internalDb.collection('surveys')
  db.systemmessages = internalDb.collection('systemmessages')
  db.tags = internalDb.collection('tags')
  db.teamInvites = internalDb.collection('teamInvites')
  db.tokens = internalDb.collection('tokens')
  db.userAuditLogEntries = internalDb.collection('userAuditLogEntries')
  db.users = internalDb.collection('users')
  db.onboardingDataCollection = internalDb.collection(
    'onboardingDataCollection'
  )

  await mongoClient.connect()
}

async function getCollectionNames() {
  const internalDb = mongoClient.db()

  const collections = await internalDb.collections()
  return collections.map(collection => collection.collectionName)
}

async function dropTestDatabase() {
  const internalDb = mongoClient.db()
  const dbName = internalDb.databaseName
  const env = process.env.NODE_ENV

  if (dbName !== 'test-overleaf' || env !== 'test') {
    throw new OError(
      `Refusing to clear database '${dbName}' in environment '${env}'`
    )
  }

  await internalDb.dropDatabase()
}

/**
 * WARNING: Consider using a pre-populated collection from `db` to avoid typos!
 */
async function getCollectionInternal(name) {
  const internalDb = mongoClient.db()
  return internalDb.collection(name)
}

module.exports = {
  db,
  ObjectId,
  getCollectionNames,
  getCollectionInternal,
  dropTestDatabase,
  waitForDb,
  READ_PREFERENCE_PRIMARY,
  READ_PREFERENCE_SECONDARY,
}
