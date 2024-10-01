const Helpers = require('./lib/helpers')

exports.tags = ['server-ce', 'server-pro', 'saas']

const indexes = [
  {
    key: {
      projectId: 1,
    },
    name: 'projectId_1',
  },
]

exports.migrate = async client => {
  const { db } = client
  await Helpers.addIndexesToCollection(db.deletedFiles, indexes)
}

exports.rollback = async client => {
  const { db } = client
  await Helpers.dropIndexesFromCollection(db.deletedFiles, indexes)
}
