import Helpers from './lib/helpers.mjs'

const tags = ['saas', 'auxiliary']

const oldIndex = {
  key: { userId: 1, updatedAt: 1 },
  name: 'userId_1_updatedAt_1',
}

const newIndex = {
  key: { userId: 1, updatedAt: 1, _id: 1 },
  name: 'userId_1_updatedAt_1__id_1',
}

const migrate = async client => {
  const { db } = client
  await Helpers.addIndexesToCollection(db.libraryReferences, [newIndex])
  await Helpers.dropIndexesFromCollection(db.libraryReferences, [oldIndex])
}

const rollback = async client => {
  const { db } = client
  await Helpers.addIndexesToCollection(db.libraryReferences, [oldIndex])
  await Helpers.dropIndexesFromCollection(db.libraryReferences, [newIndex])
}

export default {
  tags,
  migrate,
  rollback,
}
