import Helpers from './lib/helpers.mjs'

const tags = ['server-ce', 'server-pro', 'saas']

const indexes = [
  {
    key: { lastActive: 1 },
    name: 'lastActive_1',
  },
]

async function migrate(client) {
  const { db } = client
  await Helpers.addIndexesToCollection(db.users, indexes)
}

async function rollback(client) {
  const { db } = client
  await Helpers.dropIndexesFromCollection(db.users, indexes)
}

export default {
  tags,
  migrate,
  rollback,
}
