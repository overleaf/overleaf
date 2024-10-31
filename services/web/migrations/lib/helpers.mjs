// @ts-check

import {
  db,
  getCollectionNames,
  getCollectionInternal,
} from '../../app/src/infrastructure/mongodb.js'

/**
 * @typedef {import('mongodb-legacy').Document} Collection
 * @typedef {import('mongodb-legacy').Collection<Document>} Collection
 */

/**
 * @param {Collection} collection
 * @param {Array<{ name: string }>} indexes
 * @return {Promise<void>}
 */
async function addIndexesToCollection(collection, indexes) {
  await Promise.all(
    indexes.map(index => {
      index.background = true
      return collection.createIndex(index.key, index)
    })
  )
}

/**
 * @param {Collection} collection
 * @param {Array<{ name: string }>} indexes
 * @return {Promise<void>}
 */
async function dropIndexesFromCollection(collection, indexes) {
  await Promise.all(
    indexes.map(async index => {
      try {
        await collection.dropIndex(index.name)
      } catch (err) {
        if (err.code === 27 /* IndexNotFound */) {
          console.log(`Index ${index.name} not found; drop was a no-op.`)
        } else {
          throw err
        }
      }
    })
  )
}

/**
 * @param {string} collectionName
 * @return {Promise<void>}
 */
async function dropCollection(collectionName) {
  if (db[collectionName]) {
    throw new Error(`blocking drop of an active collection: ${collectionName}`)
  }

  const allCollections = await getCollectionNames()
  if (!allCollections.includes(collectionName)) return
  const collection = await getCollectionInternal(collectionName)
  await collection.drop()
}

/**
 * Asserts that a dependent migration has run. Throws an error otherwise.
 *
 * @param {string} migrationName
 */
async function assertDependency(migrationName) {
  const migrations = await getCollectionInternal('migrations')
  const migration = await migrations.findOne({ name: migrationName })
  if (migration == null) {
    throw new Error(
      `Bad migration order: ${migrationName} should run before this migration`
    )
  }
}

export default {
  addIndexesToCollection,
  dropIndexesFromCollection,
  dropCollection,
  assertDependency,
}
