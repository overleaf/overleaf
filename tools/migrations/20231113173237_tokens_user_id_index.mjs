/* eslint-disable no-unused-vars */

import Helpers from './lib/helpers.mjs'

const tags = ['server-ce', 'server-pro', 'saas']

const index = {
  key: {
    'data.user_id': 1,
  },
  name: 'data.user_id_1',
}

const migrate = async client => {
  const { db } = client
  await Helpers.addIndexesToCollection(db.tokens, [index])
}

const rollback = async client => {
  const { db } = client
  await Helpers.dropIndexesFromCollection(db.tokens, [index])
}

export default {
  tags,
  migrate,
  rollback,
}
