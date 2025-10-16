import Helpers from './lib/helpers.mjs'

const tags = ['saas']

const indexes = [
  {
    key: {
      brandVariationId: 1,
    },
    name: 'brandVariationId_1',
  },
]

const migrate = async ({ db }) => {
  await Helpers.addIndexesToCollection(db.projects, indexes)
}

const rollback = async ({ db }) => {
  try {
    await Helpers.dropIndexesFromCollection(db.projects, indexes)
  } catch (err) {
    console.error('Something went wrong rolling back the migrations', err)
  }
}

export default {
  tags,
  migrate,
  rollback,
}
