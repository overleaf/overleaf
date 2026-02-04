import Helpers from './lib/helpers.mjs'

const tags = ['saas']

const indexes = [
  {
    name: 'ssoConfig_1',
    key: { ssoConfig: 1 },
    partialFilterExpression: {
      ssoConfig: { $exists: true },
    },
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
