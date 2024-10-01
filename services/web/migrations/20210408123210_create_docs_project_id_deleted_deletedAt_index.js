const Helpers = require('./lib/helpers')

exports.tags = ['server-ce', 'server-pro', 'saas']

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

exports.migrate = async client => {
  const { db } = client
  await Helpers.addIndexesToCollection(db.docs, indexes)
}

exports.rollback = async client => {
  const { db } = client
  await Helpers.dropIndexesFromCollection(db.docs, indexes)
}
