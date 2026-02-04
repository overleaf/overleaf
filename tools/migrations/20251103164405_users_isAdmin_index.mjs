import Helpers from './lib/helpers.mjs'

const tags = ['server-ce', 'server-pro']

const indexes = [
  {
    name: 'isAdmin_1',
    key: { isAdmin: 1 },
    partialFilterExpression: {
      isAdmin: true,
    },
  },
]

const migrate = async client => {
  const { db } = client
  await Helpers.addIndexesToCollection(db.users, indexes)
}

const rollback = async client => {
  const { db } = client
  await Helpers.dropIndexesFromCollection(db.users, indexes)
}

export default {
  tags,
  migrate,
  rollback,
}
