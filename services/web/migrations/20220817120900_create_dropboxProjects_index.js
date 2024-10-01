const Helpers = require('./lib/helpers')

exports.tags = ['saas']

const indexes = [
  {
    key: {
      userId: 1,
      dropboxId: 1,
    },
    unique: true,
    name: 'userId_dropboxId_1',
  },
]

exports.migrate = async client => {
  const { db } = client
  await Helpers.addIndexesToCollection(db.dropboxProjects, indexes)
}

exports.rollback = async client => {
  const { db } = client
  await Helpers.dropIndexesFromCollection(db.dropboxProjects, indexes)
}
