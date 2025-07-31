import Helpers from './lib/helpers.mjs'

const tags = ['saas']

const indexes = [
  { key: { recurlySubscription_id: 1 }, name: 'recurlySubscription_id_1' },
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
