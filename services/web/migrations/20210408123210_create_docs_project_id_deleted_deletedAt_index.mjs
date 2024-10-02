import Helpers from './lib/helpers.mjs'

const tags = ['server-ce', 'server-pro', 'saas']

const indexes = [
  {
    key: {
      project_id: 1,
      deleted: 1,
      deletedAt: -1,
    },
    name: 'project_id_deleted_deletedAt_1',
  },
]

const migrate = async client => {
  const { db } = client
  await Helpers.addIndexesToCollection(db.docs, indexes)
}

const rollback = async client => {
  const { db } = client
  await Helpers.dropIndexesFromCollection(db.docs, indexes)
}

export default {
  tags,
  migrate,
  rollback,
}
