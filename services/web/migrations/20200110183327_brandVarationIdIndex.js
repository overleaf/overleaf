const Helpers = require('./lib/helpers')

exports.tags = ['saas']

const indexes = [
  {
    key: {
      brandVariationId: 1,
    },
    name: 'brandVariationId_1',
  },
]

exports.migrate = async ({ db }) => {
  await Helpers.addIndexesToCollection(db.projects, indexes)
}

exports.rollback = async ({ db }) => {
  try {
    await Helpers.dropIndexesFromCollection(db.projects, indexes)
  } catch (err) {
    console.error('Something went wrong rolling back the migrations', err)
  }
}
