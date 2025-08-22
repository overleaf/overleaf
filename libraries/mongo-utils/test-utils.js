// @ts-check

/**
 * @import { MongoClient } from 'mongodb'
 * @import { MongoClient as LegacyMongoClient } from 'mongodb-legacy'
 */

/**
 * Delete all data from the test Mongo database
 *
 * This doesn't drop the collections, so indexes are preserved.
 *
 * @param {MongoClient | LegacyMongoClient} mongoClient
 */
async function cleanupTestDatabase(mongoClient) {
  ensureTestDatabase(mongoClient)
  const db = mongoClient.db()
  const allCollections = await db.collections()
  const collections = allCollections.filter(
    coll => coll.collectionName !== 'migrations'
  )
  await Promise.all(collections.map(coll => coll.deleteMany({})))
}

/**
 * Drop the test Monto database
 *
 * This drops the whole database, including indexes.
 *
 * @param {MongoClient | LegacyMongoClient } mongoClient
 */
async function dropTestDatabase(mongoClient) {
  ensureTestDatabase(mongoClient)
  await mongoClient.db().dropDatabase()
}
/**
 * Ensure that the given client is connected to a test database.
 *
 * This should be called before performing destructive operations on the test
 * database.
 *
 * @param {MongoClient | LegacyMongoClient } mongoClient
 */
function ensureTestDatabase(mongoClient) {
  const dbName = mongoClient.db().databaseName
  const env = process.env.NODE_ENV

  if (dbName !== 'test-overleaf' || env !== 'test') {
    throw new Error(
      `Refusing to clear database '${dbName}' in environment '${env}'`
    )
  }
}

module.exports = { cleanupTestDatabase, dropTestDatabase }
