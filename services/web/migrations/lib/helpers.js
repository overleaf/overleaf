const {
  db,
  getCollectionNames,
  getCollectionInternal,
  waitForDb,
} = require('../../app/src/infrastructure/mongodb')

async function addIndexesToCollection(collection, indexes) {
  return Promise.all(
    indexes.map(index => {
      index.background = true
      return collection.createIndex(index.key, index)
    })
  )
}

async function dropIndexesFromCollection(collection, indexes) {
  return Promise.all(indexes.map(index => collection.dropIndex(index.name)))
}

async function dropCollection(collectionName) {
  await waitForDb()
  if (db[collectionName]) {
    throw new Error(`blocking drop of an active collection: ${collectionName}`)
  }

  const allCollections = await getCollectionNames()
  if (!allCollections.includes(collectionName)) return
  const collection = await getCollectionInternal(collectionName)
  await collection.drop()
}

module.exports = {
  addIndexesToCollection,
  dropIndexesFromCollection,
  dropCollection,
}
