import { batchedUpdate } from '@overleaf/mongo-utils/batchedUpdate.js'
import Helpers from './lib/helpers.mjs'

const tags = ['saas']

const indexes = [
  {
    key: {
      userId: 1,
      'sources.zotero.libraryType': 1,
      'sources.zotero.libraryId': 1,
      'sources.zotero.itemKey': 1,
    },
    name: 'userId_1_sources.zotero.libraryType_1_sources.zotero.libraryId_1_sources.zotero.itemKey_1',
    unique: true,
    // Not `sparse`: userId is always present, so a sparse compound index would
    // include every doc and collide native entries on (userId, null, null,
    // null). Scope uniqueness to Zotero-linked docs only.
    partialFilterExpression: { 'sources.zotero.itemKey': { $exists: true } },
  },
]

const migrate = async client => {
  const { db } = client
  await batchedUpdate(
    db.libraryReferences,
    { sources: { $exists: false } },
    { $set: { sources: {} } }
  )
  await Helpers.addIndexesToCollection(db.libraryReferences, indexes)
}

const rollback = async client => {
  const { db } = client
  await Helpers.dropIndexesFromCollection(db.libraryReferences, indexes)
}

export default {
  tags,
  migrate,
  rollback,
}
