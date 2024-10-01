import Helpers from './lib/helpers.mjs'

const tags = ['server-ce', 'server-pro', 'saas']

const indexes = [
  {
    // The { state: -1 } sort order works around a restriction of Mongo 4.4
    // where it doesn't allow multiple indexes with the same keys and different
    // options. The restriction has been lifted in Mongo 5.0
    //
    // See https://www.mongodb.com/docs/manual/core/index-partial/#restrictions
    key: { state: -1 },
    name: 'state_pending',
    partialFilterExpression: { state: 'pending' },
  },
]

const migrate = async ({ db }) => {
  await Helpers.addIndexesToCollection(db.projectHistoryChunks, indexes)
}

const rollback = async ({ db }) => {
  await Helpers.dropIndexesFromCollection(db.projectHistoryChunks, indexes)
}

export default {
  tags,
  migrate,
  rollback,
}
