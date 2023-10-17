const Helpers = require('./lib/helpers')

exports.tags = ['saas']

const indexes = [
  {
    key: { 'overleaf.history.display': 1 },
    name: 'overleaf.history.display_1',
  },
]

exports.migrate = async ({ db }) => {
  await Helpers.dropIndexesFromCollection(db.projects, indexes)
}

exports.rollback = async ({ db }) => {
  await Helpers.addIndexesToCollection(db.projects, indexes)
}
