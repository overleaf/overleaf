import { ObjectId, ReadPreference, MongoClient } from 'mongodb'
import Settings from '@overleaf/settings'

export { ObjectId } from 'mongodb'

export const READ_PREFERENCE_PRIMARY = ReadPreference.primary.mode
export const READ_PREFERENCE_SECONDARY = Settings.mongo.hasSecondaries
  ? ReadPreference.secondary.mode
  : ReadPreference.secondaryPreferred.mode

const mongoClient = new MongoClient(Settings.mongo.url, Settings.mongo.options)

const internalDb = mongoClient.db()
export const db = {
  contacts: internalDb.collection('contacts'),
  deletedProjects: internalDb.collection('deletedProjects'),
  deletedSubscriptions: internalDb.collection('deletedSubscriptions'),
  deletedUsers: internalDb.collection('deletedUsers'),
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
  onboardingDataCollection: internalDb.collection('onboardingDataCollection'),
  scriptLogs: internalDb.collection('scriptLogs'),
}

export const connectionPromise = mongoClient.connect()

export async function getCollectionNames() {
  const internalDb = mongoClient.db()

  const collections = await internalDb.collections()
  return collections.map(collection => collection.collectionName)
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
}

const mongodb = {
  db,
  ObjectId,
  connectionPromise,
  waitForDb,
  getCollectionNames,
  getCollectionInternal,
  READ_PREFERENCE_PRIMARY,
  READ_PREFERENCE_SECONDARY,
}

export default mongodb
