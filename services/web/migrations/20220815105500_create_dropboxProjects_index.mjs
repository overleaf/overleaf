import Helpers from './lib/helpers.mjs'

const tags = ['saas']

const indexes = [
  {
    key: {
      userId: 1,
      projectId: 1,
    },
    unique: true,
    name: 'projectId_userId_1',
  },
]

const migrate = async client => {
  const { db } = client
  await Helpers.addIndexesToCollection(db.dropboxProjects, indexes)
}

const rollback = async client => {
  const { db } = client
  await Helpers.dropIndexesFromCollection(db.dropboxProjects, indexes)
}

export default {
  tags,
  migrate,
  rollback,
}
