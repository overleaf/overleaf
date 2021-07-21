const { getCollectionNames } = require('../../app/src/infrastructure/mongodb')

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

async function dropCollection(db, collectionName) {
  const allCollections = await getCollectionNames()
  if (!allCollections.includes(collectionName)) return
  return db[collectionName].drop()
}

module.exports = {
  addIndexesToCollection,
  dropIndexesFromCollection,
  dropCollection,
}
