const Helpers = require('./lib/helpers')

exports.tags = ['saas']

const indexes = [
  {
    key: {
      name: 1,
    },
    unique: true,
    name: 'name_1',
  },
]

exports.migrate = async client => {
  const { db } = client
  await Helpers.addIndexesToCollection(db.splittests, indexes)
}

exports.rollback = async client => {
  const { db } = client
  Helpers.dropIndexesFromCollection(db.splittests, indexes)
}
