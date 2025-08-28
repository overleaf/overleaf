import Helpers from './lib/helpers.mjs'

const tags = ['saas']

const indexes = [
  {
    key: { v1_id: 1 },
    name: 'v1_id_1',
    sparse: true,
  },
]

const migrate = async client => {
  const { db } = client
  await Helpers.addIndexesToCollection(db.subscriptions, indexes)
}

const rollback = async client => {
  const { db } = client
  await Helpers.dropIndexesFromCollection(db.subscriptions, indexes)
}

export default {
  tags,
  migrate,
  rollback,
}
