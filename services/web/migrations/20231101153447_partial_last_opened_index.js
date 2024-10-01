const Helpers = require('./lib/helpers')

exports.tags = ['server-ce', 'server-pro', 'saas']

const OLD_INDEX = {
  name: 'active_1_lastOpened_1',
  key: { active: 1, lastOpened: 1 },
}

const NEW_INDEX = {
  name: 'lastOpened_1',
  key: { lastOpened: 1 },
  partialFilterExpression: { active: true },
}

exports.migrate = async client => {
  const { db } = client
  await Helpers.addIndexesToCollection(db.projects, [NEW_INDEX])
  await Helpers.dropIndexesFromCollection(db.projects, [OLD_INDEX])
}

exports.rollback = async client => {
  const { db } = client
  await Helpers.addIndexesToCollection(db.projects, [OLD_INDEX])
  await Helpers.dropIndexesFromCollection(db.projects, [NEW_INDEX])
}
