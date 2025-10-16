import Helpers from './lib/helpers.mjs'

const tags = ['saas']

const indexes = [
  {
    key: { 'overleaf.history.display': 1 },
    name: 'overleaf.history.display_1',
  },
]

const migrate = async ({ db }) => {
  await Helpers.dropIndexesFromCollection(db.projects, indexes)
}

const rollback = async ({ db }) => {
  await Helpers.addIndexesToCollection(db.projects, indexes)
}

export default {
  tags,
  migrate,
  rollback,
}
