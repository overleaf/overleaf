import Helpers from './lib/helpers.mjs'

const tags = ['server-ce', 'server-pro', 'saas']

const index = {
  key: { _id: 1, lastOpened: 1, active: 1 },
  name: '_id_1_lastOpened_1_active_1',
  partialFilterExpression: {
    active: true,
  },
}

const migrate = async client => {
  const { db } = client
  await Helpers.addIndexesToCollection(db.projects, [index])
}

const rollback = async client => {
  const { db } = client
  await Helpers.dropIndexesFromCollection(db.projects, [index])
}

export default {
  tags,
  migrate,
  rollback,
}
