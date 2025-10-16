import Helpers from './lib/helpers.mjs'

const tags = ['server-ce', 'server-pro', 'saas']

const indexes = [
  {
    key: { 'overleaf.userId': 1, 'overleaf.projectId': 1 },
    name: 'overleaf_userId_1_overleaf_projectId_1',
  },
]

const migrate = async client => {
  const { db } = client
  await Helpers.addIndexesToCollection(db.dropboxEntities, indexes)
}

const rollback = async client => {
  const { db } = client
  await Helpers.dropIndexesFromCollection(db.dropboxEntities, indexes)
}

export default {
  tags,
  migrate,
  rollback,
}
