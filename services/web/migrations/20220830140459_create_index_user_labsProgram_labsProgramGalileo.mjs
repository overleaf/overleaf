/* eslint-disable no-unused-vars */

import Helpers from './lib/helpers.mjs'

const tags = ['saas']

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

const migrate = async client => {
  const { db } = client
  await Helpers.addIndexesToCollection(db.users, indexes)
}

const rollback = async client => {
  const { db } = client
  await Helpers.dropIndexesFromCollection(db.users, indexes)
}

export default {
  tags,
  migrate,
  rollback,
}
