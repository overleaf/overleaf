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
  return Promise.all(
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
