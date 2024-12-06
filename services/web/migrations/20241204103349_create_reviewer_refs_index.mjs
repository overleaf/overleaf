import Helpers from './lib/helpers.mjs'

const tags = ['server-ce', 'server-pro', 'saas']

const indexes = [
  {
    key: { reviewer_refs: 1 },
    name: 'reviewer_refs_1',
  },
]

const migrate = async client => {
  const { db } = client
  await Helpers.addIndexesToCollection(db.projects, indexes)
}

const rollback = async client => {
  const { db } = client
  await Helpers.dropIndexesFromCollection(db.projects, indexes)
}

export default {
  tags,
  migrate,
  rollback,
}
