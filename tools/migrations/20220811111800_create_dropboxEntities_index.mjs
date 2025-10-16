import Helpers from './lib/helpers.mjs'

const tags = ['saas']

const indexes = [
  {
    key: {
      entityId: 1,
    },
    name: 'entityId_1',
  },
]

const migrate = async client => {
  const { db } = client
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
