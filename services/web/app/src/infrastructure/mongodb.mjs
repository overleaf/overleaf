import mongodb from 'mongodb-legacy'
import OError from '@overleaf/o-error'
import Settings from '@overleaf/settings'
import MongoUtils from '@overleaf/mongo-utils'
import Mongoose from './Mongoose.mjs'
import { addConnectionDrainer } from './GracefulShutdown.mjs'
import Metrics from '@overleaf/metrics'

/**
 * @import { Collection, Document } from 'mongodb-legacy'
 */

// Ensure Mongoose is using the same mongodb instance as the mongodb module,
// otherwise we will get multiple versions of the ObjectId class. Mongoose
// patches ObjectId, so loading multiple versions of the mongodb module can
// cause problems with ObjectId comparisons.
if (Mongoose.mongo.ObjectId !== mongodb.ObjectId) {
  throw new OError(
    'FATAL ERROR: Mongoose is using a different mongodb instance'
  )
}

export const { ObjectId } = mongodb
const { ReadPreference } = mongodb

export const READ_PREFERENCE_PRIMARY = ReadPreference.primary.mode
export const READ_PREFERENCE_SECONDARY = Settings.mongo.hasSecondaries
  ? ReadPreference.secondary.mode
  : ReadPreference.secondaryPreferred.mode

const mongoClient = new mongodb.MongoClient(
  Settings.mongo.url,
  Settings.mongo.options
)
Metrics.mongodb.monitor(mongoClient, 'native')

addConnectionDrainer('mongodb', async () => {
  await mongoClient.close()
})

const internalDb = mongoClient.db()

const auxMongoClient = Settings.mongo.auxUrl
  ? new mongodb.MongoClient(Settings.mongo.auxUrl, Settings.mongo.options)
  : null

let auxInternalDb = null
let auxConnectionPromise = Promise.resolve()

if (auxMongoClient) {
  Metrics.mongodb.monitor(auxMongoClient, 'native-aux')

  addConnectionDrainer('mongodb-aux', async () => {
    await auxMongoClient.close()
  })

  auxInternalDb = auxMongoClient.db()
  auxConnectionPromise = auxMongoClient.connect()
}

/**
 * Returns the collection to use for the library collections, which live on
 * the auxiliary Mongo cluster. Falls back to the main cluster when no
 * auxiliary client is configured.
 *
 * @param {string} name
 * @returns {Collection<Document>}
 */
function libraryCollection(name) {
  return (auxInternalDb || internalDb).collection(name)
}

export const db = {
  contacts: internalDb.collection('contacts'),
  deletedProjects: internalDb.collection('deletedProjects'),
  deletedSubscriptions: internalDb.collection('deletedSubscriptions'),
  deletedUsers: internalDb.collection('deletedUsers'),
  domainVerifications: internalDb.collection('domainVerifications'),
  dropboxEntities: internalDb.collection('dropboxEntities'),
  dropboxProjects: internalDb.collection('dropboxProjects'),
  docSnapshots: internalDb.collection('docSnapshots'),
  docs: internalDb.collection('docs'),
  feedbacks: internalDb.collection('feedbacks'),
  githubSyncEntityVersions: internalDb.collection('githubSyncEntityVersions'),
  githubSyncProjectStates: internalDb.collection('githubSyncProjectStates'),
  githubSyncUserCredentials: internalDb.collection('githubSyncUserCredentials'),
  globalMetrics: internalDb.collection('globalMetrics'),
  grouppolicies: internalDb.collection('grouppolicies'),
  groupAuditLogEntries: internalDb.collection('groupAuditLogEntries'),
  institutions: internalDb.collection('institutions'),
  libraryReferences: libraryCollection('libraryReferences'),
  librarySizes: libraryCollection('librarySizes'),
  librarySyncStates: libraryCollection('librarySyncStates'),
  messages: internalDb.collection('messages'),
  migrations: internalDb.collection('migrations'),
  notifications: internalDb.collection('notifications'),
  emailNotifications: internalDb.collection('emailNotifications'),
  notificationsPreferences: internalDb.collection('notificationsPreferences'),
  oauthAccessTokens: internalDb.collection('oauthAccessTokens'),
  oauthApplications: internalDb.collection('oauthApplications'),
  oauthAuthorizationCodes: internalDb.collection('oauthAuthorizationCodes'),
  projectAuditLogEntries: internalDb.collection('projectAuditLogEntries'),
  projectHistoryChunks: internalDb.collection('projectHistoryChunks'),
  projectHistoryFailures: internalDb.collection('projectHistoryFailures'),
  projectHistoryGlobalBlobs: internalDb.collection('projectHistoryGlobalBlobs'),
  projectHistoryLabels: internalDb.collection('projectHistoryLabels'),
  projectHistorySizes: internalDb.collection('projectHistorySizes'),
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
  workspaces: internalDb.collection('workspaces'),
  onboardingDataCollection: internalDb.collection('onboardingDataCollection'),
  scriptLogs: internalDb.collection('scriptLogs'),
}

export const connectionPromise = mongoClient.connect()

export async function getCollectionNames() {
  const internalDb = mongoClient.db()

  const collections = await internalDb.collections()
  return collections.map(collection => collection.collectionName)
}

export async function cleanupTestDatabase() {
  await MongoUtils.cleanupTestDatabase(mongoClient)
}

export async function dropTestDatabase() {
  await MongoUtils.dropTestDatabase(mongoClient)
}

/**
 * WARNING: Consider using a pre-populated collection from `db` to avoid typos!
 */
export async function getCollectionInternal(name) {
  const internalDb = mongoClient.db()
  return internalDb.collection(name)
}

export async function waitForDb() {
  await connectionPromise
  await auxConnectionPromise
}

/**
 * Starts a client session for use with multi-document transactions
 * (session.withTransaction(...)). Requires Mongo to be running as a replica
 * set, which is enforced at startup for every deployment.
 *
 * The session must be started on the same MongoClient as the collections it
 * operates on, otherwise Mongo throws "ClientSession must be from the same
 * MongoClient".
 *
 * @param {{ aux?: boolean }} [options]
 * @returns {Promise<import('mongodb').ClientSession>}
 */
export async function startSession({ aux = false } = {}) {
  let client
  if (aux && auxMongoClient) {
    await auxConnectionPromise
    client = auxMongoClient
  } else {
    client = await connectionPromise
  }

  // The session is a real mongodb ClientSession at runtime, but mongodb-legacy
  // types its subclass via Omit, which drops ClientSession's private members and
  // makes it structurally incompatible — hence the single cast here rather than
  // at every call site.
  return /** @type {import('mongodb').ClientSession} */ (
    /** @type {unknown} */ (client.startSession())
  )
}

export default {
  db,
  ObjectId,
  connectionPromise,
  waitForDb,
  getCollectionNames,
  getCollectionInternal,
  cleanupTestDatabase,
  dropTestDatabase,
  startSession,
  READ_PREFERENCE_PRIMARY,
  READ_PREFERENCE_SECONDARY,
}
