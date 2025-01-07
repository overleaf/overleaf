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

const READ_PREFERENCE_PRIMARY = ReadPreference.primary.mode
const READ_PREFERENCE_SECONDARY = Settings.mongo.hasSecondaries
  ? ReadPreference.secondary.mode
  : ReadPreference.secondaryPreferred.mode

const mongoClient = new mongodb.MongoClient(
  Settings.mongo.url,
  Settings.mongo.options
)

addConnectionDrainer('mongodb', async () => {
  await mongoClient.close()
})

const internalDb = mongoClient.db()
const db = {
  contacts: internalDb.collection('contacts'),
  deletedFiles: internalDb.collection('deletedFiles'),
  deletedProjects: internalDb.collection('deletedProjects'),
  deletedSubscriptions: internalDb.collection('deletedSubscriptions'),
  deletedUsers: internalDb.collection('deletedUsers'),
  dropboxEntities: internalDb.collection('dropboxEntities'),
  dropboxProjects: internalDb.collection('dropboxProjects'),
  docHistory: internalDb.collection('docHistory'),
  docHistoryIndex: internalDb.collection('docHistoryIndex'),
  docSnapshots: internalDb.collection('docSnapshots'),
  docs: internalDb.collection('docs'),
  feedbacks: internalDb.collection('feedbacks'),
  githubSyncEntityVersions: internalDb.collection('githubSyncEntityVersions'),
  githubSyncProjectStates: internalDb.collection('githubSyncProjectStates'),
  githubSyncUserCredentials: internalDb.collection('githubSyncUserCredentials'),
  globalMetrics: internalDb.collection('globalMetrics'),
  grouppolicies: internalDb.collection('grouppolicies'),
  institutions: internalDb.collection('institutions'),
  messages: internalDb.collection('messages'),
  migrations: internalDb.collection('migrations'),
  notifications: internalDb.collection('notifications'),
  oauthAccessTokens: internalDb.collection('oauthAccessTokens'),
  oauthApplications: internalDb.collection('oauthApplications'),
  oauthAuthorizationCodes: internalDb.collection('oauthAuthorizationCodes'),
  projectAuditLogEntries: internalDb.collection('projectAuditLogEntries'),
  projectHistoryChunks: internalDb.collection('projectHistoryChunks'),
  projectHistoryFailures: internalDb.collection('projectHistoryFailures'),
  projectHistoryGlobalBlobs: internalDb.collection('projectHistoryGlobalBlobs'),
  projectHistoryLabels: internalDb.collection('projectHistoryLabels'),
  projectHistoryMetaData: internalDb.collection('projectHistoryMetaData'),
  projectHistorySyncState: internalDb.collection('projectHistorySyncState'),
  projectInvites: internalDb.collection('projectInvites'),
  projects: internalDb.collection('projects'),
  publishers: internalDb.collection('publishers'),
  rooms: internalDb.collection('rooms'),
  samlCache: internalDb.collection('samlCache'),
  samlLogs: internalDb.collection('samlLogs'),
  spellingPreferences: internalDb.collection('spellingPreferences'),
  splittests: internalDb.collection('splittests'),
  ssoConfigs: internalDb.collection('ssoConfigs'),
  subscriptions: internalDb.collection('subscriptions'),
  surveys: internalDb.collection('surveys'),
  systemmessages: internalDb.collection('systemmessages'),
  tags: internalDb.collection('tags'),
  teamInvites: internalDb.collection('teamInvites'),
  tokens: internalDb.collection('tokens'),
  userAuditLogEntries: internalDb.collection('userAuditLogEntries'),
  users: internalDb.collection('users'),
  onboardingDataCollection: internalDb.collection('onboardingDataCollection'),
}

const connectionPromise = mongoClient.connect()

async function getCollectionNames() {
  const internalDb = mongoClient.db()

  const collections = await internalDb.collections()
  return collections.map(collection => collection.collectionName)
}

async function cleanupTestDatabase() {
  ensureTestDatabase()
  const collectionNames = await getCollectionNames()
  const collections = []
  for (const name of collectionNames) {
    if (name in db && name !== 'migrations') {
      collections.push(db[name])
    }
  }
  await Promise.all(collections.map(coll => coll.deleteMany({})))
}

async function dropTestDatabase() {
  ensureTestDatabase()
  await mongoClient.db().dropDatabase()
}

function ensureTestDatabase() {
  const internalDb = mongoClient.db()
  const dbName = internalDb.databaseName
  const env = process.env.NODE_ENV

  if (dbName !== 'test-overleaf' || env !== 'test') {
    throw new OError(
      `Refusing to clear database '${dbName}' in environment '${env}'`
    )
  }
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
  connectionPromise,
  getCollectionNames,
  getCollectionInternal,
  cleanupTestDatabase,
  dropTestDatabase,
  READ_PREFERENCE_PRIMARY,
  READ_PREFERENCE_SECONDARY,
}
