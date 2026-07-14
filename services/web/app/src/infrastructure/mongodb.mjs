import mongodb from 'mongodb-legacy'
import OError from '@overleaf/o-error'
import Settings from '@overleaf/settings'
import MongoUtils from '@overleaf/mongo-utils'
import Mongoose from './Mongoose.mjs'
import { addConnectionDrainer } from './GracefulShutdown.mjs'
import Metrics from '@overleaf/metrics'
import logger from '@overleaf/logger'

/**
 * @import {
 *   AnyBulkWriteOperation,
 *   BulkWriteOptions,
 *   Collection,
 *   Document,
 *   Filter,
 *   FindOneAndDeleteOptions,
 *   FindOneAndUpdateOptions,
 *   OptionalUnlessRequiredId,
 *   UpdateFilter,
 *   UpdateOptions,
 * } from 'mongodb-legacy'
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
 * @typedef {Pick<
 *   Collection<Document>,
 *   | 'find'
 *   | 'findOne'
 *   | 'aggregate'
 *   | 'countDocuments'
 *   | 'insertMany'
 *   | 'bulkWrite'
 *   | 'updateOne'
 *   | 'findOneAndUpdate'
 *   | 'findOneAndDelete'
 *   | 'deleteMany'
 * >} DualWriteCollection
 */

/**
 * Wraps a collection so that writes are mirrored to the auxiliary Mongo
 * cluster (best-effort) while the primary cluster remains the source of
 * truth. Falls back to the plain primary collection when no auxiliary
 * client is configured.
 *
 * @param {string} name
 * @returns {DualWriteCollection}
 */
function dualWriteCollection(name) {
  const primary = internalDb.collection(name)
  if (!auxInternalDb) {
    return primary
  }
  const auxiliary = auxInternalDb.collection(name)

  const mirror = op =>
    Promise.resolve()
      .then(op)
      .catch(err =>
        logger.warn({ err, collection: name }, 'auxiliary mongo write failed')
      )

  return {
    find: (...args) => primary.find(...args),
    findOne: (...args) => primary.findOne(...args),
    aggregate: (...args) => primary.aggregate(...args),
    countDocuments: (...args) => primary.countDocuments(...args),
    /**
     * @param {OptionalUnlessRequiredId<Document>[]} docs
     * @param {BulkWriteOptions} [opts]
     */
    async insertMany(docs, opts) {
      const result = await primary.insertMany(docs, opts)
      void mirror(() => auxiliary.insertMany(docs, opts))
      return result
    },
    /**
     * @param {AnyBulkWriteOperation[]} ops
     * @param {BulkWriteOptions} [opts]
     */
    async bulkWrite(ops, opts) {
      const result = await primary.bulkWrite(ops, opts)
      void mirror(() => auxiliary.bulkWrite(ops, opts))
      return result
    },
    /**
     * @param {Filter<Document>} filter
     * @param {UpdateFilter<Document>} update
     * @param {UpdateOptions} [opts]
     */
    async updateOne(filter, update, opts) {
      const result = await primary.updateOne(filter, update, opts)
      void mirror(() => auxiliary.updateOne(filter, update, opts))
      return result
    },
    /**
     * @param {Filter<Document>} filter
     * @param {UpdateFilter<Document>} update
     * @param {FindOneAndUpdateOptions} [opts]
     */
    async findOneAndUpdate(filter, update, opts) {
      const result = await primary.findOneAndUpdate(filter, update, opts)
      void mirror(() => auxiliary.findOneAndUpdate(filter, update, opts))
      return result
    },
    /**
     * @param {Filter<Document>} filter
     * @param {FindOneAndDeleteOptions} [opts]
     */
    async findOneAndDelete(filter, opts) {
      const result = await primary.findOneAndDelete(filter, opts)
      void mirror(() => auxiliary.findOneAndDelete(filter, opts))
      return result
    },
    /**
     * @param {Filter<Document>} filter
     */
    async deleteMany(filter) {
      const result = await primary.deleteMany(filter)
      void mirror(() => auxiliary.deleteMany(filter))
      return result
    },
  }
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
  libraryReferences: dualWriteCollection('libraryReferences'),
  librarySizes: dualWriteCollection('librarySizes'),
  librarySyncStates: dualWriteCollection('librarySyncStates'),
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

/**
 * Direct access to a collection on the auxiliary Mongo cluster, bypassing
 * the dual-write mirror in `db`. For use by data-migration scripts that need
 * to write to the auxiliary cluster without also writing to the primary one.
 */
export async function getAuxCollectionInternal(name) {
  if (!auxInternalDb) {
    throw new OError('no auxiliary Mongo cluster configured')
  }
  return auxInternalDb.collection(name)
}

export async function waitForDb() {
  await connectionPromise
  await auxConnectionPromise
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
  READ_PREFERENCE_PRIMARY,
  READ_PREFERENCE_SECONDARY,
}
