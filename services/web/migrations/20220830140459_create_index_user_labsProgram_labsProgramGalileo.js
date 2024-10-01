/* eslint-disable no-unused-vars */

const Helpers = require('./lib/helpers')

exports.tags = ['saas']

const indexes = [
  {
    key: { labsProgram: 1 },
    name: 'labsProgram_1',
  },
  {
    key: { labsProgramGalileo: 1 },
    name: 'labsProgramGalileo_1',
  },
]

exports.migrate = async client => {
  const { db } = client
  await Helpers.addIndexesToCollection(db.users, indexes)
}

exports.rollback = async client => {
  const { db } = client
  await Helpers.dropIndexesFromCollection(db.users, indexes)
}
