const Helpers = require('./lib/helpers')

exports.tags = ['server-ce', 'server-pro']

const index = {
  key: { imageName: 1 },
  name: 'imageName_1',
}

exports.migrate = async client => {
  const { db } = client
  await Helpers.addIndexesToCollection(db.projects, [index])
}

exports.rollback = async client => {
  const { db } = client
  await Helpers.dropIndexesFromCollection(db.projects, [index])
}
