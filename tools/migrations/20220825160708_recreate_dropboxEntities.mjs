import Helpers from './lib/helpers.mjs'

const tags = ['saas']

const indexes = [
  {
    key: { 'overleaf.userId': 1, 'dropbox.id': 1 },
    name: 'overleaf.userId_1_dropbox.id_1',
    unique: true,
    partialFilterExpression: { 'dropbox.id': { $exists: true } },
  },
  {
    key: { 'overleaf.userId': 1, 'overleaf.id': 1 },
    name: 'overleaf.userId_1_overleaf.id_1',
    unique: true,
    partialFilterExpression: { 'overleaf.id': { $exists: true } },
  },
  { key: { 'overleaf.userId': 1, 'dropbox.pathLower': 'hashed' } },
]

const migrate = async client => {
  const { db } = client
  // Forcibly drop the dropboxEntities collection. The new structure is
  // different and we don't want to keep the data with the old structure around.
  await db.dropboxEntities.drop()
  await Helpers.addIndexesToCollection(db.dropboxEntities, indexes)
}

const rollback = async client => {
  const { db } = client
  await Helpers.dropIndexesFromCollection(db.dropboxEntities, indexes)
}

export default {
  tags,
  migrate,
  rollback,
}
