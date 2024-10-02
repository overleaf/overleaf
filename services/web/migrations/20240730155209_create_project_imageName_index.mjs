import Helpers from './lib/helpers.mjs'

const tags = ['server-ce', 'server-pro']

const index = {
  key: { imageName: 1 },
  name: 'imageName_1',
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
