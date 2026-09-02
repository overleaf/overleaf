import Helpers from './lib/helpers.mjs'

const tags = ['saas', 'auxiliary']

// Supports the moved-out-of-collection diff: for a synced collection, find
// every locally-recorded item whose cached membership includes that
// collection key, projected down to just itemKey/collections (see
// findZoteroCollectionMembership in LibraryReferenceRepository.mts).
const newIndexes = [
  {
    key: {
      userId: 1,
      'sources.zotero.libraryType': 1,
      'sources.zotero.libraryId': 1,
      'sources.zotero.collections': 1,
    },
    name: 'userId_1_sources.zotero.libraryType_1_sources.zotero.libraryId_1_sources.zotero.collections_1',
    partialFilterExpression: { 'sources.zotero.itemKey': { $exists: true } },
  },
]

const migrate = async client => {
  const { db } = client
  await Helpers.addIndexesToCollection(db.libraryReferences, newIndexes)
}

const rollback = async client => {
  const { db } = client
  await Helpers.dropIndexesFromCollection(db.libraryReferences, newIndexes)
}

export default {
  tags,
  migrate,
  rollback,
}
