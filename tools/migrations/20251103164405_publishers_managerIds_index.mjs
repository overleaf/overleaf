import Helpers from './lib/helpers.mjs'

const tags = ['saas']

const indexes = [
  {
    key: {
      managerIds: 1,
    },
    name: 'managerIds_1',
  },
]

const migrate = async client => {
  const { db } = client

  await Helpers.addIndexesToCollection(db.publishers, indexes)
}

const rollback = async client => {
  const { db } = client

  try {
    await Helpers.dropIndexesFromCollection(db.publishers, indexes)
  } catch (err) {
    console.error('Something went wrong rolling back the migrations', err)
  }
}

export default {
  tags,
  migrate,
  rollback,
}
